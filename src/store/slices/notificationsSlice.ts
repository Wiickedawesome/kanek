import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Database } from '@/types/database';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

interface NotificationsState {
  items: NotificationRow[];
}

const initialState: NotificationsState = {
  items: [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<NotificationRow[]>) {
      state.items = action.payload;
    },
    addNotification(state, action: PayloadAction<NotificationRow>) {
      state.items.unshift(action.payload);
      if (state.items.length > 100) {
        state.items = state.items.slice(0, 100);
      }
    },
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item) {
        item.read = true;
      }
    },
    markAllRead(state) {
      state.items.forEach((n) => { n.read = true; });
    },
    clearNotifications(state) {
      state.items = [];
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markRead,
  markAllRead,
  clearNotifications,
} = notificationsSlice.actions;

/** M-12: Derive unread count from items array — single source of truth */
export const selectUnreadCount = (state: { notifications: NotificationsState }) =>
  state.notifications.items.filter((n) => !n.read).length;

export default notificationsSlice.reducer;
