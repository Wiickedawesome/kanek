import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Button, ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { LocationInput } from '@/components/forms/LocationInput';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import {
  useGetMyProfileQuery,
  useGetLatestRiderDocumentQuery,
  useUpdateProfileMutation,
  useSwitchToDriverMutation,
  useSwitchToRiderMutation,
  useRequestPhoneChangeMutation,
  useVerifyPhoneChangeMutation,
  useDeleteAccountMutation,
} from '@/store/api/profilesApi';
import {
  useGetDriverDocumentsQuery,
  areAllDriverDocsApproved,
  REQUIRED_DRIVER_DOCS,
  DRIVER_DOC_LABELS,
} from '@/store/api/driverDocumentsApi';
import { isValidPhone, normalizePhone, safeGoBack } from '@/lib/helpers';
import { useAuth } from '@/hooks/useAuth';
import type { RootState } from '@/store';
import type { Role, BelizeDistrict } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { Text } from '@/components/ui/Text';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BELIZE_DISTRICTS: { value: BelizeDistrict; label: string }[] = [
  { value: 'belize', label: 'Belize' },
  { value: 'cayo', label: 'Cayo' },
  { value: 'corozal', label: 'Corozal' },
  { value: 'orange_walk', label: 'Orange Walk' },
  { value: 'stann_creek', label: 'Stann Creek' },
  { value: 'toledo', label: 'Toledo' },
];

