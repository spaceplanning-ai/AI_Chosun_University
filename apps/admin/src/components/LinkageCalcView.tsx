'use client';

import { useMemo } from 'react';
import { DEMO_SCENARIOS, requireAttraction } from '@namdo-prism/core/data';
import { generateItinerary } from '@namdo-prism/core/domain/linkage-recommendation';
import { LINKAGE_COMPONENT_LABELS, type LinkageComponentId } from '@namdo-prism/core/domain';
import { useIsClient } from '@namdo-prism/core/hooks';
import {
  Badge,
  Callout,
  DataTable,
  Meter,
  Panel,
  SectionNav,
  type DataTableColumn,
} from '@namdo-prism/core/ui';

/**
 * 지수 계산 (5.2).
 *
 * 시나리오마다 연계지수가 어떻게 나오는지, 그리고 **어느 구성요소가 점수를 끌어내렸는지**를 본다.
 * 종합 점수만 보면 «60점이 왜 60점인가»를 알 수 없어 무엇을 고쳐야 할지 정할 수 없다.
 *
 * 값은 저장소의 시연 시나리오를 실제 엔진에 넣어 얻는다 — 손으로 적어 둔 숫자가 아니다.
 * 자료나 배점이 바뀌면 이 표도 함께 바뀐다.
 */

/** 왼쪽 목차와 본문 제목이 같은 표를 본다. */
const SECTIONS = [
  { id: 'calc-scenarios', label: '시나리오별' },
  { id: 'calc-components', label: '구성요소별 평균' },
  { id: 'calc-weakest', label: '가장 낮은 요소' },
] as const;

const [BY_SCENARIO, BY_COMPONENT, WEAKEST] = SECTIONS;

/** 이 점수 아래면 그 구성요소가 종합 점수를 끌어내린 것으로 본다. */
const WEAK_COMPONENT_SCORE = 60;

/** 계산 기준일. 고정해야 언제 열어도 같은 값이 나와 서로 견줄 수 있다. */
const REFERENCE_DATE = '2026-08-10';

interface ScenarioRow {
  id: string;
  title: string;
  /** 이 일정이 들른 시군구. 권역 상세에서 «이 권역을 지나는 일정»만 고를 때 쓴다. */
  districts: string[];
  score: number;
  /** 구성요소 id → 점수. 열이 네 개라 표에서 바로 꺼내 쓴다. */
  values: Record<string, number>;
  /** 가장 낮은 구성요소. 고칠 지점을 짚어 준다. */
  weakest: { id: string; value: number; explanation: string };
}

export interface LinkageCalcViewProps {
  /**
   * 이 시군구들을 지나는 일정만 본다.
   *
   * 권역 상세의 「지수」 탭이 넘긴다 — 그 권역에 등록한 시군구를 하나라도 들른
   * 일정만 남겨, 「이 권역이 실제로 얼마나 이어졌는가」를 본다.
   * 안 주면 시연 시나리오 전체를 본다.
   */
  districts?: readonly string[];
  /** 표 위에 놓을 이름. 권역 상세에서는 권역 이름이 들어온다. */
  title?: string;
}

