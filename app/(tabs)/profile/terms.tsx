import React from 'react';
import { LegalScreen } from '@/components/LegalScreen';
import { TERMS_OF_SERVICE_SECTIONS } from '@/lib/legalContent';

export default function TermsOfServiceScreen() {
	return (
		<LegalScreen
			backFallback="/(tabs)/profile/"
			title="Terms of Service"
			sections={TERMS_OF_SERVICE_SECTIONS}
			lastUpdated="April 23, 2026"
			contactEmail="support@belizechain.org"
		/>
	);
}