export default function SettingsScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile, isLoading } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const { data: riderDocument } = useGetLatestRiderDocumentQuery(userId ?? '', { skip: !userId });
  const { data: driverDocs = [] } = useGetDriverDocumentsQuery(userId ?? '', { skip: !userId });
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [switchToDriver] = useSwitchToDriverMutation();
  const [switchToRider] = useSwitchToRiderMutation();
  const [requestPhoneChange, { isLoading: isRequestingPhone }] = useRequestPhoneChangeMutation();
  const [verifyPhoneChange, { isLoading: isVerifyingPhone }] = useVerifyPhoneChangeMutation();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();
  const { signOut } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [role, setRole] = useState<Role>('rider');
  const [district, setDistrict] = useState<BelizeDistrict | null>(null);
  const [addressLine, setAddressLine] = useState('');

  // Phone change state
  const [newPhone, setNewPhone] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');
  const [phoneError, setPhoneError] = useState('');

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? '');
      setLastName(profile.last_name ?? '');
      setEmail(profile.email ?? '');
      setEmergencyContact(profile.emergency_contact ?? '');
      setRole(profile.role);
      setDistrict(profile.district ?? null);
      setAddressLine(profile.address_line ?? '');
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!userId) return;

    const normalizedEmergencyContact = emergencyContact.trim().toLowerCase();
    if (normalizedEmergencyContact && !EMAIL_REGEX.test(normalizedEmergencyContact)) {
      showAlert(
        'Invalid Emergency Contact',
        'Emergency contact must be a valid email address. The contact will not be saved, but your other changes will be.',
      );
    }

    const validContact = normalizedEmergencyContact && EMAIL_REGEX.test(normalizedEmergencyContact)
      ? normalizedEmergencyContact
      : null;

    if (!firstName.trim() || !lastName.trim()) {
      showAlert('Name Required', 'First name and last name are both required.');
      return;
    }

    try {
      await updateProfile({
        id: userId,
        updates: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          emergency_contact: validContact,
          district,
          address_line: addressLine.trim() || null,
        },
      }).unwrap();

      // Handle role change separately via server-validated RPCs
      const currentRole = profile?.role;
      if (role !== currentRole) {
        if (role === 'driver') {
          await switchToDriver(userId).unwrap();
        } else {
          await switchToRider(userId).unwrap();
        }
      }

      showAlert('Saved', 'Your profile has been updated.');
    } catch (err) {
      console.error('[Settings] Save failed:', err);
      showAlert('Error', 'Could not save profile. Please try again.');
    }
  }, [userId, firstName, lastName, email, emergencyContact, role, district, addressLine, updateProfile, switchToDriver, switchToRider, profile?.role]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  const isPhoneInputStep = phoneStep === 'input';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/(tabs)/profile/')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}>
        <View style={styles.field}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor={c.textMuted}
            autoCapitalize="words"
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor={c.textMuted}
            autoCapitalize="words"
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={c.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={254}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Emergency Contact Email</Text>
          <TextInput
            style={styles.input}
            value={emergencyContact}
            onChangeText={setEmergencyContact}
            placeholder="family@example.com"
            placeholderTextColor={c.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={254}
          />
        </View>

        {/* District selector */}
        <View style={styles.field}>
          <Text style={styles.label}>District</Text>
          <View style={styles.districtGrid}>
            {BELIZE_DISTRICTS.map((d) => (
              <Pressable
                key={d.value}
                style={[styles.districtBtn, district === d.value && styles.districtBtnActive]}
                onPress={() => setDistrict(d.value)}
              >
                <Text style={[styles.districtBtnText, district === d.value && styles.districtBtnTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Trips in your district will appear first.</Text>
        </View>

        <LocationInput
          label="Address"
          value={addressLine}
          onChangeText={setAddressLine}
          placeholder="e.g. 21 Burns Ave, San Ignacio"
        />

        {/* Role selector */}
        <View style={styles.field}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleBtn, role === 'rider' && styles.roleBtnActive]}
              onPress={() => setRole('rider')}
            >
              <Text style={[styles.roleBtnText, role === 'rider' && styles.roleBtnTextActive]}>
                Rider
              </Text>
            </Pressable>
            <Pressable
              style={[styles.roleBtn, role === 'driver' && styles.roleBtnActive]}
              onPress={() => {
                const govIdApproved = riderDocument?.review_status === 'approved';
                const driverDocsOk = areAllDriverDocsApproved(driverDocs);

                if (!govIdApproved || !driverDocsOk) {
                  const missing: string[] = [];
                  if (!govIdApproved) missing.push('Government ID');
                  for (const dt of REQUIRED_DRIVER_DOCS) {
                    const doc = driverDocs.find((d) => d.document_type === dt);
                    if (!doc || doc.review_status !== 'approved') {
                      missing.push(DRIVER_DOC_LABELS[dt]);
                    }
                  }
                  showAlert(
                    'Documents Required',
                    `The following documents must be uploaded and approved before switching to driver:\n\n${missing.map((m) => `• ${m}`).join('\n')}\n\nGo to My Documents to upload them.`,
                  );
                  return;
                }
                setRole('driver');
              }}
            >
              <Text style={[styles.roleBtnText, role === 'driver' && styles.roleBtnTextActive]}>
                Driver
              </Text>
            </Pressable>
          </View>
          {role === 'driver' && profile?.role !== 'driver' && (
            <Text style={[styles.driverNote, { color: colors.accent.green }]}>
              All documents approved — you can switch to driver.
            </Text>
          )}
        </View>

        {/* Phone number — changeable with OTP verification */}
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <View style={[styles.input, styles.phoneInput]}>
              <Text style={styles.phoneText}>
                {profile?.phone && profile.phone.startsWith('+') ? profile.phone : '—'}
              </Text>
            </View>
            <Pressable
              style={styles.changeBtn}
              onPress={() => {
                setNewPhone('');
                setPhoneOtp('');
                setPhoneStep('input');
                setPhoneError('');
                setShowPhoneModal(true);
              }}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Can be changed once every 30 days.</Text>
        </View>

        <Button
          title={isSaving ? 'Saving...' : 'Save Changes'}
          onPress={handleSave}
          disabled={isSaving}
        />

        {/* Delete Account */}
        <Pressable
          style={styles.deleteBtn}
          onPress={() => {
            setDeleteConfirmText('');
            setShowDeleteModal(true);
          }}
        >
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      {/* Phone Change Modal */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isPhoneInputStep ? 'Change Phone Number' : 'Verify New Number'}
            </Text>

            {isPhoneInputStep ? (
              <>
                <Text style={styles.modalDesc}>
                  Enter your new Belize phone number. You can enter just the 7 digits.
                </Text>
                <View style={styles.phoneInputRow}>
                  <Text style={styles.phonePrefix}>+501</Text>
                  <TextInput
                    style={[styles.input, styles.phoneModalInput]}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="600 0000"
                    placeholderTextColor={c.textMuted}
                    keyboardType="phone-pad"
                    autoFocus
                    maxLength={15}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  Enter the 6-digit code sent to {newPhone}.
                </Text>
                <TextInput
                  style={styles.input}
                  value={phoneOtp}
                  onChangeText={setPhoneOtp}
                  placeholder="000000"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </>
            )}

            {phoneError ? <Text style={styles.phoneErrorText}>{phoneError}</Text> : null}

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowPhoneModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              {isPhoneInputStep ? (
                <Button
                  title={isRequestingPhone ? 'Sending...' : 'Send Code'}
                  onPress={async () => {
                    if (!userId) return;
                    setPhoneError('');
                    const normalized = normalizePhone(newPhone);
                    if (!normalized || !isValidPhone(normalized)) {
                      setPhoneError('Enter a valid Belize number (+501 followed by 7 digits).');
                      return;
                    }
                    if (normalized === profile?.phone) {
                      setPhoneError('This is already your current number.');
                      return;
                    }
                    try {
                      await requestPhoneChange({ userId, newPhone: normalized }).unwrap();
                      setNewPhone(normalized);
                      setPhoneStep('verify');
                    } catch (err: any) {
                      setPhoneError(err?.error || err?.data || 'Failed to send code. Try again later.');
                    }
                  }}
                  disabled={isRequestingPhone}
                />
              ) : (
                <Button
                  title={isVerifyingPhone ? 'Verifying...' : 'Verify'}
                  onPress={async () => {
                    if (!userId) return;
                    setPhoneError('');
                    if (phoneOtp.length !== 6) {
                      setPhoneError('Enter the 6-digit code.');
                      return;
                    }
                    try {
                      await verifyPhoneChange({ userId, newPhone, otp: phoneOtp }).unwrap();
                      setShowPhoneModal(false);
                      showAlert('Phone Updated', 'Your phone number has been changed successfully.');
                    } catch (err: any) {
                      setPhoneError(err?.error || err?.data || 'Invalid code. Please try again.');
                    }
                  }}
                  disabled={isVerifyingPhone}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalDesc}>
              Your account will be deactivated immediately. You have 90 days to sign back in to recover it. After 90 days your personal info is removed, and after 1 year all data is permanently deleted.
            </Text>
            <Text style={styles.modalDesc}>
              Type <Text style={{ fontWeight: '700', color: colors.error }}>DELETE</Text> to confirm.
            </Text>
            <TextInput
              style={[styles.input, { borderColor: deleteConfirmText === 'DELETE' ? colors.error : colors.neutral[300] }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.deleteConfirmBtn,
                  deleteConfirmText !== 'DELETE' && styles.deleteConfirmBtnDisabled,
                ]}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                onPress={async () => {
                  try {
                    await deleteAccount().unwrap();
                    setShowDeleteModal(false);
                    await signOut();
                  } catch (err: any) {
                    showAlert('Delete Failed', err?.error || err?.data || 'Could not delete account. Try again later.');
                  }
                }}
              >
                <Text style={[
                  styles.deleteConfirmBtnText,
                  deleteConfirmText !== 'DELETE' && { opacity: 0.5 },
                ]}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...type.h3.bold, color: c.text, flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.lg },

  field: { gap: spacing.xs },
  label: { ...type.bodySm.bold, color: c.textMuted },
  input: {
    ...type.body.regular,
    color: c.text,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputDisabled: { backgroundColor: c.bg },
  disabledText: { ...type.body.regular, color: c.textMuted },
  hint: { ...type.caption.regular, color: c.textMuted },

  roleRow: { flexDirection: 'row', gap: spacing.md },
  roleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  roleBtnActive: { borderColor: colors.accent.green, backgroundColor: 'rgba(81, 193, 82, 0.18)' },
  roleBtnText: { ...type.body.bold, color: c.textMuted },
  roleBtnTextActive: { color: colors.accent.green },
  driverNote: { ...type.caption.regular, color: colors.warning, marginTop: spacing.xs },

  districtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  districtBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  districtBtnActive: {
    borderColor: colors.accent.green,
    backgroundColor: 'rgba(81, 193, 82, 0.18)',
  },
  districtBtnText: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  districtBtnTextActive: {
    color: colors.accent.green,
    fontWeight: '600',
  },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phoneInput: { flex: 1 },
  phoneText: { ...type.body.regular, color: c.text },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phonePrefix: { ...type.body.bold, color: c.text },
  phoneModalInput: { flex: 1 },
  changeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.green,
  },
  changeBtnText: { ...type.bodySm.bold, color: colors.accent.green },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { ...type.h3.bold, color: c.text },
  modalDesc: { ...type.bodySm.regular, color: c.textMuted },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.sm },
  modalCancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  modalCancelText: { ...type.bodySm.bold, color: c.textMuted },
  phoneErrorText: { ...type.caption.regular, color: colors.error },

  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    marginTop: spacing.lg,
  },
  deleteBtnText: { ...type.body.bold, color: colors.error },
  deleteConfirmBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  deleteConfirmBtnDisabled: {
    backgroundColor: c.border,
  },
  deleteConfirmBtnText: { ...type.bodySm.bold, color: c.textInverse },
});
