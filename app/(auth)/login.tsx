import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { ENABLE_APPLE_AUTH, ENABLE_EMAIL_AUTH, ENABLE_GOOGLE_AUTH } from '@/lib/constants';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { HCaptcha, type HCaptchaHandle } from '@/components/HCaptcha';

export default function LoginScreen() {
  const { signup } = useLocalSearchParams<{ signup?: string }>();
  const isSignUp = signup === '1';
  const { signInWithEmail, verifyEmailOtp, signInWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [pendingAction, setPendingAction] = useState<'email' | 'google' | 'apple' | null>(null);
  const otpRef = useRef<TextInput>(null);
  const captchaRef = useRef<HCaptchaHandle>(null);
  const isSubmitting = pendingAction !== null;
  const hasSocialAuth = Platform.OS !== 'web' && (ENABLE_GOOGLE_AUTH || ENABLE_APPLE_AUTH);
  const showEmailAuth = ENABLE_EMAIL_AUTH;
  const showSocialAuth = hasSocialAuth;

  const handleSendOtp = async () => {
    if (!showEmailAuth) {
      showAlert('Email Unavailable', 'Email sign-in is temporarily unavailable. Use one of the social sign-in options instead.');
      return;
    }

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showAlert('Invalid Email', 'Enter a valid email address');
      return;
    }

    const captchaToken = captchaRef.current?.getToken() || undefined;

    setPendingAction('email');
    try {
      const { error } = await signInWithEmail(trimmed, captchaToken, isSignUp);
      if (error) {
        captchaRef.current?.resetCaptcha();
        showAlert('Error', error.message === 'Signups not allowed for otp'
          ? 'No account found. Please sign up first.'
          : error.message);
        return;
      }

      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch (err) {
      captchaRef.current?.resetCaptcha();
      showAlert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPendingAction(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!showEmailAuth) {
      showAlert('Email Unavailable', 'Email sign-in is temporarily unavailable. Use one of the social sign-in options instead.');
      return;
    }

    if (otp.length !== 6) {
      showAlert('Invalid Code', 'Enter the 6-digit code');
      return;
    }
    setPendingAction('email');
    const { error } = await verifyEmailOtp(email.trim().toLowerCase(), otp);
    setPendingAction(null);

    if (error) {
      showAlert('Error', error.message);
      return;
    }
    // Navigation is handled by the (auth) layout guard via useOnboardingStatus()
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setPendingAction(provider);
    const { error } = await signInWithProvider(provider);
    setPendingAction(null);

    if (error) {
      showAlert('Sign-In Error', error.message);
    }
  };

  const isInputStep = step === 'input';
  const isOtpStep = step === 'otp';
  const identifier = email.trim().toLowerCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {isInputStep
            ? isSignUp
              ? 'Create your account'
              : 'Welcome back'
            : 'Verify your email'}
        </Text>
        <Text style={styles.subtitle}>
          {isInputStep
            ? showEmailAuth
              ? isSignUp
                ? 'Use email or a connected account to get started'
                : 'Use email or a connected account to sign in'
              : showSocialAuth
                ? 'Use a connected account to sign in'
                : 'Sign-in is temporarily unavailable right now'
            : `Code sent to ${identifier}`}
        </Text>

        {isInputStep && showSocialAuth && (
          <View style={styles.socialSection}>
            {ENABLE_GOOGLE_AUTH && (
              <Button
                title="Continue with Google"
                variant="secondary"
                onPress={() => handleSocialSignIn('google')}
                loading={pendingAction === 'google'}
                disabled={isSubmitting}
                style={styles.socialButton}
              />
            )}

            {ENABLE_APPLE_AUTH && (
              <Button
                title="Continue with Apple"
                variant="outline"
                onPress={() => handleSocialSignIn('apple')}
                loading={pendingAction === 'apple'}
                disabled={isSubmitting}
                style={styles.socialButton}
              />
            )}

            {showEmailAuth && (
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or use email</Text>
                <View style={styles.divider} />
              </View>
            )}
          </View>
        )}

        {showEmailAuth && isInputStep ? (
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor={colors.neutral[400]}
            autoFocus
          />
        ) : showEmailAuth && isOtpStep ? (
          <TextInput
            ref={otpRef}
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor={colors.neutral[400]}
            maxLength={6}
          />
        ) : null}

        {isInputStep && !showEmailAuth && !showSocialAuth && (
          <Text style={styles.unavailableText}>
            Sign-in is temporarily unavailable. Try again after the login providers are configured.
          </Text>
        )}

        {/* Visible hCaptcha checkbox (web only) */}
        {showEmailAuth && isInputStep && <HCaptcha ref={captchaRef} />}

        {showEmailAuth && (
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={isInputStep ? handleSendOtp : handleVerifyOtp}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Please wait...' : isInputStep ? 'Send Code' : 'Verify'}
            </Text>
          </Pressable>
        )}

        {showEmailAuth && isOtpStep && (
          <Pressable onPress={() => { setStep('input'); setOtp(''); }} style={styles.backLink}>
            <Text style={styles.backText}>Use a different email</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  title: {
    ...typography.h1,
    color: colors.forest[900],
  },
  subtitle: {
    ...typography.body1,
    color: colors.neutral[500],
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  socialSection: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  socialButton: {
    width: '100%',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  divider: {
    backgroundColor: colors.neutral[200],
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  unavailableText: {
    ...typography.body2,
    color: colors.neutral[500],
    marginBottom: spacing.xl,
  },
  input: {
    ...typography.h2,
    color: colors.forest[900],
    borderBottomWidth: 2,
    borderBottomColor: colors.forest[600],
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.forest[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body1Bold,
    color: colors.neutral[0],
  },
  backLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  backText: {
    ...typography.body2,
    color: colors.accent.blue,
  },
});
