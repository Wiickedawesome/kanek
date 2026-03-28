import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Notification'],
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationRow[], string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: (data as NotificationRow[]) ?? [] };
      },
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    markNotificationRead: builder.mutation<void, string>({
      queryFn: async (notificationId) => {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    markAllNotificationsRead: builder.mutation<void, string>({
      queryFn: async (userId) => {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    registerPushToken: builder.mutation<void, { userId: string; token: string }>({
      queryFn: async ({ userId, token }) => {
        const { error } = await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', userId);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: undefined };
      },
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useRegisterPushTokenMutation,
} = notificationsApi;