export function LinkageCalcView({ districts, title }: LinkageCalcViewProps = {}) {
  // 엔진을 돌리는 계산이라 브라우저에서만 한다. 서버에서 재면 응답시간이 HTML 에 박힌다.
  const isClient = useIsClient();

  const rows = useMemo<ScenarioRow[]>(() => {
    if (!isClient) return [];
    return DEMO_SCENARIOS.map((scenario) => {
      const { itinerary, trace } = generateItinerary({
        conditions: scenario.conditions,
        referenceDate: REFERENCE_DATE,
        itineraryId: `calc_${scenario.id}`,
      });

      const values: Record<string, number> = {};
      for (const component of trace.linkage.components) values[component.id] = component.value;

      const weakest = [...trace.linkage.components].sort((a, b) => a.value - b.value)[0]!;

      return {
        id: scenario.id,
        title: scenario.title,
        districts: [
          ...new Set(
            itinerary.days.flatMap((day) =>
              day.stops.map((stop) => requireAttraction(stop.attractionId).district),
            ),
          ),
        ],
        score: trace.linkage.score,
        values,
        weakest: { id: weakest.id, value: weakest.value, explanation: weakest.explanation },
      };
    });
  }, [isClient]);


  /* 권역이 주어지면 그 시군구를 하나라도 들른 일정만 남긴다. */
  const scoped = useMemo(
    () =>
      districts === undefined
        ? rows
        : rows.filter((row) => row.districts.some((district) => districts.includes(district))),
    [rows, districts],
  );

  /*
    검색·정렬은 두지 않는다.
    시연 시나리오는 넷뿐이고 권역으로 걸러 내면 더 줄어든다.
    두세 줄짜리 표 위의 검색칸은 찾을 것을 찾아 주지 않고 자리만 차지한다.
    대신 종합 점수가 낮은 것이 위로 오게 세워 둔다 — 손볼 곳이 먼저 보여야 한다.
  */
  const listed = [...scoped].sort((a, b) => a.score - b.score);

  const componentIds = Object.keys(LINKAGE_COMPONENT_LABELS) as LinkageComponentId[];

  const average =
    scoped.length === 0 ? undefined : scoped.reduce((sum, row) => sum + row.score, 0) / scoped.length;

  /** 구성요소별 평균. 모든 시나리오에서 낮으면 배점이나 자료를 손봐야 한다. */
  const componentAverages = componentIds.map((id) => ({
    id,
    label: LINKAGE_COMPONENT_LABELS[id],
    value:
      scoped.length === 0
        ? 0
        : scoped.reduce((sum, row) => sum + (row.values[id] ?? 0), 0) / scoped.length,
  }));

  const columns: DataTableColumn<ScenarioRow>[] = [
    {
      key: 'title',
      header: '시나리오',
      cell: (row) => <span className="font-semibold text-content">{row.title}</span>,
    },
    ...componentIds.map((id) => ({
      key: id,
      header: LINKAGE_COMPONENT_LABELS[id],
      align: 'right' as const,
      numeric: true,
      width: '8rem',
      cell: (row: ScenarioRow) => {
        const value = row.values[id] ?? 0;
        // 낮은 구성요소는 눈에 띄어야 «여기가 문제»가 표에서 바로 읽힌다.
        return (
          <span className={value < WEAK_COMPONENT_SCORE ? 'text-critical' : 'text-content-secondary'}>
            {value.toFixed(1)}
          </span>
        );
      },
    })),
    {
      key: 'score',
      header: '종합',
      align: 'right',
      numeric: true,
      width: '7rem',
      cell: (row) => <span className="font-bold text-brand">{row.score.toFixed(1)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      {/*
        카드는 하나로 두고 안에서 구분선으로 나눈다.
        세 구역은 같은 계산을 «시나리오별 → 요소별 평균 → 가장 약한 곳»으로
        좁혀 가는 순서라, 카드로 갈라 놓으면 그 흐름이 끊긴다.
      */}
      <Panel
        title={title ?? '시나리오별 연계지수'}
        description={
          districts === undefined
            ? `시연 시나리오 ${DEMO_SCENARIOS.length}건을 실제 엔진에 넣어 계산한 값입니다. 기준일 ${REFERENCE_DATE}.`
            : `이 권역을 지나는 시연 시나리오 ${scoped.length}건입니다. 기준일 ${REFERENCE_DATE}.`
        }
        action={
          average === undefined ? null : (
            <Badge tone={average >= 70 ? 'positive' : 'caution'}>평균 {average.toFixed(1)}점</Badge>
          )
        }
      >
        <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-lg lg:self-start">
            <SectionNav label="연계지수 구성" items={SECTIONS} />
          </aside>

          <div className="min-w-0">
            <section id={BY_SCENARIO.id} aria-labelledby={`${BY_SCENARIO.id}-title`}>
              <h3 id={`${BY_SCENARIO.id}-title`} className="text-subhead font-bold text-content">
                {BY_SCENARIO.label}
              </h3>

              <Callout className="mt-md" tone="brand" size="sm">
                종합 점수만 보면 «60점이 왜 60점인가»를 알 수 없습니다. 구성요소를 함께 놓아야
                무엇을 고쳐야 할지 정할 수 있습니다. {WEAK_COMPONENT_SCORE}점 미만은 빨갛게
                표시했습니다.
              </Callout>

                    <DataTable
                className="mt-md"
                columns={columns}
                rows={listed}
                rowKey={(row) => row.id}
              />
            </section>

            <hr className="my-lg border-0 border-t border-line-subtle" />

            <section id={BY_COMPONENT.id} aria-labelledby={`${BY_COMPONENT.id}-title`}>
              <h3 id={`${BY_COMPONENT.id}-title`} className="text-subhead font-bold text-content">
                {BY_COMPONENT.label}
              </h3>

              <div className="mt-md flex flex-col gap-md">
                {componentAverages.map((component) => (
                  <Meter
                    key={component.id}
                    label={component.label}
                    value={component.value}
                    unit="점"
                    tone={component.value < WEAK_COMPONENT_SCORE ? 'critical' : 'positive'}
                  />
                ))}
              </div>
            </section>

            <hr className="my-lg border-0 border-t border-line-subtle" />

            <section id={WEAKEST.id} aria-labelledby={`${WEAKEST.id}-title`}>
              <h3 id={`${WEAKEST.id}-title`} className="text-subhead font-bold text-content">
                {WEAKEST.label}
              </h3>

              <ul className="mt-md flex flex-col gap-sm">
                {/* 권역이 주어졌으면 그 권역을 지나는 일정만 본다. 위 표와 같은 목록이어야 한다. */}
                {scoped.map((row) => (
                  <li key={row.id} className="rounded-card bg-surface-sunken p-md">
                    <p className="flex flex-wrap items-baseline gap-xs">
                      <span className="font-semibold text-content">{row.title}</span>
                      <Badge size="sm" tone="critical">
                        {LINKAGE_COMPONENT_LABELS[row.weakest.id as LinkageComponentId]}{' '}
                        {row.weakest.value.toFixed(1)}점
                      </Badge>
                    </p>
                    <p className="mt-2xs text-caption text-content-muted">
                      {row.weakest.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </Panel>
    </div>
  );
}
