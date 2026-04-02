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
}

export interface MyPostWithBookings extends PostWithAuthor {
  activeBookings: ActiveBookingPreview[];
  activeBookingsCount: number;
}

interface GetPostsArgs {
  type?: PostType | null;
  status?: PostStatus;
  limit?: number;
  offset?: number;
  search?: string;
}

export const postsApi = createApi({
  reducerPath: 'postsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query<PostWithAuthor[], GetPostsArgs | void>({
      queryFn: async (args) => {
        const { type, status = 'open', limit = 20, offset = 0, search } = args ?? {};

        let query = supabase
          .from('posts')
          .select(`
            *,
            author:profiles!posts_author_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            )
          `)
          .eq('status', status)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (type) {
          query = query.eq('type', type);
        }

        if (search) {
          query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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
            author:profiles!posts_author_id_fkey (
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
        const { data, error } = await supabase
          .from('posts')
          .insert(newPost)
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
            author:profiles!posts_author_id_fkey (
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
            user:profiles!bookings_user_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            )
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
  }),
});

export const {
  useGetPostsQuery,
  useGetPostByIdQuery,
  useCreatePostMutation,
  useGetMyPostsQuery,
  useDeletePostMutation,
} = postsApi;
