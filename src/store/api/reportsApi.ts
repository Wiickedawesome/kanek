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

interface UpdateGasPriceArgs {
  id: string;
  stationName?: string;
  stationLat?: number;
  stationLng?: number;
  regularCents?: number | null;
  premiumCents?: number | null;
  dieselCents?: number | null;
}

// ≈220m bbox for duplicate detection (0.002 deg ≈ 222m)
const DUPLICATE_DELTA_DEG = 0.002;

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

    /**
     * Create a gas price report, deduplicating against the caller's own nearby
     * reports. If this user already has a record within ~220m AND the station
     * name matches (case-insensitive), the existing row is updated with the
     * new prices. Otherwise a new row is inserted.
     */
    createGasPrice: builder.mutation<GasPriceRow, CreateGasPriceArgs>({
      queryFn: async (args) => {
        const lat = args.stationLat;
        const lng = args.stationLng;
        const nameTrim = args.stationName.trim();
        const nameNorm = nameTrim.toLowerCase();

        const { data: nearby } = await supabase
          .from('gas_prices')
          .select('*')
          .eq('reporter_id', args.reporterId)
          .gte('station_lat', lat - DUPLICATE_DELTA_DEG)
          .lte('station_lat', lat + DUPLICATE_DELTA_DEG)
          .gte('station_lng', lng - DUPLICATE_DELTA_DEG)
          .lte('station_lng', lng + DUPLICATE_DELTA_DEG);

        const duplicate = (nearby ?? []).find(
          (r) => (r.station_name ?? '').trim().toLowerCase() === nameNorm,
        );

        if (duplicate) {
          const { data, error } = await supabase
            .from('gas_prices')
            .update({
              station_name: nameTrim,
              station_lat: lat,
              station_lng: lng,
              regular_cents: args.regularCents ?? null,
              premium_cents: args.premiumCents ?? null,
              diesel_cents: args.dieselCents ?? null,
              reported_at: new Date().toISOString(),
            })
            .eq('id', duplicate.id)
            .select()
            .single();

          if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
          return { data: data as GasPriceRow };
        }

        const { data, error } = await supabase
          .from('gas_prices')
          .insert({
            reporter_id: args.reporterId,
            station_name: nameTrim,
            station_lat: lat,
            station_lng: lng,
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

    updateGasPrice: builder.mutation<GasPriceRow, UpdateGasPriceArgs>({
      queryFn: async (args) => {
        const patch: Record<string, unknown> = {
          reported_at: new Date().toISOString(),
        };
        if (args.stationName !== undefined) patch.station_name = args.stationName.trim();
        if (args.stationLat !== undefined) patch.station_lat = args.stationLat;
        if (args.stationLng !== undefined) patch.station_lng = args.stationLng;
        if (args.regularCents !== undefined) patch.regular_cents = args.regularCents;
        if (args.premiumCents !== undefined) patch.premium_cents = args.premiumCents;
        if (args.dieselCents !== undefined) patch.diesel_cents = args.dieselCents;

        const { data, error } = await supabase
          .from('gas_prices')
          .update(patch)
          .eq('id', args.id)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as GasPriceRow };
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: 'GasPrice', id: arg.id },
        { type: 'GasPrice', id: 'LIST' },
      ],
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
  useUpdateGasPriceMutation,
  useVerifyGasPriceMutation,
} = reportsApi;
