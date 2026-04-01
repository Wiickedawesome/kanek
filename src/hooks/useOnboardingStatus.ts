import { useSelector } from 'react-redux';
import { useGetDriverDetailsQuery, useGetLatestRiderDocumentQuery, useGetMyProfileQuery } from '@/store/api/profilesApi';
import type { RootState } from '@/store';

export function useOnboardingStatus() {
  const { session, isLoading: authLoading } = useSelector((state: RootState) => state.auth);
  const userId = session?.user?.id ?? null;

  const { data: profile, isLoading: profileLoading } = useGetMyProfileQuery(userId ?? '', {
    skip: !userId,
  });

  const needsRoleSelection = !!userId && !!profile && !profile.first_name;

  const { data: riderDocument, isLoading: riderDocumentLoading } = useGetLatestRiderDocumentQuery(
    userId ?? '',
    {
      skip: !userId || !profile || profileLoading || needsRoleSelection,
    },
  );

  const needsIdUpload = !!userId && !!profile && !needsRoleSelection && !riderDocument;

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
    !driverDetails;

  const isLoading =
    authLoading ||
    (!!userId &&
      (profileLoading ||
        (!needsRoleSelection && riderDocumentLoading) ||
        (profile?.role === 'driver' && !needsRoleSelection && !needsIdUpload && driverDetailsLoading)));

  const nextAuthRoute = !userId || isLoading
    ? null
    : needsRoleSelection
      ? '/(auth)/role-select'
      : needsIdUpload
        ? '/(auth)/id-upload'
        : needsDriverDocs
          ? '/(auth)/driver-docs'
          : null;

  return {
    session,
    userId,
    profile,
    riderDocument,
    driverDetails,
    accountStatus: profile?.account_status ?? null,
    isLoading,
    isComplete: !!userId && !nextAuthRoute,
    nextAuthRoute,
  };
}