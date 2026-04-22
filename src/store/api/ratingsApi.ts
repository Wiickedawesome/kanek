import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type RatingRow = Database['public']['Tables']['ratings']['Row'];
type StrikeRow = Database['public']['Tables']['strikes']['Row'];

/** Rating with rater's public profile info (from ratings_public view) */
export interface RatingWithRater {
  id: string;
  contract_id: string;
  rated_id: string;
  stars: number;
  was_on_time: boolean | null;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
  rater_id: string | null;
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
  isAnonymous?: boolean;
}

export const ratingsApi = createApi({
  reducerPath: 'ratingsApi',
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 300,
  tagTypes: ['Rating', 'Strike', 'HasRated'],
  endpoints: (builder) => ({
    /** Fetch ratings received by a user, with rater profile info (via ratings_public view) */
    getUserRatings: builder.query<RatingWithRater[], GetUserRatingsArgs>({
      queryFn: async ({ userId, limit = 20, offset = 0 }) => {
        const { data, error } = await supabase
          .from('ratings_public' as 'ratings')
          .select('*')
          .eq('rated_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        // Map flat rater columns into nested object for backward compat
        const mapped = ((data as unknown as Record<string, unknown>[]) ?? []).map((row) => ({
          id: row.id as string,
          contract_id: row.contract_id as string,
          rated_id: row.rated_id as string,
          stars: row.stars as number,
          was_on_time: row.was_on_time as boolean | null,
          comment: row.comment as string | null,
          is_anonymous: row.is_anonymous as boolean,
          created_at: row.created_at as string,
          rater_id: row.rater_id as string | null,
          rater: row.rater_id
            ? {
                id: row.rater_id as string,
                first_name: row.rater_first_name as string | null,
                last_name: row.rater_last_name as string | null,
                avatar_url: row.rater_avatar_url as string | null,
                role: row.rater_role as string,
              }
            : null,
        }));
        return { data: mapped };
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
      queryFn: async ({ contractId, raterId, ratedId, stars, wasOnTime, comment, isAnonymous }) => {
        // Enforce length limit on comment
        const safeComment = comment ? comment.slice(0, 500) : null;

        const { data, error } = await supabase
          .from('ratings')
          .insert({
            contract_id: contractId,
            rater_id: raterId,
            rated_id: ratedId,
            stars,
            was_on_time: wasOnTime ?? null,
            comment: safeComment,
            is_anonymous: isAnonymous ?? false,
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
