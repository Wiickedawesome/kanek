import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { ENABLE_APPLE_AUTH, ENABLE_EMAIL_AUTH, ENABLE_GOOGLE_AUTH } from '@/lib/constants';
import { colors, type, spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { HCaptcha, type HCaptchaHandle } from '@/components/HCaptcha';
import { Text } from '@/components/ui/Text';

const LOGO_IMAGE = require('../../assets/icon.png');

export default function LoginScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
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

    if (!captchaRef.current?.isConfigured()) {
      showAlert('Captcha unavailable', 'Email sign-in is blocked until the hCaptcha key is configured.');
      return;
    }

    const captchaToken = captchaRef.current?.getToken() || undefined;
    if (!captchaToken) {
      showAlert('Captcha required', 'Please complete the captcha before requesting a sign-in code.');
      return;
    }

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

  const handleBack = () => {
    if (isOtpStep) {
      setStep('input');
      setOtp('');
      return;
    }
    safeGoBack('/(auth)/welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
      </View>
      <View style={styles.content}>
        <Image source={LOGO_IMAGE} style={styles.loginLogo} accessibilityRole="image" accessibilityLabel="Kanek logo" />
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
            placeholderTextColor={c.textMuted}
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
            placeholderTextColor={c.textMuted}
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
          <Button
            title={isSubmitting ? 'Please wait...' : isInputStep ? 'Send Code' : 'Verify'}
            onPress={isInputStep ? handleSendOtp : handleVerifyOtp}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
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

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: {
    ...type.h1.bold,
    color: c.text,
  },
  subtitle: {
    ...type.body.regular,
    color: c.textMuted,
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
    backgroundColor: c.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  unavailableText: {
    ...type.bodySm.regular,
    color: c.textMuted,
    marginBottom: spacing.xl,
  },
  loginLogo: {
    width: 80,
    height: 80,
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  input: {
    ...type.h2.bold,
    color: c.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.forest[600],
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  backLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  backText: {
    ...type.bodySm.regular,
    color: colors.accent.blue,
  },
});
