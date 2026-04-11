/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

/**
 * Cron function: Expire posts whose expires_at has passed and are still open.
 * Also expire road_reports older than their expires_at.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Internal-only: reject user-initiated requests
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    // Expire open posts past their expiry
    const { data: expiredPosts, error: postsError } = await supabase
      .from('posts')
      .update({ status: 'expired', updated_at: now })
      .in('status', ['open', 'activated'])
      .lt('expires_at', now)
      .not('expires_at', 'is', null)
      .select('id, author_id, title');

    if (postsError) {
      return errorResponse(`Posts expire error: ${postsError.message}`, 500);
    }

    // Notify authors
    if (expiredPosts && expiredPosts.length > 0) {
      const notifications = expiredPosts.map((p) => ({
        user_id: p.author_id,
        type: 'post_expired',
        title: 'Post Expired',
        body: `Your post "${p.title}" has expired. Create a new one if you still need it.`,
        data: { postId: p.id },
      }));
      await supabase.from('notifications').insert(notifications);

      // Cancel pending bookings on expired posts — batched (M-04)
      const expiredIds = expiredPosts.map((p) => p.id);
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancel_reason: 'Post expired',
          cancelled_at: now,
          updated_at: now,
        })
        .in('post_id', expiredIds)
        .in('status', ['pending', 'confirmed']);
    }

    // Delete expired road reports (they auto-expire after 2 hours)
    const { count: deletedReports } = await supabase
      .from('road_reports')
      .delete({ count: 'exact' })
      .lt('expires_at', now);

    return jsonResponse({
      expiredPosts: expiredPosts?.length ?? 0,
      deletedRoadReports: deletedReports ?? 0,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Expire failed',
      500,
    );
  }
});
