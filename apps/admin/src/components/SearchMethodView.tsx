'use client';

import { useMemo } from 'react';
import { BENCHMARK_QUESTIONS } from '@namdo-prism/core/data';
import { retrieveForQuestion } from '@namdo-prism/core/domain/linkage-recommendation';
import { useIsClient } from '@namdo-prism/core/hooks';
import { BarList, Panel, SectionNav, Stat } from '@namdo-prism/core/ui';
import { SEARCH_SETTINGS } from '@/config/resourceSchemas';
import { useSearchSettings } from '@/state/searchSettings';
import { useSettingsForm } from './SettingsForm';

/**
 * 검색 방식 (3.3).
 *
 * ── 왜 «임베딩 관리»가 아닌가 ──────────────────────────────────────
 * 메뉴 이름은 임베딩 벡터를 다루는 화면을 뜻하지만, 지금 검색기는 임베딩을 쓰지 않는다.
 * 낱말이 얼마나 겹치는지로 점수를 매긴다. 없는 것을 관리하는 화면을 만들면
 * «벡터가 어딘가에 있다»는 잘못된 인상을 준다.
 *
 * 그래서 지금 실제로 쓰는 방식과 그 결과 점수가 어떻게 흩어지는지를 보여 준다.
 * 임베딩으로 바꾸면 이 분포가 어떻게 달라지는지가 곧 도입 효과의 근거가 된다.
 *
 * 값은 기준 평가질문 전체를 실제로 검색해 얻는다.
 */

/** 점수를 묶는 구간. 분포가 한쪽에 몰렸는지 보려면 구간이 필요하다. */
const SCORE_BUCKETS = [
  { label: '0.8 이상', test: (score: number) => score >= 0.8 },
  { label: '0.6–0.8', test: (score: number) => score >= 0.6 && score < 0.8 },
  { label: '0.4–0.6', test: (score: number) => score >= 0.4 && score < 0.6 },
  { label: '0.2–0.4', test: (score: number) => score >= 0.2 && score < 0.4 },
  { label: '0.2 미만', test: (score: number) => score < 0.2 },
];

/** 왼쪽 목차와 본문 제목이 같은 표를 본다. */
const SECTIONS = [
  { id: 'search-criteria', label: '검색 판정 기준' },
  { id: 'search-distribution', label: '점수 분포' },
] as const;

const [CRITERIA, DISTRIBUTION] = SECTIONS;

export function SearchMethodView() {
  const isClient = useIsClient();
  /*
    위쪽 「검색 판정 기준」에서 저장한 값을 그대로 읽는다.
    기준을 바꾸면 아래 분포가 그 기준으로 다시 계산된다 —
    값을 고친 사람이 효과를 보려고 다른 화면을 찾아갈 필요가 없다.
  */
  const settings = useSearchSettings();
  /* 조작줄은 카드 머리말로 올린다 — 다른 상세 화면과 같은 자리에 있어야 눈이 헤매지 않는다. */
  const criteria = useSettingsForm(SEARCH_SETTINGS);

  const analysis = useMemo(() => {
    if (!isClient) return undefined;

    const topScores: number[] = [];
    const gaps: number[] = [];
    let weakTop = 0;

    for (const question of BENCHMARK_QUESTIONS) {
      const { documents } = retrieveForQuestion(question.question, undefined, {
        minSimilarity: settings.minSimilarity,
        limit: settings.limit,
      });
      const top = documents[0]?.similarity ?? 0;
      const second = documents[1]?.similarity ?? 0;
      topScores.push(top);
      // 1위와 2위의 차이. 붙어 있으면 «어느 것이 정답인지» 검색기도 못 가른 것이다.
      gaps.push(top - second);
      // 재검색 임계값보다 낮은 1위 = 이대로면 질의를 바꿔 다시 검색해야 하는 질문이다.
      if (top < settings.rerankThreshold) weakTop += 1;
    }

    const average = (values: number[]) =>
      values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      topScores,
      averageTop: average(topScores),
      averageGap: average(gaps),
      weakTop,
      buckets: SCORE_BUCKETS.map((bucket) => ({
        key: bucket.label,
        label: bucket.label,
        value: topScores.filter((score) => bucket.test(score)).length,
        unit: '건',
      })),
    };
  }, [isClient, settings]);

  return (
    <div className="flex flex-col gap-lg">
      {/*
        카드는 하나로 두고 안에서 구분선으로 나눈다.
        기준을 고치는 자리와 «그래서 점수가 어떻게 흩어지는가»가 이어져 있어야,
        값을 바꾼 사람이 바로 아래에서 효과를 확인한다.
      */}
      <Panel title="검색 방식" action={criteria.action}>
        <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-lg lg:self-start">
            <SectionNav label="검색 방식 구성" items={SECTIONS} />
          </aside>

          <div className="min-w-0">
            <section id={CRITERIA.id} aria-labelledby={`${CRITERIA.id}-title`}>
              <h3 id={`${CRITERIA.id}-title`} className="text-subhead font-bold text-content">
                {CRITERIA.label}
              </h3>
              <div className="mt-md">{criteria.body}</div>
            </section>

            <hr className="my-lg border-0 border-t border-line-subtle" />

            <section id={DISTRIBUTION.id} aria-labelledby={`${DISTRIBUTION.id}-title`}>
              <h3 id={`${DISTRIBUTION.id}-title`} className="text-subhead font-bold text-content">
                {DISTRIBUTION.label}
              </h3>

              {/*
                이름은 검색기 용어가 아니라 «무엇을 말하는가»로 짓는다.
                「1위」·「격차」는 코드 안의 말이지 이 화면을 보는 사람의 말이 아니다.
              */}
              <div className="mt-md grid gap-md sm:grid-cols-3">
                <Stat
                  label="가장 잘 맞은 문서 점수"
                  value={analysis?.averageTop.toFixed(3) ?? '—'}
                />
                <Stat
                  label="1등과 2등의 점수 차이"
                  value={analysis?.averageGap.toFixed(3) ?? '—'}
                />
                <Stat
                  label="다시 검색해야 할 질문"
                  hint={`점수가 ${settings.rerankThreshold} 미만`}
                  value={analysis?.weakTop ?? 0}
                  unit="건"
                  tone={analysis?.weakTop === 0 ? 'positive' : 'critical'}
                />
              </div>

              <BarList className="mt-md" items={analysis?.buckets ?? []} tone="brand" />
            </section>
          </div>
        </div>
      </Panel>
    </div>
  );
}
