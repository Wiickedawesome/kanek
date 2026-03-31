import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import notificationsReducer from './slices/notificationsSlice';
import toastReducer from './slices/toastSlice';
import { postsApi } from './api/postsApi';
import { bookingsApi } from './api/bookingsApi';
import { profilesApi } from './api/profilesApi';
import { ratingsApi } from './api/ratingsApi';
import { ekyashApi } from './api/ekyashApi';
import { reportsApi } from './api/reportsApi';
import { notificationsApi } from './api/notificationsApi';
import { checkinsApi } from './api/checkinsApi';
import { messagesApi } from './api/messagesApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    location: locationReducer,
    notifications: notificationsReducer,
    toast: toastReducer,
    [postsApi.reducerPath]: postsApi.reducer,
    [bookingsApi.reducerPath]: bookingsApi.reducer,
    [profilesApi.reducerPath]: profilesApi.reducer,
    [ratingsApi.reducerPath]: ratingsApi.reducer,
    [ekyashApi.reducerPath]: ekyashApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [checkinsApi.reducerPath]: checkinsApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Supabase session contains non-serializable values
        ignoredPaths: ['auth.session'],
        ignoredActions: ['auth/setSession'],
      },
    }).concat(
      postsApi.middleware,
      bookingsApi.middleware,
      profilesApi.middleware,
      ratingsApi.middleware,
      ekyashApi.middleware,
      reportsApi.middleware,
      notificationsApi.middleware,
      checkinsApi.middleware,
      messagesApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
