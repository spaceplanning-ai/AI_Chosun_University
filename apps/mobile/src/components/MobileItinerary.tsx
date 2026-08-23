'use client';

import { useState } from 'react';
import { ChevronRight, Image as ImageIcon, Phone, Share2 } from 'lucide-react';
import { getDocumentsFor, requireAttraction } from '@namdo-prism/core/data';
import { assessTrust } from '@namdo-prism/core/domain/linkage-recommendation';
import {
  COMPANION_LABELS,
  DURATION_LABELS,
  REGION_LABELS,
  TRANSPORT_LABELS,
} from '@namdo-prism/core/domain';
import type { HandoffPayload } from '@namdo-prism/core/lib';
import { formatDuration } from '@namdo-prism/core/lib';
import { SourceList, TrustPanel } from '@namdo-prism/core/ui/evidence';
import { Badge, Button, Callout, Card, Sheet } from '@namdo-prism/core/ui';
import { StopCard, TravelCardSheet } from '@namdo-prism/core/ui/itinerary';

/**
 * QR로 넘어온 여행일정 (제안서 6.6).
 *
 * QR에는 관광지 id 와 시각만 들어 있고, 이름·주소·연락처·공식 출처는
 * 이 앱이 자기 번들에 가진 데이터에서 복원한다.
 * 따라서 서버 왕복이 없고, 키오스크가 오프라인이어도 관람객 휴대폰에서는 정상 동작한다.
 */

export interface MobileItineraryProps {
  payload: HandoffPayload;
  /** 갱신일 판정 기준일. 페이지가 열린 날짜를 서버에서 계산해 넘긴다. */
  referenceDate: string;
}

