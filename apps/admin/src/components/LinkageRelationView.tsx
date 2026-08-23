'use client';

import { useMemo } from 'react';
import { DEMO_SCENARIOS, requireAttraction } from '@namdo-prism/core/data';
import { generateItinerary } from '@namdo-prism/core/domain/linkage-recommendation';
import { useIsClient } from '@namdo-prism/core/hooks';
import type { LinkageStatsFilters } from './LinkageRegionView';
import { Badge, DataTable, Panel, Stat, type DataTableColumn } from '@namdo-prism/core/ui';

/**
 * 관광지 관계 분석 (5.4).
 *
 * 어떤 자원 조합이 실제 일정에서 함께 나오는지, 그리고 그 조합이 붙어 있는 일정의
 * 연계지수가 어떤지를 본다. 「무엇과 무엇을 이어 붙일 만한가」를 사람이 정하는 화면(2.3)과 달리,
 * 여기는 **엔진이 실제로 어떻게 이어 붙였는지**를 되짚는 화면이다.
 *
 * 같은 지역·같은 유형끼리만 붙는다면 초광역이라는 이름이 무색해지므로,
 * 조합마다 지역이 갈리는지와 유형이 갈리는지를 함께 표시한다.
 */

interface PairRow {
  key: string;
  from: string;
  to: string;
  /** 몇 번의 일정에서 이어져 나왔는가. */
  count: number;
  /** 그 조합이 들어간 일정들의 평균 연계지수. */
  averageLinkage: number;
  /** 지역 경계를 넘는 조합인가. */
  crossesRegion: boolean;
  /** 관광유형이 갈리는 조합인가. 같은 유형끼리면 상보성이 낮다. */
  differentKind: boolean;
}

export function LinkageRelationView({ referenceDate, scenarioIds }: LinkageStatsFilters) {
  const isClient = useIsClient();

  /** 조회 조건에 걸린 시나리오. 고른 것이 없으면 전체를 본다. */
  const scenarios = useMemo(
    () =>
      scenarioIds === undefined || scenarioIds.length === 0
        ? DEMO_SCENARIOS
        : DEMO_SCENARIOS.filter((scenario) => scenarioIds.includes(scenario.id)),
    [scenarioIds],
  );

  const analysis = useMemo(() => {
    if (!isClient) return undefined;

    /** 조합 키 → 누적. 같은 쌍이 여러 일정에 나오면 합쳐 센다. */
    const pairs = new Map<string, { from: string; to: string; count: number; linkageSum: number }>();

    for (const scenario of scenarios) {
      const { itinerary } = generateItinerary({
        conditions: scenario.conditions,
        referenceDate,
        itineraryId: `rel_${scenario.id}`,
      });
      const linkage = itinerary.metrics.linkageScore;

      // 하루 안에서 이어지는 두 방문지만 «붙어 있다»고 본다. 날이 바뀌면 이어진 것이 아니다.
      for (const day of itinerary.days) {
        for (let index = 0; index + 1 < day.stops.length; index += 1) {
          const from = day.stops[index]!.attractionId;
          const to = day.stops[index + 1]!.attractionId;
          const key = `${from}__${to}`;
          const current = pairs.get(key);
          pairs.set(key, {
            from,
            to,
            count: (current?.count ?? 0) + 1,
            linkageSum: (current?.linkageSum ?? 0) + linkage,
          });
        }
      }
    }

    const rows: PairRow[] = [...pairs.entries()]
      .map(([key, value]) => {
        const from = requireAttraction(value.from);
        const to = requireAttraction(value.to);
        return {
          key,
          from: from.name,
          to: to.name,
          count: value.count,
          averageLinkage: value.linkageSum / value.count,
          crossesRegion: from.region !== to.region,
          differentKind: from.categories[0] !== to.categories[0],
        };
      })
      .sort((a, b) => b.count - a.count || b.averageLinkage - a.averageLinkage);

    const crossing = rows.filter((row) => row.crossesRegion).length;
    const sameKind = rows.filter((row) => !row.differentKind).length;

    return { rows, crossing, sameKind };
  }, [isClient, scenarios, referenceDate]);

  const rows = analysis?.rows ?? [];

  const columns: DataTableColumn<PairRow>[] = [
    {
      key: 'pair',
      header: '자원 조합',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-xs">
          <span className="font-semibold text-content">{row.from}</span>
          <span className="text-content-subtle" aria-label="다음">
            →
          </span>
          <span className="font-semibold text-content">{row.to}</span>
        </span>
      ),
    },
    {
      key: 'traits',
      header: '성격',
      width: '15rem',
      cell: (row) => (
        <span className="flex flex-wrap gap-2xs">
          <Badge size="sm" tone={row.crossesRegion ? 'positive' : 'neutral'}>
            {row.crossesRegion ? '지역 넘음' : '같은 지역'}
          </Badge>
          <Badge size="sm" tone={row.differentKind ? 'positive' : 'caution'}>
            {row.differentKind ? '유형 다름' : '같은 유형'}
          </Badge>
        </span>
      ),
    },
    {
      key: 'count',
      header: '등장',
      align: 'right',
      numeric: true,
      width: '6rem',
      cell: (row) => `${row.count}회`,
    },
    {
      key: 'linkage',
      header: '평균 연계지수',
      align: 'right',
      numeric: true,
      width: '10rem',
      cell: (row) => row.averageLinkage.toFixed(1),
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title="실제로 이어 붙은 조합"
        description={`시나리오 ${scenarios.length}건의 일정에서 하루 안에 이어진 두 방문지를 세었습니다. 기준일 ${referenceDate}.`}
      >
        <div className="grid gap-md sm:grid-cols-3">
          <Stat label="조합" value={rows.length} unit="쌍" />
          <Stat
            label="지역을 넘는 조합"
            value={analysis?.crossing ?? 0}
            unit="쌍"
            tone={(analysis?.crossing ?? 0) > 0 ? 'positive' : 'critical'}
            hint="초광역 연계의 실체"
          />
          <Stat
            label="같은 유형끼리"
            value={analysis?.sameKind ?? 0}
            unit="쌍"
            tone={(analysis?.sameKind ?? 0) === 0 ? 'positive' : 'caution'}
            hint="상보성이 낮게 잡히는 조합"
          />
        </div>
      </Panel>

      <Panel
        title="조합별 상세"
        description="자주 나오는 순서입니다. 같은 조합이 반복되면 자원을 넓혀야 한다는 신호입니다."
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.key} />
      </Panel>
    </div>
  );
}
