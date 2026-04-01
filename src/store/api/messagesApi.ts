import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type MessageRow = Database['public']['Tables']['contract_messages']['Row'];

export interface MessageWithSender extends MessageRow {
  sender?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export const messagesApi = createApi({
  reducerPath: 'messagesApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Message'],
  endpoints: (builder) => ({
    getMessages: builder.query<MessageWithSender[], string>({
      queryFn: async (contractId) => {
        const { data, error } = await supabase
          .from('contract_messages')
          .select('*, sender:profiles!sender_id(first_name, last_name, avatar_url)')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true })
          .limit(200);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as unknown as MessageWithSender[]) ?? [] };
      },
      providesTags: (_res, _err, contractId) => [{ type: 'Message', id: contractId }],
    }),

    sendMessage: builder.mutation<MessageRow, { contractId: string; senderId: string; body: string }>({
      queryFn: async ({ contractId, senderId, body }) => {
        const trimmedBody = body.trim();
        const { data, error } = await supabase
          .from('contract_messages')
          .insert({ contract_id: contractId, sender_id: senderId, body: trimmedBody })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        // Send push notification to the other party (best-effort, don't block on failure)
        try {
          const { data: contract } = await supabase
            .from('contracts')
            .select('parties')
            .eq('id', contractId)
            .single();

          if (contract?.parties) {
            const recipientId = contract.parties.find((id: string) => id !== senderId);
            if (recipientId) {
              const { data: sender } = await supabase
                .from('profiles')
                .select('first_name')
                .eq('id', senderId)
                .single();

              const senderName = sender?.first_name || 'Someone';
              supabase.functions.invoke('send-push', {
                body: {
                  userId: recipientId,
                  title: `${senderName} sent you a message`,
                  body: trimmedBody.length > 100 ? trimmedBody.slice(0, 100) + '…' : trimmedBody,
                  data: { contract_id: contractId },
                },
              });
            }
          }
        } catch {
          // Push is best-effort — don't fail the mutation
        }

        return { data: data as MessageRow };
      },
      invalidatesTags: (_res, _err, { contractId }) => [{ type: 'Message', id: contractId }],
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useSendMessageMutation,
} = messagesApi;
