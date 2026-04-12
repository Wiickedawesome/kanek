import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { captureError } from '@/lib/sentry';
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
  keepUnusedDataFor: 30,
  endpoints: (builder) => ({
    getMessages: builder.query<MessageWithSender[], string>({
      queryFn: async (contractId) => {
        const { data, error } = await supabase
          .from('contract_messages')
          .select('*, sender:profiles_public!sender_id(first_name, last_name, avatar_url)')
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
        if (trimmedBody.length === 0 || trimmedBody.length > 500) {
          return { error: { status: 'CUSTOM_ERROR' as const, error: 'Message must be 1-500 characters' } };
        }

        const { data, error } = await supabase
          .from('contract_messages')
          .insert({ contract_id: contractId, sender_id: senderId, body: trimmedBody })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        // Send push notification to the other party (best-effort, don't block on failure)
        try {
          const [{ data: contract }, { data: sender }] = await Promise.all([
            supabase
              .from('contracts')
              .select('parties')
              .eq('id', contractId)
              .single(),
            supabase
              .from('profiles')
              .select('first_name')
              .eq('id', senderId)
              .single(),
          ]);

          if (contract?.parties) {
            const recipientId = contract.parties.find((id: string) => id !== senderId);
            if (recipientId) {
              const senderName = sender?.first_name || 'Someone';
              const { error: pushError } = await supabase.functions.invoke('send-push', {
                body: {
                  userId: recipientId,
                  title: `${senderName} sent you a message`,
                  body: trimmedBody.length > 100 ? trimmedBody.slice(0, 100) + '…' : trimmedBody,
                  data: { contract_id: contractId },
                },
              });
              if (pushError) captureError(pushError, { context: 'sendMessage.push', contractId });
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
