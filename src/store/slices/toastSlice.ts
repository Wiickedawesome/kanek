import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ToastItem {
  title: string;
  body?: string;
  /** Notification type — used to pick icon and route on tap */
  notificationType?: string;
  /** Notification payload data — used for routing on tap */
  data?: Record<string, unknown>;
}

interface ToastState {
  queue: ToastItem[];
}

const initialState: ToastState = {
  queue: [],
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<ToastItem>) {
      // Cap queue at 5 to prevent unbounded growth
      if (state.queue.length < 5) {
        state.queue.push(action.payload);
      }
    },
    dismissToast(state) {
      state.queue.shift();
    },
  },
});

export const { showToast, dismissToast } = toastSlice.actions;
/** Select the front toast (currently displayed) */
export const selectCurrentToast = (state: { toast: ToastState }) =>
  state.toast.queue[0] ?? null;
export default toastSlice.reducer;
