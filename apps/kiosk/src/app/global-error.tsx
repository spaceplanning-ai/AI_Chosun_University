'use client';

/**
 * 루트 레이아웃까지 깨진 경우의 최후 화면.
 * 이 단계에서는 공용 스타일도 로드되지 않을 수 있으므로 인라인 스타일만 쓴다.
 */
export default function KioskGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'grid',
          placeItems: 'center',
          background: '#050b16',
          color: '#ebeff5',
          fontFamily: "'Malgun Gothic', system-ui, sans-serif",
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', margin: '0 0 1rem' }}>
            시스템을 다시 시작해야 합니다
          </h1>
          <p style={{ opacity: 0.75, margin: '0 0 2rem' }}>
            진행자에게 알려 주세요. 아래 버튼으로 복구를 시도할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '4rem',
              padding: '0 2rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#050b16',
              background: '#f2a20c',
              border: 0,
              borderRadius: '1rem',
              cursor: 'pointer',
            }}
          >
            다시 시작
          </button>
          <p style={{ opacity: 0.4, fontSize: '0.8rem', marginTop: '2rem' }}>
            {error.digest ?? error.message}
          </p>
        </div>
      </body>
    </html>
  );
}
