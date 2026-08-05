import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider } from '@/providers/AuthProvider';
import { PersistenceProvider } from '@/providers/PersistenceProvider';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ProfitPilot',
  description: 'A financial decision-support tool for leveraged Bitcoin positions on Aave.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <PersistenceProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </PersistenceProvider>
      </body>
    </html>
  );
}
