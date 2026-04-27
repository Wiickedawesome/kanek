import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { consumeAuthRedirectUrl, getOAuthRedirectUrl } from '@/lib/authRedirect';
import { setSession } from '@/store/slices/authSlice';
import { clearNotifications } from '@/store/slices/notificationsSlice';
import { dismissToast } from '@/store/slices/toastSlice';
import { resetLocation } from '@/store/slices/locationSlice';
import { profilesApi } from '@/store/api/profilesApi';
import { postsApi } from '@/store/api/postsApi';
import { bookingsApi } from '@/store/api/bookingsApi';
import { ratingsApi } from '@/store/api/ratingsApi';
import { ekyashApi } from '@/store/api/ekyashApi';
import { reportsApi } from '@/store/api/reportsApi';
import { notificationsApi } from '@/store/api/notificationsApi';
import { checkinsApi } from '@/store/api/checkinsApi';
import { messagesApi } from '@/store/api/messagesApi';
import { contractEventsApi } from '@/store/api/contractEventsApi';
import { driverDocumentsApi } from '@/store/api/driverDocumentsApi';
import type { AppDispatch } from '@/store';

type AppAuthResult = {
  error: { message: string } | null;
};

export type SocialAuthProvider = 'google' | 'apple';

/**
 * Call ONCE at the root layout to bootstrap the session and listen for changes.
 */
export function useAuthListener() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        dispatch(setSession(session));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession(session));
    });

    Linking.getInitialURL()
      .then(async (url) => {
        if (!url) return;
        await consumeAuthRedirectUrl(url);
      })
      .catch(() => undefined);

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      consumeAuthRedirectUrl(url).catch(() => undefined);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [dispatch]);
}

/**
 * Auth actions — safe to call from any component without duplicating listeners.
 */
export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();

  const signInWithEmail = async (
    email: string,
    captchaToken?: string,
    shouldCreateUser = true,
  ): Promise<AppAuthResult> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { ...(captchaToken ? { captchaToken } : {}), shouldCreateUser },
    });
    return { error: error ? { message: error.message } : null };
  };

  const verifyEmailOtp = async (email: string, token: string): Promise<AppAuthResult> => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error: error ? { message: error.message } : null };
  };

  const signInWithProvider = async (provider: SocialAuthProvider): Promise<AppAuthResult> => {
    const redirectTo = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error: { message: error.message } };
    }

    if (!data?.url) {
      return { error: { message: 'The sign-in provider did not return an authorization URL.' } };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      return { error: { message: 'Sign-in was cancelled before completion.' } };
    }

    const authResult = await consumeAuthRedirectUrl(result.url);
    return { error: authResult.error };
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
    dispatch(contractEventsApi.util.resetApiState());
    dispatch(driverDocumentsApi.util.resetApiState());
    // Clear sync slices
    dispatch(clearNotifications());
    dispatch(dismissToast());
    dispatch(resetLocation());
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

  return { signInWithEmail, verifyEmailOtp, signInWithProvider, signOut };
}
