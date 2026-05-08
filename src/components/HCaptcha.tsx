import {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback } from 'react';
import { View,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';
import { colors, type, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

const SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '';

export interface HCaptchaHandle {
  getToken: () => string;
  resetCaptcha: () => void;
}

/**
 * Native hCaptcha — uses a WebView-based modal to render the challenge.
 * Stores the token after verification; login screen reads it via getToken().
 */
export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
  const captchaRef = useRef<ConfirmHcaptcha>(null);
  const tokenRef = useRef('');
  const [showModal, setShowModal] = useState(false);
  const [verified, setVerified] = useState(false);

  useImperativeHandle(ref, () => ({
    getToken: () => tokenRef.current,
    resetCaptcha: () => {
      tokenRef.current = '';
      setVerified(false);
    },
  }));

  const onMessage = useCallback((event: any) => {
    if (event && event !== 'cancel' && event !== 'error' && event !== 'expired') {
      tokenRef.current = event;
      setVerified(true);
      setShowModal(false);
    } else {
      tokenRef.current = '';
      setVerified(false);
      setShowModal(false);
    }
  }, []);

  if (!SITE_KEY) return null;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.verifyButton, verified && styles.verifiedButton]}
        onPress={() => { if (!verified) setShowModal(true); }}
      >
        <View style={[styles.checkbox, verified && styles.checkboxChecked]}>
          {verified && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.verifyText, verified && styles.verifiedText]}>
          {verified ? 'Verified' : 'Tap to verify'}
        </Text>
      </Pressable>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={() => setShowModal(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
            <ConfirmHcaptcha
              ref={captchaRef}
              siteKey={SITE_KEY}
              size="normal"
              onMessage={onMessage}
              languageCode="en"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

HCaptcha.displayName = 'HCaptcha';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
  },
  verifiedButton: {
    borderColor: colors.accent.green,
    backgroundColor: '#f0fdf4',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.neutral[400],
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.accent.green,
    backgroundColor: colors.accent.green,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  verifyText: {
    ...type.bodySm.regular,
    color: colors.forest[400],
  },
  verifiedText: {
    color: colors.accent.green,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '60%',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  closeButton: {
    padding: spacing.md,
    alignItems: 'flex-end',
  },
  closeText: {
    ...type.bodySm.regular,
    color: colors.accent.blue,
  },
});
