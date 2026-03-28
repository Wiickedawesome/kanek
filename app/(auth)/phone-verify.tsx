import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { isValidPhone } from '@/lib/helpers';
import { colors, typography, spacing, borderRadius } from '@/theme';

export default function PhoneVerifyScreen() {
  const { signInWithPhone, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('+501');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpRef = useRef<TextInput>(null);

  const handleSendOtp = async () => {
    if (!isValidPhone(phone)) {
      Alert.alert('Invalid Phone', 'Enter a valid Belize phone number (+501 + 7 digits)');
      return;
    }
    setIsSubmitting(true);
    const { error } = await signInWithPhone(phone);
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setStep('otp');
    setTimeout(() => otpRef.current?.focus(), 100);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid Code', 'Enter the 6-digit code sent to your phone');
      return;
    }
    setIsSubmitting(true);
    const { error } = await verifyOtp(phone, otp);
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.replace('/(auth)/role-select');
  };

  const isPhoneStep = step === 'phone';
  const isOtpStep = step === 'otp';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {isPhoneStep ? 'Enter your number' : 'Verify your number'}
        </Text>
        <Text style={styles.subtitle}>
          {isPhoneStep
            ? 'We\'ll send you a verification code via SMS'
            : `Code sent to ${phone}`}
        </Text>

        {isPhoneStep ? (
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

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={isPhoneStep ? handleSendOtp : handleVerifyOtp}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Please wait...' : isPhoneStep ? 'Send Code' : 'Verify'}
          </Text>
        </Pressable>

        {isOtpStep && (
          <Pressable onPress={() => setStep('phone')} style={styles.backLink}>
            <Text style={styles.backText}>Use a different number</Text>
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
