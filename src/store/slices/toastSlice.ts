import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ToastItem {
  title: string;
  body?: string;
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
