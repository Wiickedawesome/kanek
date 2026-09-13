import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { useGetDriverDocumentsQuery } from '@/store/api/driverDocumentsApi';
import { useGetDriverDetailsQuery, useGetLatestRiderDocumentQuery, useGetMyProfileQuery , useReactivateAccountMutation } from '@/store/api/profilesApi';
import type { RootState } from '@/store';

export function useOnboardingStatus() {
  const { session, isLoading: authLoading } = useSelector((state: RootState) => state.auth);
  const userId = session?.user?.id ?? null;

  const { data: profile, isLoading: profileLoading } = useGetMyProfileQuery(userId ?? '', {
    skip: !userId,
  });

  // Auto-reactivate if user signed back in within 90-day recovery window
  const [reactivateAccount] = useReactivateAccountMutation();
  const hasTriggeredReactivation = useRef(false);
  useEffect(() => {
    if (
      profile?.account_status === 'suspended_pending_deletion' &&
      !hasTriggeredReactivation.current
    ) {
      hasTriggeredReactivation.current = true;
      reactivateAccount();
    }
  }, [profile?.account_status, reactivateAccount]);

  const needsRoleSelection = !!userId && !!profile && (!profile.first_name || !profile.last_name);

  const { data: driverDocs = [], isLoading: driverDocsLoading } = useGetDriverDocumentsQuery(userId ?? '', {
    skip: !userId || !profile || profileLoading || needsRoleSelection,
  });

  const expiredDriverDocDetected = (driverDocs ?? []).some((doc) =>
    doc.expiration_date && doc.expiration_date < new Date().toISOString().slice(0, 10),
  );

  const accountStatusBlocked = profile?.account_status === 'restricted'
    || profile?.account_status === 'suspended'
    || profile?.account_status === 'suspended_pending_deletion';

  useEffect(() => {
    if (!userId || !profile || !expiredDriverDocDetected || profile.account_status === 'restricted') return;
    void supabase.from('profiles').update({ account_status: 'restricted' }).eq('id', userId);
  }, [userId, profile, expiredDriverDocDetected]);

  const { data: riderDocument, isLoading: riderDocumentLoading } = useGetLatestRiderDocumentQuery(
    userId ?? '',
    {
      skip: !userId || !profile || profileLoading || needsRoleSelection,
    },
  );

  const needsIdUpload =
    !!userId &&
    !!profile &&
    !needsRoleSelection &&
    (!riderDocument || riderDocument.review_status === 'rejected');

  const { data: driverDetails, isLoading: driverDetailsLoading } = useGetDriverDetailsQuery(
    userId ?? '',
    {
      skip: !userId || !profile || profileLoading || needsRoleSelection || needsIdUpload || profile.role !== 'driver',
    },
  );

  const needsDriverDocs =
    !!userId &&
    !!profile &&
    profile.role === 'driver' &&
    !needsRoleSelection &&
    !needsIdUpload &&
    (!driverDetails || driverDetails.review_status === 'rejected');

  const isLoading =
    authLoading ||
    (!!userId &&
      (profileLoading ||
        (!needsRoleSelection && riderDocumentLoading) ||
        (!needsRoleSelection && driverDocsLoading) ||
        (profile?.role === 'driver' && !needsRoleSelection && !needsIdUpload && driverDetailsLoading)));

  const nextAuthRoute = !userId || isLoading
    ? null
    : accountStatusBlocked
      ? '/(auth)/welcome'
      : needsRoleSelection
        ? '/(auth)/role-select'
        : needsIdUpload
          ? '/(auth)/id-upload'
          : needsDriverDocs
            ? '/(auth)/driver-docs'
            : null;

  const isIdRejected = riderDocument?.review_status === 'rejected';
  const isIdPending = riderDocument?.review_status === 'pending';
  const isIdApproved = riderDocument?.review_status === 'approved';
  // A pending submission is a draft: the user may keep exploriing the app
  // while an admin reviews. Rejected docs re-open the upload step (retake).

  const isDriverRejected = driverDetails?.review_status === 'rejected';
  const isDriverPending = driverDetails?.review_status === 'pending';
  const isDriverApproved = driverDetails?.review_status === 'approved';

  return {
    session,
    userId,
    profile,
    riderDocument,
    driverDetails,
    accountStatus: profile?.account_status ?? null,
    isIdRejected,
    isIdPending,
    isIdApproved,
    isDriverRejected,
    isDriverPending,
    isDriverApproved,
    isLoading,
    isComplete: !!userId && !nextAuthRoute,
    nextAuthRoute,
  };
}