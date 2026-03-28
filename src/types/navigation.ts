/**
 * Typed route params for Expo Router navigation.
 * Use with router.push() for type-safe navigation.
 */

export type AppRoutes = {
  // Auth flow
  '/(auth)/welcome': undefined;
  '/(auth)/phone-verify': undefined;
  '/(auth)/role-select': undefined;
  '/(auth)/id-upload': { role?: string };
  '/(auth)/driver-docs': undefined;

  // Tabs — Explore
  '/(tabs)/explore': undefined;
  '/(tabs)/explore/[postId]': { postId: string };

  // Tabs — Post
  '/(tabs)/post': undefined;
  '/(tabs)/post/route': { type?: string };
  '/(tabs)/post/errand': undefined;
  '/(tabs)/post/package': undefined;
  '/(tabs)/post/job': undefined;

  // Tabs — Activity
  '/(tabs)/activity': undefined;
  '/(tabs)/activity/[contractId]': { contractId: string };

  // Tabs — Profile
  '/(tabs)/profile': undefined;
  '/(tabs)/profile/settings': undefined;
  '/(tabs)/profile/documents': undefined;
  '/(tabs)/profile/wallet': undefined;
  '/(tabs)/profile/reports': undefined;

  // Modals
  '/modals/sos': undefined;
  '/modals/report-road': undefined;
  '/modals/report-gas': undefined;
  '/modals/rate': { contractId: string; ratedId: string; ratedName?: string };
  '/modals/flag-content': { targetType: string; targetId: string };
  '/modals/payment-select': { contractId: string; amount: string };
  '/modals/ekyash-pay': {
    contractId: string;
    payeeId: string;
    amountCents: string;
    description?: string;
  };
  '/modals/download-map': undefined;
};
