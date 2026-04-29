import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: '📋 手順書作成システム',
  description: '業務手順書を作成・管理・共有するシステム',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 min-h-screen">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
