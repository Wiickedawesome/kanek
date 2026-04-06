import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
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

  // Get the document first to find user_id
  const { data: doc, error: fetchError } = await supabase
    .from('rider_documents')
    .select('user_id')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: fetchError?.message ?? 'Document not found' }, { status: 404 });
  }

  const riderUserId = doc.user_id;

  if (action === 'approve') {
    const { error } = await supabase
      .from('rider_documents')
      .update({ review_status: 'approved', verified: true, reviewed_by: user.id })
      .eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('profiles').update({ account_status: 'active' }).eq('id', riderUserId);
    await supabase.from('notifications').insert({
      user_id: riderUserId,
      type: 'rider_verified',
      title: 'ID document approved',
      body: 'Your ID document was approved. Your account is now verified.',
      data: { userId: riderUserId },
    });
  } else {
    const { error } = await supabase
      .from('rider_documents')
      .update({ review_status: 'rejected', rejection_reason: reason, verified: false, reviewed_by: user.id })
      .eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('notifications').insert({
      user_id: riderUserId,
      type: 'rider_document_rejected',
      title: 'ID document needs changes',
      body: reason
        ? `Your ID document was rejected: ${reason}`
        : 'Your ID document was rejected. Please upload a clearer document and try again.',
      data: { userId: riderUserId },
    });
  }

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: action === 'approve' ? 'approve_rider_doc' : 'reject_rider_doc',
    target_type: 'rider_documents',
    target_id: docId,
    reason: reason ?? null,
  });

  revalidatePath(`/riders/${docId}`);
  revalidatePath('/riders');

  return NextResponse.json({ ok: true });
}
