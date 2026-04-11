import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { postsApi } from './postsApi';
import { getCurrentNotificationActor, sendPushOnly } from '@/lib/notify';
import type { Database, BookingStatus, PostType, ContractStatus, PaymentMethod } from '@/types/database';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type ContractRow = Database['public']['Tables']['contracts']['Row'];

/** Booking with booker profile (for post owner view) */
export interface BookingWithUser extends BookingRow {
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    rating_avg: number;
    punctuality_pct: number;
  } | null;
  contract: { id: string }[];
}

/** Booking with its associated contract (for checking if a chat is available) */
export interface BookingWithContract extends BookingRow {
  contract: { id: string }[];
}

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
  contract: { id: string }[];
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

interface AcceptApplicantArgs {
  bookingId: string;
  postId: string;
  applicantId: string;
  postTitle: string;
  postType: PostType;
}

interface RejectApplicantArgs {
  bookingId: string;
  postId: string;
  applicantId: string;
  postTitle: string;
  postType: PostType;
}

interface GetContractsArgs {
  userId: string;
  status?: ContractStatus[];
  limit?: number;
  offset?: number;
}

interface AuthorJoinNotification {
  type: string;
  title: string;
  body: string;
}

function buildAuthorJoinNotification(
  postType: PostType,
  postTitle: string,
  bookerName: string,
  seatsBooked?: number,
): AuthorJoinNotification {
  if (postType === 'route_offer') {
    const seats = seatsBooked ?? 1;
    return {
      type: 'new_applicant',
      title: 'New Rider Request!',
      body: `${bookerName} wants to book ${seats} seat(s) on "${postTitle}". Review and accept.`,
    };
  }

  if (postType === 'route_request') {
    return {
      type: 'new_applicant',
      title: 'Driver Offered!',
      body: `${bookerName} offered to drive your route "${postTitle}". Review and accept.`,
    };
  }

  if (postType === 'job') {
    return {
      type: 'new_applicant',
      title: 'New Applicant!',
      body: `${bookerName} applied for "${postTitle}". Review and accept.`,
    };
  }

  return {
    type: 'new_applicant',
    title: postType === 'package' ? 'New Delivery Offer!' : 'New Errand Helper!',
    body: `${bookerName} offered to handle your ${postType === 'package' ? 'delivery' : 'errand'} "${postTitle}". Review and accept.`,
  };
}

function getAcceptPushMessage(postType: PostType, postTitle: string): { title: string; body: string } {
  switch (postType) {
    case 'route_offer':
      return { title: 'Seat Confirmed!', body: `Your seat on "${postTitle}" has been confirmed.` };
    case 'route_request':
      return { title: 'Drive Accepted!', body: `You were accepted to drive "${postTitle}".` };
    case 'errand':
      return { title: 'Errand Confirmed!', body: `You were accepted for the errand "${postTitle}".` };
    case 'package':
      return { title: 'Delivery Confirmed!', body: `You were accepted to deliver "${postTitle}".` };
    case 'job':
      return { title: 'You Got the Job!', body: `You were accepted for "${postTitle}".` };
    default:
      return { title: 'Accepted!', body: `You were accepted for "${postTitle}".` };
  }
}