export function MobileItinerary({ payload, referenceDate }: MobileItineraryProps) {
  const [detailAttractionId, setDetailAttractionId] = useState<string>();
  const [shareMessage, setShareMessage] = useState<string>();
  const [cardOpen, setCardOpen] = useState(false);

  const [companion, duration, transport] = payload.c;
  const [walkingLoad, travelMinutes, , , averageTrust, linkageScore] = payload.m;

  /**
   * QR에는 관광지 id 와 시각만 들어 있으므로, 카드가 필요로 하는 최소 형태로만 옮긴다.
   * 없는 값(추천 근거·후보 점수)을 지어내지 않기 위해 좁은 타입을 쓴다.
   */
  const cardItinerary = {
    title: payload.ti,
    subtitle: payload.st,
    days: payload.d.map((day, index) => ({
      title: `${index + 1}일차`,
      stops: day.map(([attractionId, startMinutes]) => ({ attractionId, startMinutes })),
    })),
    metrics: {
      linkageScore,
      averageTrust,
      travelMinutes,
      stopsByRegion: payload.d.flat().reduce(
        (counts, [attractionId]) => {
          counts[requireAttraction(attractionId).region] += 1;
          return counts;
        },
        { gwangju: 0, jeonnam: 0 },
      ),
    },
  };
  const detail = detailAttractionId ? requireAttraction(detailAttractionId) : undefined;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: payload.ti, text: payload.st, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMessage('링크를 복사했습니다.');
    } catch {
      // 사용자가 공유창을 닫은 경우까지 오류로 알릴 필요는 없다.
      setShareMessage('공유를 완료하지 못했습니다. 주소창의 링크를 복사해 주세요.');
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-stage flex-col gap-lg px-md py-lg">
      <header className="flex flex-col gap-sm">
        <Badge tone="accent">AI 남도 프리즘</Badge>
        <h1 className="text-title font-bold text-content text-balance-safe">{payload.ti}</h1>
        <p className="text-body text-content-muted">{payload.st}</p>
        <p className="flex flex-wrap gap-2xs">
          <Badge size="sm" tone="neutral">
            {COMPANION_LABELS[companion]}
          </Badge>
          <Badge size="sm" tone="neutral">
            {DURATION_LABELS[duration]}
          </Badge>
          <Badge size="sm" tone="neutral">
            {TRANSPORT_LABELS[transport]}
          </Badge>
          <Badge size="sm" tone="neutral">
            {payload.o} 출발
          </Badge>
        </p>
      </header>

      <Card padding="md" elevation="flat" className="bg-surface-sunken">
        <dl className="grid grid-cols-2 gap-sm text-caption">
          <div>
            <dt className="text-content-muted">보행부담</dt>
            <dd className="text-subhead font-bold text-content" data-numeric="">
              {walkingLoad}점
            </dd>
          </div>
          <div>
            <dt className="text-content-muted">총 이동시간</dt>
            <dd className="text-subhead font-bold text-content" data-numeric="">
              {formatDuration(travelMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-content-muted">평균 정보 신뢰도</dt>
            <dd className="text-subhead font-bold text-positive" data-numeric="">
              {averageTrust}점
            </dd>
          </div>
          <div>
            <dt className="text-content-muted">초광역 연계지수</dt>
            <dd className="text-subhead font-bold text-accent" data-numeric="">
              {linkageScore}점
            </dd>
          </div>
        </dl>
      </Card>

      {payload.d.map((day, dayIndex) => (
        <section key={dayIndex} className="flex flex-col gap-sm">
          <h2 className="text-heading font-bold text-content">{dayIndex + 1}일차</h2>
          <ol className="flex flex-col gap-sm">
            {day.map(([attractionId, startMinutes]) => (
              <li key={`${dayIndex}-${attractionId}`}>
                <StopCard
                  compact
                  stop={{
                    id: `stop-${attractionId}`,
                    attractionId,
                    startMinutes,
                    stayMinutes: requireAttraction(attractionId).averageStayMinutes,
                    travelFromPreviousMinutes: 0,
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  iconRight={ChevronRight}
                  className="justify-between"
                  onClick={() => setDetailAttractionId(attractionId)}
                >
                  상세정보와 공식 출처 보기
                </Button>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="flex flex-col gap-sm">
        <Button variant="accent" size="md" iconLeft={ImageIcon} onClick={() => setCardOpen(true)}>
          이미지 여행카드 만들기
        </Button>
        <Button variant="quiet" size="md" iconLeft={Share2} onClick={() => void share()}>
          일정 링크 공유하기
        </Button>
        {shareMessage ? (
          <p aria-live="polite" className="text-caption text-content-muted">
            {shareMessage}
          </p>
        ) : null}
        <p className="text-micro leading-relaxed text-content-subtle">
          이 페이지는 키오스크에서 생성된 일정을 그대로 담고 있으며, 개인정보를 저장하지 않습니다.
          운영시간과 휴무일은 방문 전 공식 출처에서 한 번 더 확인해 주세요.
        </p>
      </section>

      <TravelCardSheet
        itinerary={cardOpen ? cardItinerary : undefined}
        onClose={() => setCardOpen(false)}
      />

      <Sheet
        open={detail !== undefined}
        onClose={() => setDetailAttractionId(undefined)}
        title={detail?.name ?? ''}
        description={detail?.summary}
      >
        {detail ? (
          <div className="flex flex-col gap-lg">
            <dl className="flex flex-col gap-xs text-body">
              <div className="flex gap-sm">
                <dt className="w-[6rem] shrink-0 text-content-muted">지역</dt>
                <dd className="text-content">
                  {REGION_LABELS[detail.region]} · {detail.district}
                </dd>
              </div>
              <div className="flex gap-sm">
                <dt className="w-[6rem] shrink-0 text-content-muted">주소</dt>
                <dd className="text-content">{detail.address}</dd>
              </div>
              <div className="flex gap-sm">
                <dt className="w-[6rem] shrink-0 text-content-muted">운영시간</dt>
                <dd className="text-content" data-numeric="">
                  {detail.openingHours.open}–{detail.openingHours.close}
                </dd>
              </div>
              <div className="flex gap-sm">
                <dt className="w-[6rem] shrink-0 text-content-muted">휴무일</dt>
                <dd className="text-content">
                  {detail.closedDays.length > 0 ? `매주 ${detail.closedDays.join('·')}요일` : '연중무휴'}
                </dd>
              </div>
              <div className="flex gap-sm">
                <dt className="w-[6rem] shrink-0 text-content-muted">추천 체류</dt>
                <dd className="text-content" data-numeric="">
                  {formatDuration(detail.averageStayMinutes)}
                </dd>
              </div>
            </dl>

            <TrustPanel assessment={assessTrust(detail.id, referenceDate)} showFactors={false} />

            <section>
              <h3 className="text-subhead font-bold text-content">공식 출처</h3>
              <SourceList
                className="mt-sm"
                documentIds={getDocumentsFor(detail.id).map((document) => document.id)}
                referenceDate={referenceDate}
                showFields={false}
              />
            </section>

            <Callout tone="caution" icon={Phone}>
              방문 전 공식 출처의 연락처로 운영시간과 휴무 여부를 확인하시면 더 안전합니다.
            </Callout>
          </div>
        ) : null}
      </Sheet>
    </main>
  );
}
