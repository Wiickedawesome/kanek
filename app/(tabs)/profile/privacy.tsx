import React from 'react';
import { LegalScreen } from '@/components/LegalScreen';
import { PRIVACY_POLICY_SECTIONS } from '@/lib/legalContent';

export default function PrivacyPolicyScreen() {
  return (
    <LegalScreen
      backFallback="/(tabs)/profile/"
      title="Privacy Policy"
      sections={PRIVACY_POLICY_SECTIONS}
      lastUpdated="April 23, 2026"
      contactEmail="support@belizechain.org"
    />
  );
}

