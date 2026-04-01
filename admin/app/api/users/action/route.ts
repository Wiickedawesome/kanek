import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authSupabase = await createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { userId, action, reason } = body as { userId: string; action: string; reason?: string };

  if (!userId || !['suspend', 'unsuspend'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (action === 'suspend' && !reason) {
    return NextResponse.json({ error: 'Reason required for suspension' }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  const newStatus = action === 'suspend' ? 'suspended' : 'active';
  const { error } = await supabase
    .from('profiles')
    .update({ account_status: newStatus })
    .eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('notifications').insert({
    user_id: userId,
    type: action === 'suspend' ? 'account_suspended' : 'account_reactivated',
    title: action === 'suspend' ? 'Account suspended' : 'Account restored',
    body: action === 'suspend'
      ? reason
        ? `Your account was suspended: ${reason}`
        : 'Your account was suspended by the kanek team.'
      : 'Your account is active again.',
    data: { userId },
  });

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: action === 'suspend' ? 'suspend_user' : 'unsuspend_user',
    target_type: 'profiles',
    target_id: userId,
    reason: reason ?? null,
  });

  return NextResponse.json({ ok: true });
}
