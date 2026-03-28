import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type CheckinRow = Database['public']['Tables']['driver_checkins']['Row'];

export const checkinsApi = createApi({
  reducerPath: 'checkinsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Checkin'],
  endpoints: (builder) => ({
    /** Get check-in for a specific contract (if exists) */
    getCheckin: builder.query<CheckinRow | null, string>({
      queryFn: async (contractId) => {
        const { data, error } = await supabase
          .from('driver_checkins')
          .select('*')
          .eq('contract_id', contractId)
          .maybeSingle();

        if (error) return { error: { message: error.message } };
        return { data: data ?? null };
      },
      providesTags: (_res, _err, contractId) => [
        { type: 'Checkin', id: contractId },
      ],
    }),

    /** Upload selfie and create check-in record */
    submitCheckin: builder.mutation<
      CheckinRow,
      {
        driverId: string;
        contractId: string;
        imageUri: string;
        lat?: number;
        lng?: number;
      }
    >({
      queryFn: async ({ driverId, contractId, imageUri, lat, lng }) => {
        // Read image file
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const ext = imageUri.split('.').pop() ?? 'jpg';
        const filePath = `${driverId}/${contractId}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('checkin-selfies')
          .upload(filePath, blob, {
            contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
            upsert: true,
          });

        if (uploadError) {
          return { error: { message: uploadError.message } };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('checkin-selfies')
          .getPublicUrl(filePath);

        const selfieUrl = urlData.publicUrl;

        // Insert check-in record
        const { data, error } = await supabase
          .from('driver_checkins')
          .insert({
            driver_id: driverId,
            contract_id: contractId,
            selfie_url: selfieUrl,
            lat: lat ?? null,
            lng: lng ?? null,
          })
          .select()
          .single();

        if (error) return { error: { message: error.message } };
        return { data };
      },
      invalidatesTags: (_res, _err, { contractId }) => [
        { type: 'Checkin', id: contractId },
      ],
    }),
  }),
});

export const { useGetCheckinQuery, useSubmitCheckinMutation } = checkinsApi;
