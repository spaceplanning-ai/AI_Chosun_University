import type { Metadata, Viewport } from 'next';
import { MOBILE_PRESENTATION, presentationAttributes } from '@namdo-prism/core/design';
import '@namdo-prism/core/styles/globals.css';

export const metadata: Metadata = {
  title: 'AI 남도 프리즘 — 내 여행일정',
  description: '키오스크에서 만든 광주·전남 여행일정을 휴대폰에서 확인합니다.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf7f0',
};

export default function MobileRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" {...presentationAttributes(MOBILE_PRESENTATION)}>
      <body>{children}</body>
    </html>
  );
}
