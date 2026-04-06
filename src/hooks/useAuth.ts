import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/store/slices/authSlice';
import { profilesApi } from '@/store/api/profilesApi';
import { postsApi } from '@/store/api/postsApi';
import { bookingsApi } from '@/store/api/bookingsApi';
import { ratingsApi } from '@/store/api/ratingsApi';
import { ekyashApi } from '@/store/api/ekyashApi';
import { reportsApi } from '@/store/api/reportsApi';
import { notificationsApi } from '@/store/api/notificationsApi';
import { checkinsApi } from '@/store/api/checkinsApi';
import { messagesApi } from '@/store/api/messagesApi';
import type { AppDispatch } from '@/store';

/**
 * Call ONCE at the root layout to bootstrap the session and listen for changes.
 */
export function useAuthListener() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(setSession(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession(session));
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);
}

/**
 * Auth actions — safe to call from any component without duplicating listeners.
 */
export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();

  const signInWithPhone = async (phone: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    return { error };
  };

  const signInWithEmail = async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error };
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error };
  };

  const signOut = async () => {
    // Clear Redux FIRST so navigation redirects immediately
    dispatch(setSession(null));
    dispatch(profilesApi.util.resetApiState());
    dispatch(postsApi.util.resetApiState());
    dispatch(bookingsApi.util.resetApiState());
    dispatch(ratingsApi.util.resetApiState());
    dispatch(ekyashApi.util.resetApiState());
    dispatch(reportsApi.util.resetApiState());
    dispatch(notificationsApi.util.resetApiState());
    dispatch(checkinsApi.util.resetApiState());
    dispatch(messagesApi.util.resetApiState());
    // Clear Supabase session from server + AsyncStorage
    try {
      await supabase.auth.signOut();
    } catch {
      // If signOut fails, nuke the persisted session directly
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = keys.filter((k) => k.startsWith('sb-'));
      if (authKeys.length > 0) await AsyncStorage.multiRemove(authKeys);
    }
  };

  return { signInWithPhone, verifyOtp, signInWithEmail, verifyEmailOtp, signOut };
}
