import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type RatingRow = Database['public']['Tables']['ratings']['Row'];
type StrikeRow = Database['public']['Tables']['strikes']['Row'];

/** Rating joined with rater's public profile info */
export interface RatingWithRater extends RatingRow {
  rater: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

interface GetUserRatingsArgs {
  userId: string;
  limit?: number;
  offset?: number;
}

interface CheckHasRatedArgs {
  contractId: string;
  raterId: string;
}

interface SubmitRatingArgs {
  contractId: string;
  raterId: string;
  ratedId: string;
  stars: number;
  wasOnTime?: boolean | null;
  comment?: string | null;
}

export const ratingsApi = createApi({
  reducerPath: 'ratingsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Rating', 'Strike', 'HasRated'],
  endpoints: (builder) => ({
    /** Fetch ratings received by a user, with rater profile info */
    getUserRatings: builder.query<RatingWithRater[], GetUserRatingsArgs>({
      queryFn: async ({ userId, limit = 20, offset = 0 }) => {
        const { data, error } = await supabase
          .from('ratings')
          .select(`
            *,
            rater:profiles!ratings_rater_id_fkey (
              id, first_name, last_name, avatar_url, role
            )
          `)
          .eq('rated_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as RatingWithRater[]) ?? [] };
      },
      providesTags: (result, _error, { userId }) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Rating' as const, id })),
              { type: 'Rating', id: `USER_${userId}` },
            ]
          : [{ type: 'Rating', id: `USER_${userId}` }],
    }),

    /** Check whether a rater has already rated this contract */
    checkHasRated: builder.query<boolean, CheckHasRatedArgs>({
      queryFn: async ({ contractId, raterId }) => {
        const { count, error } = await supabase
          .from('ratings')
          .select('id', { count: 'exact', head: true })
          .eq('contract_id', contractId)
          .eq('rater_id', raterId);

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (count ?? 0) > 0 };
      },
      providesTags: (_result, _error, { contractId, raterId }) => [
        { type: 'HasRated', id: `${contractId}_${raterId}` },
      ],
    }),

    /** Submit a rating (invalidates caches) */
    submitRating: builder.mutation<RatingRow, SubmitRatingArgs>({
      queryFn: async ({ contractId, raterId, ratedId, stars, wasOnTime, comment }) => {
        const { data, error } = await supabase
          .from('ratings')
          .insert({
            contract_id: contractId,
            rater_id: raterId,
            rated_id: ratedId,
            stars,
            was_on_time: wasOnTime ?? null,
            comment: comment ?? null,
          })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as RatingRow };
      },
      invalidatesTags: (_result, _error, { contractId, raterId, ratedId }) => [
        { type: 'HasRated', id: `${contractId}_${raterId}` },
        { type: 'Rating', id: `USER_${ratedId}` },
      ],
    }),

    /** Fetch strikes for a user */
    getUserStrikes: builder.query<StrikeRow[], string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('strikes')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as StrikeRow[]) ?? [] };
      },
      providesTags: (result, _error, userId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Strike' as const, id })),
              { type: 'Strike', id: `USER_${userId}` },
            ]
          : [{ type: 'Strike', id: `USER_${userId}` }],
    }),
  }),
});

export const {
  useGetUserRatingsQuery,
  useCheckHasRatedQuery,
  useSubmitRatingMutation,
  useGetUserStrikesQuery,
} = ratingsApi;
