import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** Public-facing profile fields visible to any authenticated user */
export interface PublicProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  rating_avg: number;
  punctuality_pct: number;
  strikes_soft: number;
  strikes_hard: number;
  account_status: string;
  created_at: string;
}

export const profilesApi = createApi({
  reducerPath: 'profilesApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Profile'],
  endpoints: (builder) => ({
    getMyProfile: builder.query<ProfileRow, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as ProfileRow };
      },
      providesTags: (_result, _error, id) => [{ type: 'Profile', id }],
    }),

    /** Public profile — only trust-relevant fields */
    getPublicProfile: builder.query<PublicProfile, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id, first_name, last_name, avatar_url, role, rating_avg, punctuality_pct, strikes_soft, strikes_hard, account_status, created_at',
          )
          .eq('id', userId)
          .single();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as PublicProfile };
      },
      providesTags: (_result, _error, id) => [{ type: 'Profile', id }],
    }),

    updateProfile: builder.mutation<
      ProfileRow,
      { id: string; updates: Database['public']['Tables']['profiles']['Update'] }
    >({
      queryFn: async ({ id, updates }) => {
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as ProfileRow };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Profile', id }],
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useGetPublicProfileQuery,
  useUpdateProfileMutation,
} = profilesApi;
