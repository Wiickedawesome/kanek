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
  keepUnusedDataFor: 120,
  tagTypes: ['RoadReport', 'GasPrice'],
  endpoints: (builder) => ({
    getRoadReports: builder.query<RoadReportRow[], GetRoadReportsArgs | void>({
      queryFn: async (args) => {
        const { lat, lng, radiusKm, limit = 50 } = args ?? {};

        let query = supabase
          .from('road_reports')
          .select('*')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        // H-12: Apply bounding-box filter when location is provided
        if (lat != null && lng != null && radiusKm != null && radiusKm > 0) {
          // Approximate degrees per km at Belize's latitude (~17°N)
          const latDelta = radiusKm / 111;
          const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
          query = query
            .gte('lat', lat - latDelta)
            .lte('lat', lat + latDelta)
            .gte('lng', lng - lngDelta)
            .lte('lng', lng + lngDelta);
        }

        const { data, error } = await query;

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
        // Enforce length limit on description
        const safeDescription = description ? description.slice(0, 500) : null;

        const { data, error } = await supabase
          .from('road_reports')
          .insert({
            reporter_id: reporterId,
            type,
            lat,
            lng,
            description: safeDescription,
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
        const { data, error } = await supabase
          .rpc('upvote_road_report', { report_id: reportId });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as RoadReportRow };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'RoadReport', id }],
    }),

    reportGone: builder.mutation<null, string>({
      queryFn: async (reportId) => {
        const { error } = await supabase
          .rpc('report_road_report_gone', { report_id: reportId });

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
  useGetRoadReportsQuery,
  useCreateRoadReportMutation,
  useUpvoteRoadReportMutation,
  useReportGoneMutation,
  useGetGasPricesQuery,
  useCreateGasPriceMutation,
  useVerifyGasPriceMutation,
} = reportsApi;
