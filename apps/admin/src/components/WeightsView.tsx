'use client';

import { useState } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import {
  LINKAGE_WEIGHTS,
  SCORE_WEIGHTS,
  TRUST_WEIGHTS,
} from '@namdo-prism/core/config';
import {
  LINKAGE_COMPONENT_LABELS,
  SCORE_CRITERION_LABELS,
  TRUST_FACTOR_LABELS,
} from '@namdo-prism/core/domain';
import { Badge, Button, Callout, Panel, SectionNav } from '@namdo-prism/core/ui';

/**
 * 추천 가중치 (4.2).
 *
 * 배점을 바꿔 보며 «어떤 기준을 얼마나 볼 것인가»를 정하는 화면.
 * 운영값은 코드에 있고, 여기서 바꾼 값은 **실험값**이다 — 둘을 섞으면
 * 어떤 배점으로 나온 결과인지 나중에 알 수 없다.
 */

/** 배점표 하나. 세 가지(추천·신뢰도·연계지수)가 같은 형태를 쓴다. */
interface WeightGroup {
  id: string;
  title: string;
  description: string;
  /** 코드에 박힌 운영값. 되돌리기의 기준이 된다. */
  production: Record<string, number>;
  labels: Record<string, string>;
}

const GROUPS: WeightGroup[] = [
  {
    id: 'score',
    title: '다목적 추천점수',
    description: '관광지 하나를 고를 때 무엇을 얼마나 볼지 (제안서 8.4)',
    production: SCORE_WEIGHTS,
    labels: SCORE_CRITERION_LABELS,
  },
  {
    id: 'trust',
    title: '정보 신뢰도',
    description: '자원의 근거가 얼마나 믿을 만한지 (제안서 8.5)',
    production: TRUST_WEIGHTS,
    labels: TRUST_FACTOR_LABELS,
  },
  {
    id: 'linkage',
    title: '초광역 연계지수',
    description: '일정이 두 지역을 얼마나 엮었는지',
    production: LINKAGE_WEIGHTS,
    labels: LINKAGE_COMPONENT_LABELS,
  },
];

/** 왼쪽 목차. 배점표 목록에서 그대로 만든다 — 표가 늘면 목차도 함께 는다. */
const SECTIONS = GROUPS.map((group) => ({ id: `weights-${group.id}`, label: group.title }));

export function WeightsView() {
  /** 실험값. 키는 `그룹id.항목id`. */
  const [experiment, setExperiment] = useState<Record<string, number>>({});

  const valueOf = (group: WeightGroup, key: string) =>
    experiment[`${group.id}.${key}`] ?? group.production[key]!;

  const totalOf = (group: WeightGroup) =>
    Object.keys(group.production).reduce((sum, key) => sum + valueOf(group, key), 0);

  const isChanged = (group: WeightGroup) =>
    Object.keys(group.production).some((key) => valueOf(group, key) !== group.production[key]);

  const reset = (group: WeightGroup) =>
    setExperiment((current) => {
      const next = { ...current };
      for (const key of Object.keys(group.production)) delete next[`${group.id}.${key}`];
      return next;
    });

  return (
    <div className="flex flex-col gap-lg">
      {/*
        카드는 하나로 두고 안에서 구분선으로 나눈다.
        세 배점표는 «무엇을 재는가»만 다를 뿐 같은 종류의 값이라, 카드로 갈라 놓으면
        서로 견주기 어렵다. 한 장 안에서 이어 보면 어느 쪽이 큰지가 바로 눈에 들어온다.
      */}
      <Panel title="배점 조절" description="여기서 바꾼 값은 실험값입니다. 운영값은 그대로 남습니다.">
        <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-lg lg:self-start">
            <SectionNav label="배점표 구성" items={SECTIONS} />
          </aside>

          <div className="min-w-0">
            {GROUPS.map((group, index) => {
              const total = totalOf(group);
              const changed = isChanged(group);

              return (
                <div key={group.id}>
                  {index === 0 ? null : (
                    <hr className="my-lg border-0 border-t border-line-subtle" />
                  )}

                  <section id={`weights-${group.id}`} aria-labelledby={`weights-${group.id}-title`}>
                    <header className="flex flex-wrap items-start justify-between gap-md">
                      <div className="min-w-0">
                        <h3
                          id={`weights-${group.id}-title`}
                          className="text-subhead font-bold text-content"
                        >
                          {group.title}
                        </h3>
                        <p className="mt-2xs text-caption text-content-muted">{group.description}</p>
                      </div>
                      <span className="flex flex-wrap items-center gap-sm">
                        {/* 합계가 100 이 아니면 점수의 뜻이 달라진다. 눈에 띄게 알린다. */}
                        <Badge tone={total === 100 ? 'positive' : 'critical'}>합계 {total}</Badge>
                        {changed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            iconLeft={RotateCcw}
                            onClick={() => reset(group)}
                          >
                            운영값으로
                          </Button>
                        ) : null}
                      </span>
                    </header>

                    {total !== 100 ? (
                      <Callout className="mt-md" tone="critical" icon={TriangleAlert}>
                        배점 합계가 100이 아닙니다. 이 상태의 점수는 다른 실험과 견줄 수 없습니다.
                      </Callout>
                    ) : null}

                    <ul className="mt-md flex flex-col gap-md">
                      {Object.keys(group.production).map((key) => {
                        const value = valueOf(group, key);
                        const base = group.production[key]!;
                        const moved = value !== base;

                        return (
                          <li key={key}>
                            <div className="flex flex-wrap items-baseline justify-between gap-sm">
                              <span className="text-caption font-semibold text-content">
                                {group.labels[key]}
                              </span>
                              <span className="flex items-baseline gap-xs">
                                {/*
                                  배점만 보면 «전체에서 얼마나 큰가»를 가늠하기 어렵다.
                                  비중을 함께 적는다.
                                */}
                                <span className="text-micro text-content-subtle" data-numeric="">
                                  {moved ? `운영 ${base} · ` : ''}
                                  전체의 {total === 0 ? 0 : Math.round((value / total) * 100)}%
                                </span>
                                <span
                                  className={`text-subhead font-bold ${moved ? 'text-accent' : 'text-content'}`}
                                  data-numeric=""
                                >
                                  {value}
                                </span>
                              </span>
                            </div>

                            <input
                              type="range"
                              min={0}
                              max={60}
                              step={1}
                              value={value}
                              onChange={(event) =>
                                setExperiment((current) => ({
                                  ...current,
                                  [`${group.id}.${key}`]: Number(event.target.value),
                                }))
                              }
                              aria-label={`${group.labels[key]} 배점`}
                              className="mt-2xs w-full accent-brand"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}
