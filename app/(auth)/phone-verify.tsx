import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { isValidPhone } from '@/lib/helpers';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { HCaptcha, type HCaptchaHandle } from '@/components/HCaptcha';

type AuthMode = 'phone' | 'email';

export default function PhoneVerifyScreen() {
  const { signInWithPhone, verifyOtp, signInWithEmail, verifyEmailOtp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('phone');
  const [phone, setPhone] = useState('+501');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpRef = useRef<TextInput>(null);
  const captchaRef = useRef<HCaptchaHandle>(null);

  const handleSendOtp = async () => {
    if (mode === 'phone') {
      if (!isValidPhone(phone)) {
        showAlert('Invalid Phone', 'Enter a valid Belize phone number (+501 + 7 digits)');
        return;
      }
    } else {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        showAlert('Invalid Email', 'Enter a valid email address');
        return;
      }
    }

    const captchaToken = captchaRef.current?.getToken() || undefined;

    setIsSubmitting(true);
    if (mode === 'phone') {
      const { error } = await signInWithPhone(phone, captchaToken);
      setIsSubmitting(false);
      if (error) {
        captchaRef.current?.resetCaptcha();
        showAlert('Error', error.message);
        return;
      }
    } else {
      const { error } = await signInWithEmail(email.trim().toLowerCase(), captchaToken);
      setIsSubmitting(false);
      if (error) {
        captchaRef.current?.resetCaptcha();
        showAlert('Error', error.message);
        return;
      }
    }
    setStep('otp');
    setTimeout(() => otpRef.current?.focus(), 100);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      showAlert('Invalid Code', 'Enter the 6-digit code');
      return;
    }
    setIsSubmitting(true);
    const { error } = mode === 'phone'
      ? await verifyOtp(phone, otp)
      : await verifyEmailOtp(email.trim().toLowerCase(), otp);
    setIsSubmitting(false);

    if (error) {
      showAlert('Error', error.message);
      return;
    }
    router.replace('/(auth)/role-select');
  };

  const handleSwitchMode = () => {
    setMode(mode === 'phone' ? 'email' : 'phone');
    setStep('input');
    setOtp('');
  };

  const isInputStep = step === 'input';
  const isOtpStep = step === 'otp';
  const identifier = mode === 'phone' ? phone : email;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {isInputStep
            ? mode === 'phone' ? 'Enter your number' : 'Enter your email'
            : 'Verify your account'}
        </Text>
        <Text style={styles.subtitle}>
          {isInputStep
            ? mode === 'phone'
              ? 'We\'ll send you a verification code via SMS'
              : 'We\'ll send you a verification code via email'
            : `Code sent to ${identifier}`}
        </Text>

        {isInputStep ? (
          mode === 'phone' ? (
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+5016001234"
              placeholderTextColor={colors.neutral[400]}
              maxLength={12}
              autoFocus
            />
          ) : (
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
          )
        ) : (
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
        )}

        {/* Visible hCaptcha widget (web only) */}
        <View nativeID="hcaptcha-mount" style={[styles.captchaWrap, !isInputStep && { display: 'none' }]} />
        <HCaptcha ref={captchaRef} />

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={isInputStep ? handleSendOtp : handleVerifyOtp}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Please wait...' : isInputStep ? 'Send Code' : 'Verify'}
          </Text>
        </Pressable>

        {isOtpStep && (
          <Pressable onPress={() => { setStep('input'); setOtp(''); }} style={styles.backLink}>
            <Text style={styles.backText}>
              {mode === 'phone' ? 'Use a different number' : 'Use a different email'}
            </Text>
          </Pressable>
        )}

        {isInputStep && (
          <Pressable onPress={handleSwitchMode} style={styles.backLink}>
            <Text style={styles.backText}>
              {mode === 'phone' ? 'Use email instead' : 'Use phone number instead'}
            </Text>
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
  input: {
    ...typography.h2,
    color: colors.forest[900],
    borderBottomWidth: 2,
    borderBottomColor: colors.forest[600],
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  captchaWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    minHeight: 78,
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
