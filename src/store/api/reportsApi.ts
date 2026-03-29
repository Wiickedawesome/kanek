import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database, RoadReportType } from '@/types/database';

type RoadReportRow = Database['public']['Tables']['road_reports']['Row'];
type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

interface GetRoadReportsArgs {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
}

interface CreateRoadReportArgs {
  reporterId: string;
  type: RoadReportType;
  lat: number;
  lng: number;
  description?: string;
}

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
  tagTypes: ['RoadReport', 'GasPrice'],
  endpoints: (builder) => ({
    getRoadReports: builder.query<RoadReportRow[], GetRoadReportsArgs | void>({
      queryFn: async (args) => {
        const { limit = 50 } = args ?? {};

        const { data, error } = await supabase
          .from('road_reports')
          .select('*')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as RoadReportRow[]) ?? [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'RoadReport' as const, id })),
              { type: 'RoadReport', id: 'LIST' },
            ]
          : [{ type: 'RoadReport', id: 'LIST' }],
    }),

    createRoadReport: builder.mutation<RoadReportRow, CreateRoadReportArgs>({
      queryFn: async ({ reporterId, type, lat, lng, description }) => {
        const { data, error } = await supabase
          .from('road_reports')
          .insert({
            reporter_id: reporterId,
            type,
            lat,
            lng,
            description: description ?? null,
          })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as RoadReportRow };
      },
      invalidatesTags: [{ type: 'RoadReport', id: 'LIST' }],
    }),

    upvoteRoadReport: builder.mutation<RoadReportRow, string>({
      queryFn: async (reportId) => {
        const { data: current, error: fetchErr } = await supabase
          .from('road_reports')
          .select('upvotes')
          .eq('id', reportId)
          .single();

        if (fetchErr)
          return { error: { status: 'CUSTOM_ERROR' as const, error: fetchErr.message } };

        const { data, error } = await supabase
          .from('road_reports')
          .update({ upvotes: (current?.upvotes ?? 0) + 1 })
          .eq('id', reportId)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as RoadReportRow };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'RoadReport', id }],
    }),

    reportGone: builder.mutation<null, string>({
      queryFn: async (reportId) => {
        const { data: current, error: fetchErr } = await supabase
          .from('road_reports')
          .select('gone_count')
          .eq('id', reportId)
          .single();

        if (fetchErr)
          return { error: { status: 'CUSTOM_ERROR' as const, error: fetchErr.message } };

        const newCount = (current?.gone_count ?? 0) + 1;

        if (newCount >= 3) {
          const { error: delErr } = await supabase
            .from('road_reports')
            .delete()
            .eq('id', reportId);
          if (delErr)
            return { error: { status: 'CUSTOM_ERROR' as const, error: delErr.message } };
          return { data: null };
        }

        const { error } = await supabase
          .from('road_reports')
          .update({ gone_count: newCount })
          .eq('id', reportId);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: [{ type: 'RoadReport', id: 'LIST' }],
    }),

    // --- Gas prices ---

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
        const { data: current, error: fetchErr } = await supabase
          .from('gas_prices')
          .select('verified_count')
          .eq('id', priceId)
          .single();

        if (fetchErr)
          return { error: { status: 'CUSTOM_ERROR' as const, error: fetchErr.message } };

        const { data, error } = await supabase
          .from('gas_prices')
          .update({ verified_count: (current?.verified_count ?? 0) + 1 })
          .eq('id', priceId)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as GasPriceRow };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'GasPrice', id }],
    }),
  }),
});

export const {
  useGetRoadReportsQuery,
  useCreateRoadReportMutation,
  useUpvoteRoadReportMutation,
  useReportGoneMutation,
  useGetGasPricesQuery,
  useCreateGasPriceMutation,
  useVerifyGasPriceMutation,
} = reportsApi;
