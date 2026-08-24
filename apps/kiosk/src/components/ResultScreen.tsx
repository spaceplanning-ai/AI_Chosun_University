'use client';

import { useCallback, useState } from 'react';
import { Image as ImageIcon, QrCode } from 'lucide-react';
import {
  ALL_DAYS,
  ChangeComparison,
  DayRail,
  DayTimeline,
  MetricSummary,
  RationaleSheet,
  RouteMap,
  TravelCardSheet,
  type DaySelection,
} from '@namdo-prism/core/ui/itinerary';
import { ExclusionList, LinkagePanel } from '@namdo-prism/core/ui/evidence';
import { KakaoRouteMap, OpenRouteMap } from '@namdo-prism/core/ui/map';
import { KAKAO_MAP_KEY } from '@/config/runtime';
import { Badge, Button, Card, Panel, Sheet } from '@namdo-prism/core/ui';
import type { ItineraryStop, RefinementId } from '@namdo-prism/core/domain';
import { useKiosk } from '@/state/kioskStore';
import { RefineBar } from './RefineBar';

/**
 * 여행결과 화면 (제안서 6.4).
 *
 * 위에서 아래로 "무엇을 추천했나 → 왜 그런가 → 바꿀 수 있다 → 가져갈 수 있다" 순으로 읽힌다.
 * 관람객용 정보와 연구자용 근거가 같은 화면에 있되, 근거는 접힌 상태로 두어
 * 1∼2분 체험 흐름을 방해하지 않는다.
 */

/** 표시 지표는 넷으로 줄인다. 키오스크에서 일곱 개는 한눈에 안 들어온다. */
const KIOSK_METRICS = ['walkingLoad', 'travelMinutes', 'averageTrust', 'linkageScore'] as const;

