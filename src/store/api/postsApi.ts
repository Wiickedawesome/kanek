import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database, PostType, PostStatus, BookingStatus } from '@/types/database';

type PostRow = Database['public']['Tables']['posts']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** Post with author profile attached */
export interface PostWithAuthor extends PostRow {
  author: Pick<
    ProfileRow,
    'id' | 'first_name' | 'last_name' | 'avatar_url' | 'rating_avg' | 'punctuality_pct'
  > | null;
}

export interface ActiveBookingPreview {
  id: string;
  post_id: string;
  status: BookingStatus;
  seats_booked: number;
  user: Pick<
    ProfileRow,
    'id' | 'first_name' | 'last_name' | 'avatar_url' | 'rating_avg' | 'punctuality_pct'
  > | null;
  contract: { id: string }[];
}

export interface MyPostWithBookings extends PostWithAuthor {
  activeBookings: ActiveBookingPreview[];
  activeBookingsCount: number;
}

interface GetPostsArgs {
  type?: PostType | PostType[] | null;
  status?: PostStatus;
  limit?: number;
  offset?: number;
  search?: string;
}

export const postsApi = createApi({
  reducerPath: 'postsApi',
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 120,
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query<PostWithAuthor[], GetPostsArgs | void>({
      queryFn: async (args) => {
        const { type, status = 'open', limit = 20, offset = 0, search } = args ?? {};

        let query = supabase
          .from('posts')
          .select(`
            id, type, status, title, description, author_id,
            origin_address, origin_lat, origin_lng,
            dest_address, dest_lat, dest_lng,
            departure_at, expires_at, created_at, updated_at,
            price_cents, seats_total, seats_filled,
            payment_method, pickup_notes, pickup_style,
            is_round_trip, vehicle_description, min_riders,
            route_geometry,
            route_distance_km, route_duration_min, route_fuel_cost_cents,
            errand_category, errand_fee_cents, item_cost_cents,
            job_category, job_timeline, pay_rate_cents, pay_type,
            author:profiles_public!posts_author_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            )
          `)
          .eq('status', status)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (type) {
          if (Array.isArray(type)) {
            query = query.in('type', type);
          } else {
            query = query.eq('type', type);
          }
        }

        if (search) {
          // Escape PostgREST special characters to prevent filter injection
          const sanitized = search.replace(/[%_\\(),."]/g, (ch) => `\\${ch}`);
          query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
        }

        const { data, error } = await query;

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as PostWithAuthor[]) ?? [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Post' as const, id })),
              { type: 'Post', id: 'LIST' },
            ]
          : [{ type: 'Post', id: 'LIST' }],
    }),

    getPostById: builder.query<PostWithAuthor, string>({
      queryFn: async (postId) => {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles_public!posts_author_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            )
          `)
          .eq('id', postId)
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as unknown as PostWithAuthor };
      },
      providesTags: (_result, _error, id) => [{ type: 'Post', id }],
    }),

    createPost: builder.mutation<PostRow, Database['public']['Tables']['posts']['Insert']>({
      queryFn: async (newPost) => {
        // Allowlist: only permit fields the form should set
        const ALLOWED_FIELDS = [
          'author_id', 'title', 'type', 'description',
          'origin_address', 'origin_lat', 'origin_lng',
          'dest_address', 'dest_lat', 'dest_lng',
          'departure_at', 'expires_at', 'price_cents', 'seats_total',
          'payment_method', 'pickup_notes', 'pickup_style',
          'is_round_trip', 'vehicle_description', 'min_riders',
          'return_time', 'repeat_days',
          'route_geometry', 'route_distance_km', 'route_duration_min',
          'route_fuel_cost_cents',
          'errand_category', 'errand_fee_cents', 'item_cost_cents',
          'job_category', 'job_timeline', 'pay_rate_cents', 'pay_type',
        ] as const;
        const safePost: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
          if (key in newPost) safePost[key] = (newPost as Record<string, unknown>)[key];
        }

        const { data, error } = await supabase
          .from('posts')
          .insert(safePost as Database['public']['Tables']['posts']['Insert'])
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as PostRow };
      },
      invalidatesTags: [{ type: 'Post', id: 'LIST' }, { type: 'Post', id: 'MY_LIST' }],
    }),

    getMyPosts: builder.query<MyPostWithBookings[], { userId: string }>({
      queryFn: async ({ userId }) => {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles_public!posts_author_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            )
          `)
          .eq('author_id', userId)
          .order('created_at', { ascending: false });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        const posts = (data as unknown as PostWithAuthor[]) ?? [];
        if (posts.length === 0) {
          return { data: [] };
        }

        const postIds = posts.map((post) => post.id);
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            post_id,
            status,
            seats_booked,
            user:profiles_public!bookings_user_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            ),
            contract:contracts!contracts_booking_id_fkey(id)
          `)
          .in('post_id', postIds)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false });

        if (bookingsError) {
          return { error: { status: 'CUSTOM_ERROR' as const, error: bookingsError.message } };
        }

        const bookingsByPost = new Map<string, ActiveBookingPreview[]>();
        for (const booking of ((bookings as unknown as ActiveBookingPreview[]) ?? [])) {
          const existing = bookingsByPost.get(booking.post_id) ?? [];
          existing.push(booking);
          bookingsByPost.set(booking.post_id, existing);
        }

        return {
          data: posts.map((post) => {
            const activeBookings = bookingsByPost.get(post.id) ?? [];
            return {
              ...post,
              activeBookings,
              activeBookingsCount: activeBookings.length,
            };
          }),
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Post' as const, id })),
              { type: 'Post', id: 'MY_LIST' },
            ]
          : [{ type: 'Post', id: 'MY_LIST' }],
    }),

    deletePost: builder.mutation<null, string>({
      queryFn: async (postId) => {
        const { data, error } = await supabase
          .from('posts')
          .delete()
          .eq('id', postId)
          .select('id');

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        if (!data || data.length === 0) {
          return { error: { status: 'CUSTOM_ERROR' as const, error: 'Could not delete post. You can only delete your own posts.' } };
        }
        return { data: null };
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Post', id },
        { type: 'Post', id: 'LIST' },
        { type: 'Post', id: 'MY_LIST' },
      ],
    }),

    proceedRoute: builder.mutation<null, string>({
      queryFn: async (postId) => {
        const { error } = await supabase.rpc('proceed_route', { p_post_id: postId });
        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Post', id },
        { type: 'Post', id: 'LIST' },
        { type: 'Post', id: 'MY_LIST' },
      ],
    }),

    cancelRouteShort: builder.mutation<null, { postId: string; reason?: string }>({
      queryFn: async ({ postId, reason }) => {
        const { error } = await supabase.rpc('cancel_route_short', {
          p_post_id: postId,
          p_reason: reason,
        });
        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: (_result, _error, { postId }) => [
        { type: 'Post', id: postId },
        { type: 'Post', id: 'LIST' },
        { type: 'Post', id: 'MY_LIST' },
      ],
    }),
  }),
});

export const {
  useGetPostsQuery,
  useGetPostByIdQuery,
  useCreatePostMutation,
  useGetMyPostsQuery,
  useDeletePostMutation,
  useProceedRouteMutation,
  useCancelRouteShortMutation,
} = postsApi;
