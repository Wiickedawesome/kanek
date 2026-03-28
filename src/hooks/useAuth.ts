import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { setSession, setLoading } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(setSession(session));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession(session));
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  const signInWithPhone = async (phone: string) => {
    dispatch(setLoading(true));
    const { error } = await supabase.auth.signInWithOtp({ phone });
    dispatch(setLoading(false));
    return { error };
  };

  const verifyOtp = async (phone: string, token: string) => {
    dispatch(setLoading(true));
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    dispatch(setLoading(false));
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { signInWithPhone, verifyOtp, signOut };
}
