export const PRIVACY_POLICY_SECTIONS = [
  {
    heading: 'Overview',
    body: 'Kanek ("we", "us", "our") operates the Kanek mobile application. This Privacy Policy describes how we collect, use, and share your personal information when you use our app.',
  },
  {
    heading: '1. Information We Collect',
    body: 'We collect the following categories of information:\n\n• Account information: phone number, name, email address, profile photo, district, and role (rider or driver).\n• Identity verification: government-issued ID photos and selfies for driver verification.\n• Driver documents: driver\'s license, insurance, and vehicle details (make, model, year, color, plate number).\n• Location data: GPS coordinates when you use the app to browse posts, create rides, or share your position during active trips.\n• Transaction data: payment amounts, E-Kyash transaction IDs, and payment status for completed transactions.\n• Usage data: posts created, bookings made, ratings given, messages sent within contracts, and interaction with the feed.\n• Device information: push notification tokens, device type, and operating system version.\n• Emergency contact: an optional phone number you provide for the SOS feature.',
  },
  {
    heading: '2. How We Use Your Information',
    body: 'We use your information to:\n\n• Provide and operate the Kanek service, including displaying your posts to other users and facilitating bookings.\n• Verify your identity for driver accounts.\n• Process payments through E-Kyash and track transaction history.\n• Send push notifications about bookings, messages, and important account updates.\n• Enable the SOS emergency feature, which sends your GPS location to your emergency contact.\n• Calculate and display ratings and trust indicators.\n• Enforce community guidelines through the flagging and strike system.\n• Improve the app and develop new features.',
  },
  {
    heading: '3. Information Sharing',
    body: 'We share your information only as follows:\n\n• With other Kanek users: your name, profile photo, role, rating, district, and posts you create are visible to other users. Your phone number is shared only with users you have an active booking or contract with.\n• With E-Kyash: payment details necessary to process transactions.\n• With service providers: push notification delivery (Expo/FCM/APNs), email delivery (Resend), and map services (Mapbox).\n• For legal compliance: when required by Belizean law, court order, or government request.\n• For safety: when we believe disclosure is necessary to protect the safety of our users or the public.\n\nWe do not sell your personal information to third parties.',
  },
  {
    heading: '4. Data Storage & Security',
    body: 'Your data is stored securely in Supabase cloud infrastructure with row-level security policies. Identity documents are stored in encrypted cloud storage buckets with restricted access. We use industry-standard security measures to protect your data, but no system is 100% secure.',
  },
  {
    heading: '5. Location Data',
    body: 'We collect location data in two ways:\n\n• When browsing: approximate location to show nearby posts and rides within Belize.\n• During active trips: precise GPS location shared with trip participants for live tracking. Background location is used only during active driver trips and can be revoked at any time through your device settings.\n\nLocation data is not stored beyond what is necessary for the services described above.',
  },
  {
    heading: '6. Your Rights',
    body: 'You have the right to:\n\n• Access and review your personal data through the app settings.\n• Update your profile information, including name, email, district, and emergency contact.\n• Request deletion of your account and associated data by contacting us.\n• Revoke location permissions through your device settings.\n• Opt out of non-essential push notifications through the app notification settings.',
  },
  {
    heading: '7. Data Retention',
    body: 'We retain your personal information for as long as your account is active. Posts expire automatically based on their type. Transaction records are retained for the period required by Belizean financial regulations. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law.',
  },
  {
    heading: '8. Children\'s Privacy',
    body: 'Kanek is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children. If we learn that we have collected data from a child under 18, we will promptly delete it.',
  },
  {
    heading: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes through the app. Your continued use of Kanek after changes constitutes acceptance of the updated policy.',
  },
];

