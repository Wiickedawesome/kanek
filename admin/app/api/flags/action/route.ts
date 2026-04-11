import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { isValidUUID, MAX_REASON_LENGTH } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authSupabase = await createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { flagId, action, reason } = body as {
    flagId: string;
    action: string;
    reason?: string;
  };

  if (!isValidUUID(flagId)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Validate action against allowlist
  const ALLOWED_ACTIONS = ['dismiss', 'remove_post', 'suspend_user', 'issue_strike'];
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (reason && typeof reason === 'string' && reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json({ error: `Reason must be ${MAX_REASON_LENGTH} characters or less` }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  // Fetch the flag record to get the authoritative target_type and target_id
  const { data: flag, error: flagError } = await supabase
    .from('flags')
    .select('target_type, target_id')
    .eq('id', flagId)
    .single();

  if (flagError || !flag) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  }

  const targetType = flag.target_type;
  const targetId = flag.target_id;

  // Update flag status
  const flagStatus = action === 'dismiss' ? 'dismissed' : 'action_taken';
  await supabase
    .from('flags')
    .update({ status: flagStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', flagId);

  // Perform the action on the target
  if (action === 'remove_post' && targetType === 'post') {
    const { data: post } = await supabase
      .from('posts')
      .select('author_id, title')
      .eq('id', targetId)
      .single();

    await supabase.from('posts').update({ status: 'cancelled' }).eq('id', targetId);

    if (post?.author_id) {
      await supabase.from('notifications').insert({
        user_id: post.author_id,
        type: 'post_removed',
        title: 'Post removed',
        body: reason
          ? `One of your posts was removed: ${reason}`
          : 'One of your posts was removed after moderation review.',
        data: { postId: targetId },
      });
    }

    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'remove_post',
      target_type: 'posts',
      target_id: targetId,
      reason: reason ?? null,
    });
  } else if (action === 'suspend_user' && targetType === 'user') {
    // Prevent suspending admin accounts
    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', targetId).single();
    if (targetProfile?.role === 'admin') {
      return NextResponse.json({ error: 'Cannot suspend an admin account' }, { status: 403 });
    }

    await supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', targetId);
    await supabase.from('notifications').insert({
      user_id: targetId,
      type: 'account_suspended',
      title: 'Account suspended',
      body: reason
        ? `Your account was suspended: ${reason}`
        : 'Your account was suspended after moderation review.',
      data: { userId: targetId },
    });
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'suspend_user',
      target_type: 'profiles',
      target_id: targetId,
      reason: reason ?? null,
    });
  } else if (action === 'issue_strike') {
    // Determine the user ID for the strike
    let strikeUserId = targetId;
    if (targetType === 'post') {
      const { data: post } = await supabase.from('posts').select('author_id').eq('id', targetId).single();
      if (post) strikeUserId = post.author_id;
    }
    await supabase.from('strikes').insert({
      user_id: strikeUserId,
      type: 'soft',
      reason: 'report',
      auto_generated: false,
    });
    await supabase.from('notifications').insert({
      user_id: strikeUserId,
      type: 'strike_received',
      title: 'Strike issued',
      body: reason
        ? `A strike was added to your account: ${reason}`
        : 'A strike was added to your account after moderation review.',
      data: { userId: strikeUserId, targetId, targetType },
    });
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'issue_strike',
      target_type: 'profiles',
      target_id: strikeUserId,
      reason: reason ?? null,
    });
  } else if (action === 'dismiss') {
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'dismiss_flag',
      target_type: 'flags',
      target_id: flagId,
      reason: reason ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
