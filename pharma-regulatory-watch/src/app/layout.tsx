import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pharma Regulatory Watch — Rezon Bio',
  description:
    'Monitoring changes in pharmaceutical industry legal regulations for Rezon Bio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
