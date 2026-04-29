import { Redirect } from 'expo-router';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

export default function Index() {
  const { session, isLoading, nextAuthRoute } = useOnboardingStatus();

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (nextAuthRoute) return <Redirect href={nextAuthRoute as any} />;

  return <Redirect href="/(tabs)/explore" />;
}
