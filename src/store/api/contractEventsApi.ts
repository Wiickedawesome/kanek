import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { sendPushOnly, getCurrentNotificationActor } from '@/lib/notify';
import { postsApi } from './postsApi';
import type { Database, PostType } from '@/types/database';
import { getEventLabel } from '@/lib/tripEvents';

type ContractEventRow = Database['public']['Tables']['contract_events']['Row'];

export interface ContractEvent extends ContractEventRow {
  actor?: {
    first_name: string | null;
    last_name: string | null;
  };
}

/** Per-rider trip status for the driver manage screen */
export interface PostTripContract {
  contractId: string;
  bookingId: string;
  riderId: string;
  riderFirstName: string | null;
  riderLastName: string | null;
  riderAvatar: string | null;
  seatsBooked: number;
  paymentMethod: 'cash' | 'ekyash' | null;
  completedEventTypes: string[];
}

export const contractEventsApi = createApi({
  reducerPath: 'contractEventsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['ContractEvent', 'PostTrip'],
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
    getContractEvents: builder.query<ContractEvent[], string>({
      queryFn: async (contractId) => {
        const { data, error } = await supabase
          .from('contract_events')
          .select('*, actor:profiles_public!actor_id(first_name, last_name)')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as ContractEvent[]) ?? [] };
      },
      providesTags: (_res, _err, contractId) => [{ type: 'ContractEvent', id: contractId }],
    }),

    createContractEvent: builder.mutation<
      ContractEventRow,
      { contractId: string; actorId: string; eventType: string; note?: string }
    >({
      queryFn: async ({ contractId, actorId, eventType, note }) => {
        const { data, error } = await supabase
          .from('contract_events')
          .insert({
            contract_id: contractId,
            actor_id: actorId,
            event_type: eventType,
            note: note ?? null,
          })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data };
      },
      invalidatesTags: (_res, _err, { contractId }) => [{ type: 'ContractEvent', id: contractId }],
      async onQueryStarted({ contractId, actorId, eventType }, { queryFulfilled }) {
        try {
          await queryFulfilled;

          // Send push notification to the other party (best-effort)
          const { data: contract } = await supabase
            .from('contracts')
            .select('parties')
            .eq('id', contractId)
            .single();

          if (contract?.parties) {
            const recipientId = contract.parties.find((id: string) => id !== actorId);
            if (recipientId) {
              const actor = await getCurrentNotificationActor();
              const label = getEventLabel(eventType);
              await sendPushOnly({
                userId: recipientId,
                title: actor?.name ?? 'Trip Update',
                body: label,
                type: 'contract_event',
                data: { contractId, eventType },
              });
            }
          }
        } catch {
          // Push is best-effort
        }
      },
    }),

    /**
     * Get every active contract for a given post together with its rider
     * profile and the set of event types already completed on each.
     * Used by the driver-side Manage Trip screen.
     */
    getPostTripContracts: builder.query<PostTripContract[], string>({
      queryFn: async (postId) => {
        const { data, error } = await supabase
          .from('contracts')
          .select(`
            id,
            status,
            booking:bookings!inner (
              id,
              user_id,
              seats_booked,
              payment_method,
              user:profiles_public!user_id (
                id,
                first_name,
                last_name,
                avatar_url
              )
            ),
            events:contract_events ( event_type )
          `)
          .eq('post_id', postId)
          .eq('status', 'active');

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        type Row = {
          id: string;
          booking: {
            id: string;
            user_id: string;
            seats_booked: number | null;
            payment_method: 'cash' | 'ekyash' | null;
            user: {
              id: string;
              first_name: string | null;
              last_name: string | null;
              avatar_url: string | null;
            } | null;
          } | null;
          events: { event_type: string }[] | null;
        };

        const rows = (data ?? []) as unknown as Row[];
        const mapped: PostTripContract[] = rows
          .filter((r) => r.booking)
          .map((r) => ({
            contractId: r.id,
            bookingId: r.booking!.id,
            riderId: r.booking!.user_id,
            riderFirstName: r.booking!.user?.first_name ?? null,
            riderLastName: r.booking!.user?.last_name ?? null,
            riderAvatar: r.booking!.user?.avatar_url ?? null,
            seatsBooked: r.booking!.seats_booked ?? 1,
            paymentMethod: r.booking!.payment_method,
            completedEventTypes: (r.events ?? []).map((e) => e.event_type),
          }));
        return { data: mapped };
      },
      providesTags: (_r, _e, postId) => [{ type: 'PostTrip' as const, id: postId }],
    }),

    /**
     * Record a single trip event across every active contract on a post
     * simultaneously. Sends one push per rider. Used by the driver-side
     * Manage Trip screen so the driver advances the trip for everyone at
     * once instead of per booking.
     */
    bulkCreateContractEventForPost: builder.mutation<
      { inserted: number },
      { postId: string; actorId: string; eventType: string; postType: PostType; note?: string }
    >({
      queryFn: async ({ postId, actorId, eventType, note }) => {
        const { data: contracts, error: loadErr } = await supabase
          .from('contracts')
          .select('id, parties')
          .eq('post_id', postId)
          .eq('status', 'active');

        if (loadErr) return { error: { status: 'CUSTOM_ERROR' as const, error: loadErr.message } };
        if (!contracts || contracts.length === 0) {
          return { error: { status: 'CUSTOM_ERROR' as const, error: 'No active contracts on this trip.' } };
        }

        const rows = contracts.map((c) => ({
          contract_id: c.id,
          actor_id: actorId,
          event_type: eventType,
          note: note ?? null,
        }));

        const { error: insertErr } = await supabase.from('contract_events').insert(rows);
        if (insertErr) return { error: { status: 'CUSTOM_ERROR' as const, error: insertErr.message } };

        // Trip has started — move post out of the public feed and reject any
        // lingering pending applicants. Only transition from a pre-trip state
        // (`open` or `filled`) so we don't clobber `completed`/`cancelled`.
        // Safe to attempt on every event: the `.in('status', [...])` guard
        // makes subsequent calls a no-op.
        try {
          await supabase
            .from('posts')
            .update({ status: 'in_progress', updated_at: new Date().toISOString() })
            .eq('id', postId)
            .in('status', ['open', 'filled']);

          await supabase
            .from('bookings')
            .update({
              status: 'rejected',
              cancel_reason: 'Trip already started',
              updated_at: new Date().toISOString(),
            })
            .eq('post_id', postId)
            .eq('status', 'pending');
        } catch {
          // Non-fatal — event was still recorded.
        }

        // Best-effort push notifications — one per rider.
        try {
          const actor = await getCurrentNotificationActor();
          const label = getEventLabel(eventType);
          await Promise.all(
            contracts.map(async (c) => {
              const recipientId = (c.parties ?? []).find((p: string) => p !== actorId);
              if (!recipientId) return;
              await sendPushOnly({
                userId: recipientId,
                title: actor?.name ?? 'Trip Update',
                body: label,
                type: 'contract_event',
                data: { contractId: c.id, eventType },
              });
            }),
          );
        } catch {
          // ignore push failures
        }

        return { data: { inserted: rows.length } };
      },
      invalidatesTags: (_r, _e, { postId }) => [
        { type: 'PostTrip' as const, id: postId },
        { type: 'ContractEvent' as const, id: 'LIST' },
      ],
      async onQueryStarted({ postId }, { queryFulfilled, dispatch }) {
        try {
          await queryFulfilled;
          // Individual contract event caches are keyed by contractId. We can't
          // know all ids here without a second fetch, so rely on the explicit
          // refetch users do when navigating — or the realtime subscription.
          dispatch(
            contractEventsApi.util.invalidateTags([{ type: 'PostTrip', id: postId }]),
          );
          // The mutation may have transitioned the post to `in_progress` and
          // rejected pending bookings. Refresh post + booking caches so the
          // Explore feed and Activity "My Posts" list update immediately.
          dispatch(
            postsApi.util.invalidateTags([
              { type: 'Post', id: postId },
              { type: 'Post', id: 'LIST' },
              { type: 'Post', id: 'MY_LIST' },
            ]),
          );
        } catch {
          // handled by RTK Query
        }
      },
    }),
  }),
});

export const {
  useGetContractEventsQuery,
  useCreateContractEventMutation,
  useGetPostTripContractsQuery,
  useBulkCreateContractEventForPostMutation,
} = contractEventsApi;
