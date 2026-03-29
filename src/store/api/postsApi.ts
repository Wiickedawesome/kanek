import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database, PostType, PostStatus } from '@/types/database';

type PostRow = Database['public']['Tables']['posts']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** Post with author profile attached */
export interface PostWithAuthor extends PostRow {
  author: Pick<
    ProfileRow,
    'id' | 'first_name' | 'last_name' | 'avatar_url' | 'rating_avg' | 'punctuality_pct'
  > | null;
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

    getMyPosts: builder.query<PostWithAuthor[], { userId: string }>({
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
        return { data: (data as unknown as PostWithAuthor[]) ?? [] };
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
