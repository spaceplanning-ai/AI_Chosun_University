import type { Metadata, Viewport } from 'next';
import { KIOSK_PRESENTATION, presentationAttributes } from '@namdo-prism/core/design';
import '@namdo-prism/core/styles/fonts.css';
import '@namdo-prism/core/styles/globals.css';

export const metadata: Metadata = {
  title: 'AI 남도 프리즘 — 광주·전남 초광역 관광 큐레이션',
  description:
    '여행조건을 고르면 공식 관광자료를 근거로 광주와 전남을 잇는 일정을 만들고, 추천 이유와 근거문서를 함께 보여 주는 설명가능 AI 키오스크입니다.',
  applicationName: 'AI 남도 프리즘',
  // 전시 시제품이므로 검색엔진 수집을 막는다 (피드백 6장 공개 제한).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050b16',
};

export default function KioskRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" {...presentationAttributes(KIOSK_PRESENTATION)}>
      <body>{children}</body>
    </html>
  );
}
