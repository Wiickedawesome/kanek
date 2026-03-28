import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database, BookingStatus, PostType, ContractStatus, PaymentMethod } from '@/types/database';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type ContractRow = Database['public']['Tables']['contracts']['Row'];

/** Booking with related post title and author info */
export interface BookingWithPost extends BookingRow {
  post: {
    id: string;
    title: string;
    type: PostType;
    origin_address: string | null;
    dest_address: string | null;
    departure_at: string | null;
    price_cents: number | null;
    author_id: string;
  } | null;
}

/** Contract with post + booking + party profiles */
export interface ContractWithDetails extends ContractRow {
  post: {
    id: string;
    title: string;
    type: PostType;
    origin_address: string | null;
    origin_lat: number | null;
    origin_lng: number | null;
    dest_address: string | null;
    dest_lat: number | null;
    dest_lng: number | null;
    route_geometry: Record<string, unknown> | null;
    author_id: string;
  } | null;
  booking: {
    id: string;
    user_id: string;
    role: 'rider' | 'driver';
    seats_booked: number;
    payment_method: PaymentMethod | null;
  } | null;
}

interface GetBookingsArgs {
  userId: string;
  status?: BookingStatus[];
  limit?: number;
  offset?: number;
}

interface CreateBookingArgs {
  postId: string;
  userId: string;
  role: 'rider' | 'driver';
  seatsBooked?: number;
  paymentMethod?: PaymentMethod;
}

interface CancelBookingArgs {
  bookingId: string;
  reason?: string;
}

interface GetContractsArgs {
  userId: string;
  status?: ContractStatus[];
  limit?: number;
  offset?: number;
}

export const bookingsApi = createApi({
  reducerPath: 'bookingsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Booking', 'Contract'],
  endpoints: (builder) => ({
    getMyBookings: builder.query<BookingWithPost[], GetBookingsArgs>({
      queryFn: async ({ userId, status, limit = 20, offset = 0 }) => {
        let query = supabase
          .from('bookings')
          .select(`
            *,
            post:posts (
              id, title, type, origin_address, dest_address, departure_at, price_cents, author_id
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (status && status.length > 0) {
          query = query.in('status', status);
        }

        const { data, error } = await query;

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as BookingWithPost[]) ?? [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Booking' as const, id })),
              { type: 'Booking', id: 'LIST' },
            ]
          : [{ type: 'Booking', id: 'LIST' }],
    }),

    createBooking: builder.mutation<BookingRow, CreateBookingArgs>({
      queryFn: async ({ postId, userId, role, seatsBooked = 1, paymentMethod }) => {
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            post_id: postId,
            user_id: userId,
            role,
            seats_booked: seatsBooked,
            payment_method: paymentMethod ?? null,
          })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as BookingRow };
      },
      invalidatesTags: [{ type: 'Booking', id: 'LIST' }],
    }),

    confirmBooking: builder.mutation<BookingRow, string>({
      queryFn: async (bookingId) => {
        const { data, error } = await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', bookingId)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as BookingRow };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'Booking', id }, { type: 'Booking', id: 'LIST' }],
    }),

    cancelBooking: builder.mutation<BookingRow, CancelBookingArgs>({
      queryFn: async ({ bookingId, reason }) => {
        const { data, error } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: reason ?? null,
          })
          .eq('id', bookingId)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as BookingRow };
      },
      invalidatesTags: (_r, _e, { bookingId }) => [
        { type: 'Booking', id: bookingId },
        { type: 'Booking', id: 'LIST' },
      ],
    }),

    completeBooking: builder.mutation<BookingRow, string>({
      queryFn: async (bookingId) => {
        const { data, error } = await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', bookingId)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as BookingRow };
      },
      invalidatesTags: (_r, _e, id) => [{ type: 'Booking', id }, { type: 'Booking', id: 'LIST' }],
    }),

    // --- Contract endpoints ---

    getMyContracts: builder.query<ContractWithDetails[], GetContractsArgs>({
      queryFn: async ({ userId, status, limit = 20, offset = 0 }) => {
        let query = supabase
          .from('contracts')
          .select(`
            *,
            post:posts (
              id, title, type, origin_address, origin_lat, origin_lng,
              dest_address, dest_lat, dest_lng, route_geometry, author_id
            ),
            booking:bookings (
              id, user_id, role, seats_booked, payment_method
            )
          `)
          .contains('parties', [userId])
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (status && status.length > 0) {
          query = query.in('status', status);
        }

        const { data, error } = await query;

        if (error)
          return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as ContractWithDetails[]) ?? [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Contract' as const, id })),
              { type: 'Contract', id: 'LIST' },
            ]
          : [{ type: 'Contract', id: 'LIST' }],
    }),

    getContractById: builder.query<ContractWithDetails, string>({
      queryFn: async (contractId) => {
        const { data, error } = await supabase
          .from('contracts')
          .select(`
            *,
            post:posts (
              id, title, type, origin_address, origin_lat, origin_lng,
              dest_address, dest_lat, dest_lng, route_geometry, author_id
            ),
            booking:bookings (
              id, user_id, role, seats_booked, payment_method
            )
          `)
          .eq('id', contractId)
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as unknown as ContractWithDetails };
      },
      providesTags: (_r, _e, id) => [{ type: 'Contract', id }],
    }),

    createContract: builder.mutation<
      ContractRow,
      Database['public']['Tables']['contracts']['Insert']
    >({
      queryFn: async (contract) => {
        const { data, error } = await supabase
          .from('contracts')
          .insert(contract)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as ContractRow };
      },
      invalidatesTags: [{ type: 'Contract', id: 'LIST' }],
    }),

    completeContract: builder.mutation<ContractRow, string>({
      queryFn: async (contractId) => {
        const { data, error } = await supabase
          .from('contracts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', contractId)
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as ContractRow };
      },
      invalidatesTags: (_r, _e, id) => [
        { type: 'Contract', id },
        { type: 'Contract', id: 'LIST' },
        { type: 'Booking', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetMyBookingsQuery,
  useCreateBookingMutation,
  useConfirmBookingMutation,
  useCancelBookingMutation,
  useCompleteBookingMutation,
  useGetMyContractsQuery,
  useGetContractByIdQuery,
  useCreateContractMutation,
  useCompleteContractMutation,
} = bookingsApi;
