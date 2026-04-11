import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { sendPushOnly, getCurrentNotificationActor } from '@/lib/notify';
import type { Database } from '@/types/database';
import { getEventLabel } from '@/lib/tripEvents';

type ContractEventRow = Database['public']['Tables']['contract_events']['Row'];

export interface ContractEvent extends ContractEventRow {
  actor?: {
    first_name: string | null;
    last_name: string | null;
  };
}

export const contractEventsApi = createApi({
  reducerPath: 'contractEventsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['ContractEvent'],
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
                data: { contractId, eventType },
              });
            }
          }
        } catch {
          // Push is best-effort
        }
      },
    }),
  }),
});

export const { useGetContractEventsQuery, useCreateContractEventMutation } = contractEventsApi;
