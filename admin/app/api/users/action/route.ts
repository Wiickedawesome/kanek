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
  const { userId, action, reason } = body as { userId: string; action: string; reason?: string };

  if (!userId || !['suspend', 'unsuspend', 'approve'].includes(action)) {
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

  // If approving, also mark any pending rider document as approved
  if (action === 'approve') {
    await supabase
      .from('rider_documents')
      .update({ review_status: 'approved', verified: true, reviewed_by: user.id })
      .eq('user_id', userId)
      .eq('review_status', 'pending');
  }

  const notifMap: Record<string, { type: string; title: string; body: string }> = {
    approve: {
      type: 'account_approved',
      title: 'Account approved',
      body: 'Your account has been approved. You can now create posts and book rides.',
    },
    suspend: {
      type: 'account_suspended',
      title: 'Account suspended',
      body: reason
        ? `Your account was suspended: ${reason}`
        : 'Your account was suspended by the kanek team.',
    },
    unsuspend: {
      type: 'account_reactivated',
      title: 'Account restored',
      body: 'Your account is active again.',
    },
  };

  const notif = notifMap[action];
  await supabase.from('notifications').insert({
    user_id: userId,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    data: { userId },
  });

  const adminActionMap: Record<string, string> = {
    approve: 'approve_rider_doc',
    suspend: 'suspend_user',
    unsuspend: 'unsuspend_user',
  };

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: adminActionMap[action],
    target_type: 'profiles',
    target_id: userId,
    reason: reason ?? null,
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');

  return NextResponse.json({ ok: true });
}
