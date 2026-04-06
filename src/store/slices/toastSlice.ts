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
  current: ToastItem | null;
}

const initialState: ToastState = {
  current: null,
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<ToastItem>) {
      state.current = action.payload;
    },
    dismissToast(state) {
      state.current = null;
    },
  },
});

export const { showToast, dismissToast } = toastSlice.actions;
export default toastSlice.reducer;
