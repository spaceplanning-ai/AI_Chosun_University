'use client';

import { useEffect } from 'react';
import { FailureNotice } from '@namdo-prism/core/ui';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[남도프리즘] 렌더 오류', error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center p-lg">
      <FailureNotice
        detail={`${error.message}\n\n${error.stack ?? ''}`}
        actionLabel="다시 시도"
        onRecover={reset}
      />
    </main>
  );
}
