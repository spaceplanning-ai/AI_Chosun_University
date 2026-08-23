'use client';

import { useMemo } from 'react';
import { ChevronLeft, ScanLine, ShieldCheck } from 'lucide-react';
import { buildHandoffPayload, buildHandoffUrl, encodeHandoff } from '@namdo-prism/core/lib';
import { Badge, Button, Card } from '@namdo-prism/core/ui';
import { MOBILE_BASE_URL } from '@/config/runtime';
import { useKiosk } from '@/state/kioskStore';
import { QrCanvas } from './QrCanvas';

/**
 * QR 모바일 연계 화면 (제안서 6.6).
 *
 * QR에는 서버 주소와 조회 토큰이 아니라 일정 자체(관광지 id 목록)가 들어간다.
 * 전시장이 오프라인이어도 관람객의 휴대폰이 결과를 열 수 있어야 하기 때문이며,
 * 그 덕분에 개인정보는 물론 어떤 서버 기록도 남지 않는다.
 */

export function HandoffScreen() {
  const itinerary = useKiosk((state) => state.itinerary);
  const generation = useKiosk((state) => state.generation);
  const sessionToken = useKiosk((state) => state.sessionToken);
  const backToResult = useKiosk((state) => state.backToResult);
  const reset = useKiosk((state) => state.reset);

  const handoffUrl = useMemo(() => {
    if (!itinerary || !generation) return undefined;
    const payload = buildHandoffPayload(itinerary, generation.trace.conditions, sessionToken);
    return buildHandoffUrl(encodeHandoff(payload), MOBILE_BASE_URL);
  }, [itinerary, generation, sessionToken]);

  if (!itinerary || !handoffUrl) return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-lg py-lg text-center">
      <Badge tone="accent" icon={ScanLine}>
        휴대폰으로 가져가기
      </Badge>

      <h2 className="text-title font-bold text-content text-balance-safe">
        카메라로 QR을 비추면
        <br />
        여행일정이 휴대폰에 열립니다
      </h2>

      <Card padding="md" elevation="raised" className="bg-white">
        <QrCanvas value={handoffUrl} size={300} />
      </Card>

      <div className="flex flex-col items-center gap-2xs">
        <p className="text-body text-content-muted text-balance-safe">
          {itinerary.title}
        </p>
        <p className="text-caption text-content-subtle" data-numeric="">
          세션 코드 {sessionToken}
        </p>
      </div>

      <p className="flex max-w-[42ch] items-start gap-xs rounded-card bg-surface-sunken p-md text-caption text-content-muted">
        <ShieldCheck className="mt-[0.15em] size-[1.2em] shrink-0 text-positive" aria-hidden />
        <span className="text-left">
          이름·연락처 등 개인정보는 수집하지 않습니다. QR에는 방문지 목록과 시각만 담기며,
          별도의 서버 조회 없이 휴대폰에서 바로 열립니다.
        </span>
      </p>

      <div className="flex w-full max-w-[28rem] flex-col gap-sm">
        <Button variant="quiet" size="md" iconLeft={ChevronLeft} onClick={backToResult}>
          일정으로 돌아가기
        </Button>
        <Button variant="ghost" size="sm" onClick={reset}>
          처음 화면으로
        </Button>
      </div>
    </div>
  );
}
