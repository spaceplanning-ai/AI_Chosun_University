'use client';

import { useEffect } from 'react';
import { FailureNotice } from '@namdo-prism/core/ui';

/**
 * 렌더 단계에서 던져진 예외의 마지막 방어선.
 *
 * 스토어가 잡아 내지 못한 예외(컴포넌트 렌더 중 오류 등)까지 여기서 받아,
 * 전시장 화면이 Next.js 기본 오류 페이지로 바뀌는 일을 막는다.
 */
export default function KioskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[남도프리즘] 키오스크 렌더 오류', error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center p-lg">
      <FailureNotice
        title="화면을 표시하지 못했습니다"
        description="잠시 후 다시 시도해 주세요. 문제가 계속되면 진행자에게 알려 주세요."
        detail={`${error.message}\n\n${error.digest ?? ''}\n${error.stack ?? ''}`}
        actionLabel="다시 시도"
        onRecover={reset}
      />
    </main>
  );
}
