import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authSupabase = await createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { docId, action, reason } = body as { docId: string; action: string; reason?: string };

  if (!docId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (action === 'reject' && !reason) {
    return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  if (action === 'approve') {
    const { error } = await supabase
      .from('rider_documents')
      .update({ review_status: 'approved', verified: true, reviewed_by: user.id })
      .eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('rider_documents')
      .update({ review_status: 'rejected', rejection_reason: reason, verified: false, reviewed_by: user.id })
      .eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: action === 'approve' ? 'approve_rider_doc' : 'reject_rider_doc',
    target_type: 'rider_documents',
    target_id: docId,
    reason: reason ?? null,
  });

  return NextResponse.json({ ok: true });
}