function getRejectPushMessage(postType: PostType, postTitle: string): { title: string; body: string } {
  switch (postType) {
    case 'route_offer':
      return { title: 'Seat Request Declined', body: `Your seat request for "${postTitle}" was not accepted.` };
    case 'route_request':
      return { title: 'Drive Offer Declined', body: `Your offer to drive "${postTitle}" was not accepted.` };
    case 'errand':
      return { title: 'Errand Offer Declined', body: `Your offer for the errand "${postTitle}" was not accepted.` };
    case 'package':
      return { title: 'Delivery Offer Declined', body: `Your offer to deliver "${postTitle}" was not accepted.` };
    case 'job':
      return { title: 'Application Declined', body: `Your application for "${postTitle}" was not accepted.` };
    default:
      return { title: 'Not Selected', body: `Your request for "${postTitle}" was not accepted.` };
  }
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
            ),
            contract:contracts!contracts_booking_id_fkey ( id )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (status && status.length > 0) {
          query = query.in('status', status as any);
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

    /** Check if the current user already has an active booking for a post */
    getBookingForPost: builder.query<BookingWithContract | null, { postId: string; userId: string }>({
      queryFn: async ({ postId, userId }) => {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, contract:contracts!contracts_booking_id_fkey(id)')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .in('status', ['pending', 'confirmed'])
          .limit(1)
          .maybeSingle();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as BookingWithContract) ?? null };
      },
      providesTags: (_r, _e, { postId }) => [{ type: 'Booking', id: `POST_${postId}` }],
    }),

    /** Get all active bookings for a post (for post author to see who booked) */
    getPostBookings: builder.query<BookingWithUser[], { postId: string }>({ 
      queryFn: async ({ postId }) => {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            user:profiles_public!bookings_user_id_fkey (
              id, first_name, last_name, avatar_url, rating_avg, punctuality_pct
            ),
            contract:contracts!contracts_booking_id_fkey(id)
          `)
          .eq('post_id', postId)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as BookingWithUser[]) ?? [] };
      },
      providesTags: (_r, _e, { postId }) => [
        { type: 'Booking', id: `POST_${postId}` },
        { type: 'Booking', id: 'LIST' },
      ],
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
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Booking', id: 'LIST' },
        { type: 'Booking', id: `POST_${arg.postId}` },
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Invalidate post cache so feed + detail reflect seat changes / status
          dispatch(postsApi.util.invalidateTags([
            { type: 'Post', id: arg.postId },
            { type: 'Post', id: 'LIST' },
            { type: 'Post', id: 'MY_LIST' },
          ]));

          // DB trigger handles in-app notification; send push only
          const [{ data: post }, actor] = await Promise.all([
            supabase
              .from('posts')
              .select('author_id, title, type')
              .eq('id', data.post_id)
              .maybeSingle(),
            getCurrentNotificationActor(),
          ]);

          if (!post?.author_id || post.author_id === data.user_id) {
            return;
          }

          const bookerName = actor?.name ?? 'Someone';
          const notification = buildAuthorJoinNotification(
            post.type as PostType,
            post.title ?? 'this activity',
            bookerName,
            post.type === 'route_offer' ? (data.seats_booked ?? 1) : undefined,
          );

          await sendPushOnly({
            userId: post.author_id,
            title: notification.title,
            body: notification.body ?? '',
          });
        } catch { /* booking failed, no need to invalidate */ }
      },
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
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Cancellation trigger may revert post status — invalidate post cache
          dispatch(postsApi.util.invalidateTags([
            { type: 'Post', id: data.post_id },
            { type: 'Post', id: 'LIST' },
            { type: 'Post', id: 'MY_LIST' },
          ]));
        } catch { /* cancel failed */ }
      },
    }),

    acceptApplicant: builder.mutation<null, AcceptApplicantArgs>({
      queryFn: async ({ bookingId }) => {
        const { error } = await (supabase.rpc as any)('accept_applicant', { p_booking_id: bookingId });
        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: (_r, _e, { postId }) => [
        { type: 'Booking', id: 'LIST' },
        { type: 'Booking', id: `POST_${postId}` },
        { type: 'Contract', id: 'LIST' },
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(postsApi.util.invalidateTags([
            { type: 'Post', id: arg.postId },
            { type: 'Post', id: 'LIST' },
            { type: 'Post', id: 'MY_LIST' },
          ]));
          // DB RPC already inserted the in-app notification; send push only
          const push = getAcceptPushMessage(arg.postType, arg.postTitle);
          await sendPushOnly({
            userId: arg.applicantId,
            title: push.title,
            body: push.body,
          });
        } catch { /* mutation failed */ }
      },
    }),

    rejectApplicant: builder.mutation<null, RejectApplicantArgs>({
      queryFn: async ({ bookingId }) => {
        const { error } = await (supabase.rpc as any)('reject_applicant', { p_booking_id: bookingId });
        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: (_r, _e, { postId }) => [
        { type: 'Booking', id: 'LIST' },
        { type: 'Booking', id: `POST_${postId}` },
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(postsApi.util.invalidateTags([
            { type: 'Post', id: arg.postId },
            { type: 'Post', id: 'LIST' },
          ]));
          // DB RPC already inserted the in-app notification; send push only
          const push = getRejectPushMessage(arg.postType, arg.postTitle);
          await sendPushOnly({
            userId: arg.applicantId,
            title: push.title,
            body: push.body,
          });
        } catch { /* mutation failed */ }
      },
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
      invalidatesTags: (_r, _e, id) => [
        { type: 'Booking', id },
        { type: 'Booking', id: 'LIST' },
        { type: 'Contract', id: 'LIST' },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(postsApi.util.invalidateTags([
            { type: 'Post', id: data.post_id },
            { type: 'Post', id: 'LIST' },
            { type: 'Post', id: 'MY_LIST' },
          ]));
          // Also invalidate post-specific booking cache
          dispatch(bookingsApi.util.invalidateTags([
            { type: 'Booking', id: `POST_${data.post_id}` },
          ]));
        } catch { /* complete failed */ }
      },
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

  }),
});

export const {
  useGetMyBookingsQuery,
  useGetBookingForPostQuery,
  useGetPostBookingsQuery,
  useCreateBookingMutation,
  useCancelBookingMutation,
  useAcceptApplicantMutation,
  useRejectApplicantMutation,
  useCompleteBookingMutation,
  useGetMyContractsQuery,
  useGetContractByIdQuery,
} = bookingsApi;
