import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authSupabase = await createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { flagId, targetType, targetId, action, reason } = body as {
    flagId: string;
    targetType: string;
    targetId: string;
    action: string;
    reason?: string;
  };

  if (!flagId || !action) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = await createAdminSupabase();

  // Update flag status
  const flagStatus = action === 'dismiss' ? 'dismissed' : 'action_taken';
  await supabase
    .from('flags')
    .update({ status: flagStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', flagId);

  // Perform the action on the target
  if (action === 'remove_post' && targetType === 'post') {
    await supabase.from('posts').update({ status: 'cancelled' }).eq('id', targetId);
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'remove_post',
      target_type: 'posts',
      target_id: targetId,
      reason: reason ?? null,
    });
  } else if (action === 'suspend_user' && targetType === 'user') {
    await supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', targetId);
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
