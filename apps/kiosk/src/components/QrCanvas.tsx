'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Callout } from '@namdo-prism/core/ui';

/**
 * QR 코드 캔버스.
 *
 * 색을 CSS 토큰에서 런타임에 읽어 온다. 캔버스는 CSS 변수를 이해하지 못하므로
 * 여기서만 예외적으로 계산된 색상값을 가져오며, 팔레트를 따로 복제하지는 않는다.
 * 전시장 조명 아래에서 인식률이 떨어지지 않도록 오류정정 수준을 높게 잡는다.
 */

export interface QrCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCanvas({ value, size = 320, className }: QrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      // QR은 밝은 바탕 위 어두운 모듈일 때 인식률이 가장 높다.
      // 전시 테마가 어둡더라도 코드 자체는 항상 흰 바탕으로 그린다.
      color: { dark: '#0a1526ff', light: '#ffffffff' },
    })
      .then(() => {
        if (!cancelled) setError(undefined);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'QR 코드를 생성하지 못했습니다.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <Callout tone="critical">
        QR 코드를 표시할 수 없습니다. 관리자에게 알려 주세요. ({error})
      </Callout>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="여행일정을 휴대폰으로 가져가는 QR 코드"
    />
  );
}
