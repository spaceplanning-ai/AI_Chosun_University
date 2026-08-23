import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { decodeHandoff } from '@namdo-prism/core/lib';
import { Card } from '@namdo-prism/core/ui';
import { MobileItinerary } from '@/components/MobileItinerary';

/**
 * QR 결과 페이지.
 *
 * 일정 전체가 주소에 담겨 있으므로 데이터베이스 조회가 없다.
 * 다만 그 대가로 잘못된/잘린 QR을 만날 수 있어, 복호화 실패를 정상 경로로 다룬다.
 */

export default async function HandoffPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = decodeHandoff(token);

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-stage flex-col justify-center gap-md px-md py-lg">
        <Card padding="lg">
          <p className="flex items-center gap-xs text-heading font-bold text-critical">
            <TriangleAlert className="size-[1.2em]" aria-hidden />
            일정을 불러오지 못했습니다
          </p>
          <p className="mt-sm text-body text-content-muted">
            QR 코드가 일부만 인식되었거나 손상된 주소일 수 있습니다. 키오스크 화면에서 QR을 다시
            촬영해 주세요.
          </p>
          <Link
            href="/"
            className="mt-md inline-flex min-h-control-md items-center justify-center rounded-control bg-surface-raised px-lg text-subhead font-semibold text-content surface-outline"
          >
            안내 화면으로
          </Link>
        </Card>
      </main>
    );
  }

  // 갱신일 판정 기준일은 서버 렌더 시점의 날짜를 쓴다.
  // 클라이언트에서 계산하면 하이드레이션 시점에 따라 값이 흔들릴 수 있다.
  const referenceDate = new Date().toISOString().slice(0, 10);

  return <MobileItinerary payload={payload} referenceDate={referenceDate} />;
}
