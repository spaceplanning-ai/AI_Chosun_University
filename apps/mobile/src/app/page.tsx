import { QrCode } from 'lucide-react';
import { Card } from '@namdo-prism/core/ui';

/**
 * 토큰 없이 접근했을 때의 안내 화면.
 *
 * 이 앱은 QR을 통해서만 의미 있는 화면을 가지므로, 루트에서는 무엇을 해야 하는지만 알린다.
 * 여기에 일정 목록이나 검색을 두면 "개인정보를 저장하지 않는다"는 설계 원칙과 충돌한다.
 */
export default function MobileLandingPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-stage flex-col justify-center gap-md px-md py-lg">
      <Card padding="lg">
        <p className="flex items-center gap-xs text-heading font-bold text-content">
          <QrCode className="size-[1.2em] text-accent" aria-hidden />
          AI 남도 프리즘 여행일정
        </p>
        <p className="mt-sm text-body text-content-muted">
          전시장 키오스크에서 여행일정을 만든 뒤 화면의 QR 코드를 촬영하면, 이 페이지에서
          일자별 일정과 공식 출처를 확인할 수 있습니다.
        </p>
        <p className="mt-md text-caption text-content-subtle">
          별도의 앱 설치나 회원가입이 필요하지 않으며, 개인정보를 수집하지 않습니다.
        </p>
      </Card>
    </main>
  );
}