export const TERMS_OF_SERVICE_SECTIONS = [
  {
    heading: 'Overview',
    body: 'These Terms of Service ("Terms") govern your use of the Kanek mobile application operated by Kanek ("we", "us", "our"). By using Kanek, you agree to these Terms.',
  },
  {
    heading: '1. What Kanek Is',
    body: 'Kanek is a community mobility board for Belize. It is a platform where users can post and discover rides, errands, deliveries, and jobs. Kanek is NOT a dispatch service. Kanek is NOT a ride-hailing app. We do not employ drivers, assign rides, set prices, or guarantee availability. All arrangements are made directly between users.',
  },
  {
    heading: '2. Eligibility',
    body: 'You must be at least 18 years old and reside in Belize to use Kanek. By creating an account, you represent that you meet these requirements. Driver accounts require identity verification, a valid driver\'s license, insurance, and vehicle registration.',
  },
  {
    heading: '3. Account Responsibilities',
    body: 'You are responsible for:\n\n• Maintaining the accuracy of your profile information.\n• Keeping your phone number current — this is your primary means of authentication.\n• All activity that occurs under your account.\n• Not sharing your account or allowing others to use it.\n\nWe reserve the right to suspend or terminate accounts that violate these Terms.',
  },
  {
    heading: '4. User Conduct',
    body: 'When using Kanek, you agree NOT to:\n\n• Post misleading, false, or fraudulent content.\n• Harass, threaten, or discriminate against other users.\n• Use the platform for illegal activities.\n• Circumvent the platform to avoid fees on transactions initiated through Kanek.\n• Create multiple accounts.\n• Scrape, copy, or redistribute content from the platform.\n• Interfere with the operation of the service.',
  },
  {
    heading: '5. Posts & Content',
    body: 'Users may create posts for rides, errands, package deliveries, and jobs. All posts must:\n\n• Be accurate and truthful.\n• Include valid locations within Belize.\n• Set prices in Belizean Dollars (BZD) at fair market rates.\n• Not contain inappropriate, illegal, or harmful content.\n\nPosts expire automatically. We reserve the right to remove any post that violates these Terms.',
  },
  {
    heading: '6. Payments',
    body: 'Kanek supports cash payments (default) and E-Kyash digital payments in BZD.\n\n• A platform fee of 3% applies to E-Kyash transactions.\n• Users may optionally contribute a community donation with each transaction.\n• Payment disputes between users should be resolved directly between the parties.\n• Refunds for E-Kyash payments are processed through the app when applicable.\n\nKanek is not responsible for cash transactions between users.',
  },
  {
    heading: '7. Ratings & Trust',
    body: 'After completing a booking, users can rate each other. Ratings contribute to trust scores displayed on profiles. You agree to provide honest and fair ratings. Abuse of the rating system (e.g., retaliatory ratings, coordinated rating manipulation) is a violation of these Terms.',
  },
  {
    heading: '8. Flagging & Strikes',
    body: 'Users can flag content or other users for violating community guidelines. Verified violations result in strikes:\n\n• Soft strikes: warnings for minor infractions.\n• Hard strikes: for serious violations, may result in temporary restriction or permanent suspension.\n\nStrike penalties are processed automatically and reviewed by administrators.',
  },
  {
    heading: '9. Safety & SOS',
    body: 'Kanek provides an SOS feature that sends your GPS location to your emergency contact via SMS. This feature is provided as-is and does not replace emergency services. In an emergency, always contact local authorities directly.\n\nKanek is not responsible for the safety of in-person meetings or transactions between users. Use your own judgment and take appropriate precautions.',
  },
  {
    heading: '10. Limitation of Liability',
    body: 'Kanek is provided "as is" without warranties of any kind. We are not liable for:\n\n• Actions, omissions, or conduct of any user.\n• The quality, safety, or legality of posts or services offered.\n• Any loss, injury, or damage arising from your use of the platform or interactions with other users.\n• Interruptions, errors, or data loss in the service.\n\nTo the maximum extent permitted by Belizean law, our total liability to you shall not exceed the amount of platform fees you have paid in the 12 months preceding the claim.',
  },
  {
    heading: '11. Intellectual Property',
    body: 'Kanek and its original content, features, and functionality are owned by Kanek and protected by applicable intellectual property laws. You retain ownership of content you post, but grant us a non-exclusive, worldwide license to display and distribute it within the platform.',
  },
  {
    heading: '12. Termination',
    body: 'You may delete your account at any time through the app or by contacting us. We may suspend or terminate your account at any time for violation of these Terms, with or without notice. Upon termination, your right to use the platform ceases immediately.',
  },
  {
    heading: '13. Governing Law',
    body: 'These Terms are governed by and construed in accordance with the laws of Belize. Any disputes arising from these Terms or your use of Kanek shall be subject to the exclusive jurisdiction of the courts of Belize.',
  },
  {
    heading: '14. Changes to These Terms',
    body: 'We may update these Terms from time to time. We will notify you of significant changes through the app. Your continued use of Kanek after changes constitutes acceptance of the updated Terms.',
  },
];

