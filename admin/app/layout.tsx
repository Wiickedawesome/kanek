import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'kanek Admin',
  description: 'Admin panel for kanek — Belize ride-sharing & community board',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-forest-900 antialiased">{children}</body>
    </html>
  );
}
