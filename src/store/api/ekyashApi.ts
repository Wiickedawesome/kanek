import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import { invokeFunction } from '@/lib/invokeFunction';
import type { CreatePaymentResponse, PaymentStatusResponse } from '@/types/ekyash';
import type { Database } from '@/types/database';

type EkyashTxnRow = Database['public']['Tables']['ekyash_transactions']['Row'];

interface CreatePaymentArgs {
  contractId: string;
  payerId: string;
  payeeId: string;
  amountCents: number;
  description: string;
  payerPhone: string;
}

interface CancelPaymentArgs {
  orderId: string;
}

export const ekyashApi = createApi({
  reducerPath: 'ekyashApi',
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 30,
  tagTypes: ['Payment'],
  endpoints: (builder) => ({
    createPayment: builder.mutation<CreatePaymentResponse, CreatePaymentArgs>({
      queryFn: async (args) => {
        const { data, error } = await invokeFunction<CreatePaymentResponse>('ekyash-create-invoice', {
          body: args,
        });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as CreatePaymentResponse };
      },
      invalidatesTags: [{ type: 'Payment', id: 'LIST' }],
    }),

    getPaymentStatus: builder.query<PaymentStatusResponse, string>({
      queryFn: async (orderId) => {
        const { data, error } = await supabase
          .from('ekyash_transactions')
          .select('status, transaction_id')
          .eq('order_id', orderId)
          .single();

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };

        return {
          data: {
            status: data.status,
            transactionId: data.transaction_id,
          } as PaymentStatusResponse,
        };
      },
      providesTags: (_result, _error, orderId) => [{ type: 'Payment', id: orderId }],
    }),

    cancelPayment: builder.mutation<{ success: boolean }, CancelPaymentArgs>({
      queryFn: async ({ orderId }) => {
        const { data, error } = await invokeFunction<{ success: boolean }>('ekyash-cancel-invoice', {
          body: { orderId },
        });

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: data as { success: boolean } };
      },
      invalidatesTags: (_result, _error, { orderId }) => [{ type: 'Payment', id: orderId }],
    }),

    getPaymentHistory: builder.query<EkyashTxnRow[], string>({
      queryFn: async (userId) => {
        // Validate userId format to prevent filter injection
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          return { error: { status: 'CUSTOM_ERROR' as const, error: 'Invalid user ID' } };
        }

        const { data, error } = await supabase
          .from('ekyash_transactions')
          .select('*')
          .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as EkyashTxnRow[]) ?? [] };
      },
      providesTags: [{ type: 'Payment', id: 'LIST' }],
    }),
  }),
});

export const {
  useCreatePaymentMutation,
  useGetPaymentStatusQuery,
  useCancelPaymentMutation,
  useGetPaymentHistoryQuery,
} = ekyashApi;