export function ResultScreen() {
  const generation = useKiosk((state) => state.generation);
  const itinerary = useKiosk((state) => state.itinerary);
  const lastRefinement = useKiosk((state) => state.lastRefinement);
  const refine = useKiosk((state) => state.refine);
  const dismissRefinement = useKiosk((state) => state.dismissRefinement);
  const showHandoff = useKiosk((state) => state.showHandoff);
  const referenceDate = useKiosk((state) => state.referenceDate);
  const beginSession = useKiosk((state) => state.beginSession);

  const [activeStop, setActiveStop] = useState<ItineraryStop>();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  /*
    기본값은 첫날이다. 「전체」로 시작하면 처음 보는 화면이 곧바로 가장 긴 형태가 되어,
    탭을 접어 둔 의미가 없어진다. 하루씩 보여 주고 전체는 고르는 사람만 펼친다.
  */
  const [daySelection, setDaySelection] = useState<DaySelection>(0);
  /*
    경로는 실제 지도 위에 그린다. 도로와 지명이 함께 보여야 «담양이 광주 바로 위»가 전달된다.

    ── 세 단계로 물러난다 ────────────────────────────────────────────
      ① 카카오맵    열쇠가 있을 때. 국내 지명이 가장 익숙하게 나온다.
      ② 열린 지도    열쇠가 없을 때. 대기화면과 같은 지도라 등록도 열쇠도 필요 없다.
      ③ 도형 지도    타일조차 못 받을 때. 자료가 손에 있어 회선과 무관하게 그려진다.

    ②를 둔 이유는, 열쇠가 없다는 이유로 곧장 ③으로 내려가면 인터넷이 되는 자리에서도
    도로와 지명이 없는 그림을 보게 되기 때문이다.
  */
  const [kakaoUnavailable, setKakaoUnavailable] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const useKakaoRoute = Boolean(KAKAO_MAP_KEY) && !kakaoUnavailable;
  const useOpenRoute = !useKakaoRoute && !tilesUnavailable;
  const handleKakaoUnavailable = useCallback(() => setKakaoUnavailable(true), []);
  const handleTilesUnavailable = useCallback(() => setTilesUnavailable(true), []);

  if (!generation || !itinerary) return null;

  const visibleDays =
    daySelection === ALL_DAYS
      ? itinerary.days
      : // 재구성으로 일정이 짧아져 고른 일자가 사라질 수 있다. 그때는 첫날로 되돌린다.
        (itinerary.days.filter((day) => day.dayIndex === daySelection).length > 0
          ? itinerary.days.filter((day) => day.dayIndex === daySelection)
          : itinerary.days.slice(0, 1));

  const trustById = new Map(
    generation.trace.trustAssessments.map((assessment) => [assessment.attractionId, assessment]),
  );
  // 변경된 방문지는 교체 후 id 가 바뀌므로, 새로 들어온 쪽 id 로 강조 대상을 만든다.
  const highlightIds = (lastRefinement?.replacements ?? []).map(
    (replacement) => `stop-${replacement.addedAttractionId}`,
  );

  return (
    <div className="flex flex-1 flex-col gap-lg py-md">
      <header className="flex flex-col gap-sm">
        <Badge tone="accent">AI 추천 여행일정</Badge>
        <h2 className="text-title font-bold text-content text-balance-safe">{itinerary.title}</h2>
        <p className="text-body text-content-muted">{itinerary.subtitle}</p>
      </header>

      <MetricSummary metrics={itinerary.metrics} visibleMetrics={KIOSK_METRICS} />

      {useKakaoRoute ? (
        <div className="h-[26rem] overflow-hidden rounded-card surface-outline">
          <KakaoRouteMap
            days={itinerary.days}
            appKey={KAKAO_MAP_KEY}
            onUnavailable={handleKakaoUnavailable}
          />
        </div>
      ) : useOpenRoute ? (
        <div className="h-[26rem] overflow-hidden rounded-card surface-outline">
          <OpenRouteMap days={itinerary.days} onUnavailable={handleTilesUnavailable} />
        </div>
      ) : (
        <RouteMap days={itinerary.days} changedStopIds={highlightIds} />
      )}

      {/*
        일자를 탭으로 접는다. 3일 이상이면 방문지가 15곳까지 늘어, 한 줄로 이으면
        결과화면이 화면 다섯 개 높이가 된다. 뒤에 사람이 서 있는 전시장에서
        스크롤이 길어질수록 끝까지 보는 사람이 줄어든다.
      */}
      <DayRail days={itinerary.days} selected={daySelection} onSelect={setDaySelection} />

      <div className="flex flex-col gap-xl">
        {visibleDays.map((day) => (
          <DayTimeline
            key={day.dayIndex}
            day={day}
            onShowRationale={setActiveStop}
            changedStopIds={highlightIds}
          />
        ))}
      </div>

      <Card padding="lg" className="bg-surface-sunken">
        <LinkagePanel linkage={itinerary.linkage} showComponents={false} />
        <Button
          variant="outline"
          size="sm"
          className="mt-md"
          onClick={() => setEvidenceOpen(true)}
        >
          AI가 어떻게 고르고 걸렀는지 보기
        </Button>
      </Card>

      <RefineBar
        onRefine={(refinementId: RefinementId) => refine(refinementId)}
        onRestart={beginSession}
      />

      <div className="flex flex-col gap-sm">
        <Button size="lg" variant="accent" iconLeft={QrCode} onClick={showHandoff}>
          QR로 내 휴대폰에 저장하기
        </Button>
        <Button size="md" variant="outline" iconLeft={ImageIcon} onClick={() => setCardOpen(true)}>
          이미지 여행카드 미리보기
        </Button>
      </div>

      <TravelCardSheet
        itinerary={cardOpen ? itinerary : undefined}
        onClose={() => setCardOpen(false)}
        allowExport={false}
      />

      <RationaleSheet
        stop={activeStop}
        trust={activeStop ? trustById.get(activeStop.attractionId) : undefined}
        referenceDate={referenceDate}
        onClose={() => setActiveStop(undefined)}
      />

      <Sheet
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        title="AI 선정·제외 근거"
        description="공식자료 검색과 정보 신뢰도 판정을 거쳐 남은 후보로 일정을 구성했습니다."
      >
        <div className="flex flex-col gap-lg">
          <LinkagePanel linkage={itinerary.linkage} />
          {generation.trace.linkageCorrection ? (
            <Panel
              title="초광역 연계 보정"
              description="한 지역에만 몰린 일정을 자동으로 조정했습니다."
              padding="md"
            >
              <p className="text-body text-content-secondary">
                {generation.trace.linkageCorrection.reason}
              </p>
            </Panel>
          ) : null}
          <section>
            <h3 className="text-subhead font-bold text-content">추천에서 제외된 관광지</h3>
            <ExclusionList className="mt-sm" exclusions={generation.trace.exclusions} limit={8} />
          </section>
        </div>
      </Sheet>

      <Sheet
        open={lastRefinement !== undefined}
        onClose={dismissRefinement}
        title="일정을 다시 구성했습니다"
        description="기존 일정에서 유지할 장소와 변경할 장소를 구분해 최소 범위만 바꿨습니다."
        footer={
          <Button variant="accent" fullWidth onClick={dismissRefinement}>
            바뀐 일정 확인하기
          </Button>
        }
      >
        {lastRefinement ? <ChangeComparison trace={lastRefinement} /> : null}
      </Sheet>
    </div>
  );
}
