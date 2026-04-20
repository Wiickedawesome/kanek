import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

interface CreateGasPriceArgs {
  reporterId: string;
  stationName: string;
  stationLat: number;
  stationLng: number;
  regularCents?: number;
  premiumCents?: number;
  dieselCents?: number;
}

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 120,
  tagTypes: ['GasPrice'],
  endpoints: (builder) => ({
    getGasPrices: builder.query<GasPriceRow[], number | void>({
      queryFn: async (limit) => {
        const { data, error } = await supabase
          .from('gas_prices')
          .select('*')
          .order('reported_at', { ascending: false })
          .limit(limit ?? 50);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as GasPriceRow[]) ?? [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'GasPrice' as const, id })),
              { type: 'GasPrice', id: 'LIST' },
            ]
          : [{ type: 'GasPrice', id: 'LIST' }],
    }),

    createGasPrice: builder.mutation<GasPriceRow, CreateGasPriceArgs>({
      queryFn: async (args) => {
        const { data, error } = await supabase
          .from('gas_prices')
          .insert({
            reporter_id: args.reporterId,
            station_name: args.stationName,
            station_lat: args.stationLat,
            station_lng: args.stationLng,
            regular_cents: args.regularCents ?? null,
            premium_cents: args.premiumCents ?? null,
            diesel_cents: args.dieselCents ?? null,
          })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as GasPriceRow };
      },
      invalidatesTags: [{ type: 'GasPrice', id: 'LIST' }],
    }),

    verifyGasPrice: builder.mutation<GasPriceRow, string>({
      queryFn: async (priceId) => {
        const { data, error } = await supabase
          .rpc('verify_gas_price', { price_id: priceId });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as GasPriceRow };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'GasPrice', id }],
    }),
  }),
});

export const {
  useGetGasPricesQuery,
  useCreateGasPriceMutation,
  useVerifyGasPriceMutation,
} = reportsApi;
