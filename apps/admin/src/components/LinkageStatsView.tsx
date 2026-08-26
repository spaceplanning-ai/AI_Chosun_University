'use client';

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEMO_SCENARIOS } from '@namdo-prism/core/data';
import { Button, ChooserField, DateField, Panel, Tabs } from '@namdo-prism/core/ui';
import { generateItinerary } from '@namdo-prism/core/domain/linkage-recommendation';
import { useIsClient } from '@namdo-prism/core/hooks';
import { LinkageRegionView, type LinkageStatsFilters } from './LinkageRegionView';
import { LinkageRelationView } from './LinkageRelationView';

/**
 * 초광역 연계지수 통계 (4.2).
 *
 * ── 왜 둘을 묶었는가 ───────────────────────────────────────────────
 * 「권역」은 값을 정하는 자리다. 반면 이 둘은 **이미 나온 결과를 놓고 보는** 자리다 —
 * 지역을 고르게 다녔는지, 어떤 자원끼리 이어 붙었는지. 하는 일이 같으므로
 * 메뉴에서도 한 자리를 쓴다.
 *
 * ── 왜 조회 조건을 위에 두는가 ─────────────────────────────────────
 * 두 탭이 **같은 계산**을 각자의 각도로 볼 뿐이다. 조건이 탭마다 따로 있으면
 * 「지역별은 8월 기준, 관계는 9월 기준」 같은 상태가 생겨 두 화면을 견줄 수 없다.
 * 조건은 위에 한 벌만 두고 두 탭이 함께 본다.
 *
 * 기준일은 장식이 아니다 — 휴무일·운영시간 판정이 이 날짜를 보므로, 날짜를 바꾸면
 * 문 닫은 곳이 빠지고 다른 곳이 그 자리에 들어와 분포가 실제로 달라진다.
 */

/** 계산 기준일의 기본값. 고정해야 언제 열어도 같은 값이 나와 서로 견줄 수 있다. */
const DEFAULT_REFERENCE_DATE = '2026-08-10';

export function LinkageStatsView() {
  const [tab, setTab] = useState('region');
  const [referenceDate, setReferenceDate] = useState(DEFAULT_REFERENCE_DATE);
  /** 고른 시나리오. 비어 있으면 전체를 본다. */
  const [scenarioIds, setScenarioIds] = useState<string[]>([]);

  const changed = referenceDate !== DEFAULT_REFERENCE_DATE || scenarioIds.length > 0;

  /*
    두 탭은 같은 계산을 각자의 각도로 볼 뿐이므로, 계산도 한 번만 한다.

    예전에는 탭마다 시연 시나리오를 엔진에 넣어 일정을 만들었다. 탭을 옮기면
    앞 탭이 사라지며 그 결과도 버려져, 조건이 그대로인데도 같은 일정을 다시 만들었다.
    여기서 만들어 두 탭에 건네면 탭을 오가도 엔진은 한 번만 돈다.

    서버에서는 만들지 않는다 — 조건을 고르는 화면이라 첫 그림에 값이 필요 없고,
    서버와 브라우저가 다른 값을 그리면 하이드레이션이 어긋난다.
  */
  const isClient = useIsClient();
  const itineraries = useMemo(() => {
    if (!isClient) return undefined;
    const scenarios =
      scenarioIds.length === 0
        ? DEMO_SCENARIOS
        : DEMO_SCENARIOS.filter((scenario) => scenarioIds.includes(scenario.id));
    return scenarios.map(
      (scenario) =>
        generateItinerary({
          conditions: scenario.conditions,
          referenceDate,
          itineraryId: `stats_${scenario.id}`,
        }).itinerary,
    );
  }, [isClient, referenceDate, scenarioIds]);

  const filters: LinkageStatsFilters = { referenceDate, itineraries };

  const conditions = (
    <Panel
      title="조회 조건"
      action={
        changed ? (
          <Button
            size="sm"
            variant="ghost"
            iconLeft={RotateCcw}
            onClick={() => {
              setReferenceDate(DEFAULT_REFERENCE_DATE);
              setScenarioIds([]);
            }}
          >
            기본값으로 되돌리기
          </Button>
        ) : null
      }
    >
      <div className="grid gap-md sm:grid-cols-2">
        <DateField
          label="기준일"
          hint="이 날짜의 휴무일·운영시간으로 일정을 다시 짭니다"
          value={referenceDate}
          onChange={setReferenceDate}
        />
        <ChooserField
          label="시나리오"
          emptyLabel={`전체 ${DEMO_SCENARIOS.length}건`}
          options={DEMO_SCENARIOS.map((scenario) => ({
            value: scenario.id,
            label: scenario.title,
          }))}
          values={scenarioIds}
          onChange={setScenarioIds}
        />
      </div>
    </Panel>
  );

  return (
    <Tabs
      label="연계 통계"
      value={tab}
      onChange={setTab}
      items={[
        { id: 'region', label: '지역별' },
        { id: 'relation', label: '관광지 관계' },
      ]}
    >
      {/*
        조회 조건은 탭 아래에 둔다.
        탭이 먼저 와야 «지금 어느 각도로 보고 있는가»가 먼저 읽히고,
        조건은 그 각도에 딸린 것으로 보인다. 조건이 위에 있으면 탭이 조건에
        딸린 것처럼 읽혀, 탭을 바꾸면 조건이 초기화되는 줄 안다.
      */}
      <div className="flex flex-col gap-lg pt-lg">
        {conditions}
        {tab === 'region' ? (
          <LinkageRegionView {...filters} />
        ) : (
          <LinkageRelationView {...filters} />
        )}
      </div>
    </Tabs>
  );
}
