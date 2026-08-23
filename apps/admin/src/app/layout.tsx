import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ADMIN_PRESENTATION, presentationAttributes } from '@namdo-prism/core/design';
import '@namdo-prism/core/styles/fonts.css';
import '@namdo-prism/core/styles/globals.css';

export const metadata: Metadata = {
  title: 'AI 남도 프리즘 — 연구자·검수 화면',
  description:
    '검색문서·검색점수·추천 후보·제외 사유·연계지수·응답시간을 확인하고, 검수 게이트를 자동 판정합니다.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf7f0',
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" {...presentationAttributes(ADMIN_PRESENTATION)}>
      {/*
        주소의 물음표 뒤를 상태처럼 읽고 쓰게 해 주는 어댑터.
        상세 화면이 «어느 항목인지»를 주소에 적어 두므로 앱 전체를 감싼다.
      */}
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
