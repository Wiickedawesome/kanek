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
        const { data, error } = await supabase
          .from('contract_messages')
          .insert({ contract_id: contractId, sender_id: senderId, body: body.trim() })
          .select()
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
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
