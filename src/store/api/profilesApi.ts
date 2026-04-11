import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type DriverDetailsRow = Database['public']['Tables']['driver_details']['Row'];
type RiderDocumentRow = Database['public']['Tables']['rider_documents']['Row'];

/** Public-facing profile fields visible to any authenticated user */
export interface PublicProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  rating_avg: number;
  punctuality_pct: number;
  account_status: string;
  created_at: string;
}

export const profilesApi = createApi({
  reducerPath: 'profilesApi',
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 300,
  tagTypes: ['Profile', 'DriverDetails', 'RiderDocument'],
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

    /** Public profile — only trust-relevant fields (via profiles_public view) */
    getPublicProfile: builder.query<PublicProfile, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('profiles_public')
          .select(
            'id, first_name, last_name, avatar_url, role, rating_avg, punctuality_pct, account_status, created_at',
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
        // Allowlist: only permit user-editable fields
        const ALLOWED_FIELDS = [
          'first_name', 'last_name', 'bio', 'avatar_url', 'email',
          'preferred_districts', 'push_token',
          'district', 'address_line', 'emergency_contact',
        ] as const;
        const safeUpdates: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
          if (key in updates) safeUpdates[key] = (updates as Record<string, unknown>)[key];
        }

        const { data, error } = await supabase
          .from('profiles')
          .update(safeUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as ProfileRow };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Profile', id }],
    }),

    getDriverDetails: builder.query<DriverDetailsRow | null, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('driver_details')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as DriverDetailsRow) ?? null };
      },
      providesTags: (_result, _error, id) => [{ type: 'DriverDetails', id }],
    }),

    getLatestRiderDocument: builder.query<RiderDocumentRow | null, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('rider_documents')
          .select('*')
          .eq('user_id', userId)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as RiderDocumentRow) ?? null };
      },
      providesTags: (_result, _error, id) => [{ type: 'RiderDocument', id }],
    }),

    /** Step 1: Request phone change — sends OTP to the new number. Rate-limited to once per 30 days. */
    requestPhoneChange: builder.mutation<
      { sent: true },
      { userId: string; newPhone: string }
    >({
      queryFn: async ({ userId, newPhone }) => {
        // Check rate limit
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('phone_changed_at')
          .eq('id', userId)
          .single();

        if (profileErr)
          return { error: { status: 'CUSTOM_ERROR' as const, error: profileErr.message } };

        if (profile?.phone_changed_at) {
          const lastChange = new Date(profile.phone_changed_at).getTime();
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          if (Date.now() - lastChange < thirtyDays) {
            const nextDate = new Date(lastChange + thirtyDays);
            return {
              error: {
                status: 'CUSTOM_ERROR' as const,
                error: `Phone number can only be changed once every 30 days. Try again after ${nextDate.toLocaleDateString()}.`,
              },
            };
          }
        }

        // Check if phone is already taken
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', newPhone)
          .neq('id', userId)
          .maybeSingle();

        if (existing) {
          return { error: { status: 'CUSTOM_ERROR' as const, error: 'This phone number is already in use.' } };
        }

        // Request Supabase auth phone change (sends OTP)
        const { error } = await supabase.auth.updateUser({ phone: newPhone });
        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        return { data: { sent: true } };
      },
    }),

    /** Step 2: Verify OTP and sync the new phone to profiles table. */
    verifyPhoneChange: builder.mutation<
      ProfileRow,
      { userId: string; newPhone: string; otp: string }
    >({
      queryFn: async ({ userId, newPhone, otp }) => {
        // Verify OTP with Supabase Auth
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          phone: newPhone,
          token: otp,
          type: 'phone_change',
        });

        if (verifyErr)
          return { error: { status: 'CUSTOM_ERROR' as const, error: verifyErr.message } };

        // Sync new phone to profiles and stamp the rate limit
        const { data, error } = await supabase
          .from('profiles')
          .update({ phone: newPhone, phone_changed_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .single();

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        return { data: data as ProfileRow };
      },
      invalidatesTags: (_result, _error, { userId }) => [{ type: 'Profile', id: userId }],
    }),

    /** Server-validated role switch to driver — validates all docs are approved */
    switchToDriver: builder.mutation<null, string>({
      queryFn: async (userId) => {
        // RPC added in migration 00052 — not yet in generated types
        const { error } = await supabase.rpc('switch_to_driver_role' as any, { p_user_id: userId });
        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: (_result, _error, userId) => [{ type: 'Profile', id: userId }],
    }),

    /** Switch back to rider — no document validation needed */
    switchToRider: builder.mutation<ProfileRow, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('profiles')
          .update({ role: 'rider' })
          .eq('id', userId)
          .select()
          .single();
        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as ProfileRow };
      },
      invalidatesTags: (_result, _error, userId) => [{ type: 'Profile', id: userId }],
    }),
  }),
});

export const {
  useGetMyProfileQuery,
  useGetPublicProfileQuery,
  useUpdateProfileMutation,
  useGetDriverDetailsQuery,
  useGetLatestRiderDocumentQuery,
  useRequestPhoneChangeMutation,
  useVerifyPhoneChangeMutation,
  useSwitchToDriverMutation,
  useSwitchToRiderMutation,
} = profilesApi;
