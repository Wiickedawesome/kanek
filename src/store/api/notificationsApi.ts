import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Notification'],
  endpoints: (builder) => ({
    getUnreadCount: builder.query<number, string>({
      queryFn: async (userId) => {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: count ?? 0 };
      },
      providesTags: [{ type: 'Notification', id: 'COUNT' }],
    }),

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

    markNotificationRead: builder.mutation<null, string>({
      queryFn: async (notificationId) => {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }, { type: 'Notification', id: 'COUNT' }],
    }),

    markAllNotificationsRead: builder.mutation<null, string>({
      queryFn: async (userId) => {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }, { type: 'Notification', id: 'COUNT' }],
    }),

    registerPushToken: builder.mutation<null, { userId: string; token: string }>({
      queryFn: async ({ userId, token }) => {
        const { error } = await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', userId);

        if (error) return { error: { status: 'CUSTOM_ERROR' as const, error: error.message } };
        return { data: null };
      },
    }),
  }),
});

export const {
  useGetUnreadCountQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useRegisterPushTokenMutation,
} = notificationsApi;
