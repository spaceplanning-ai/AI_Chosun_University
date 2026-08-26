'use client';

import { useMemo, useState } from 'react';
import {
  CircleCheck,
  CircleX,
  Clock,
  FileSearch,
  Gauge,
  Play,
  QrCode,
  Quote,
  Route,
  ScrollText,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { ACCEPTANCE_TARGETS } from '@namdo-prism/core/config';
import { evaluateAcceptance, metricAchievement } from '@namdo-prism/core/domain';
import { useIsClient } from '@namdo-prism/core/hooks';
import { formatElapsed } from '@namdo-prism/core/lib';
import { Badge, Button, Callout, Meter, Panel, Stat } from '@namdo-prism/core/ui';
import { useAdminLog } from '@/state/logs';

/**
 * 대시보드 (1.1).
 *
 * ── 두 종류의 숫자를 섞지 않는다 ───────────────────────────────────
 * 이 화면의 값은 출처가 둘이다.
 *
 *   ① 지금 이 자리에서 재는 값 — 검수 지표. 검색기를 실제로 돌려 얻는다.
 *   ② 현장에서 모아야 하는 값 — 세션·QR·이용시간. 키오스크 로그를 가져와야 생긴다.
 *
 * 둘을 한 줄에 섞어 놓고 자료 없는 칸에 0 을 적으면 «0% 였다»로 읽힌다.
 * 그래서 자료가 없는 값은 숫자 대신 «자료 없음»으로 두고, 무엇을 해야 채워지는지 적는다.
 * 검수·논문 자료로 캡처됐을 때 없는 실적이 있는 것처럼 보이지 않게 하기 위함이다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 자료가 없을 때 쓰는 표시. 0 과 구분되어야 한다. */
const NO_DATA = '—';


/** 오늘 만든 일정인지. 로그의 시작 시각을 현지 날짜로 견준다. */
function isToday(isoDate: string, today: string): boolean {
  return isoDate.slice(0, 10) === today;
}

export function DashboardView() {
  const sessions = useAdminLog((state) => state.sessions);

  /*
    검수 지표는 화면을 열 때 한 번 잰다.

    ── 왜 자동으로 재는가 ──────────────────────────────────────────
    이 값들은 저장소 안의 문서와 질문만으로 계산된다. 백엔드도 네트워크도
    필요 없고 몇 밀리초면 끝난다. 그런데 눌러야만 나오게 두면, 어드민을 처음 연
    사람은 «—» 열 개를 보게 된다. 잴 수 있는 값을 비워 두는 것은 정직함이 아니라
    그냥 안 보여 주는 것이다.

    ── 자동으로 재서 생기는 문제와 그 처리 ─────────────────────────
    네 지표 중 셋(출처 제시율·근거 일치율·검색 성공률)은 같은 자료에 같은 검색기라
    언제 재도 같은 값이 나온다. 흔들리는 것은 응답시간 중앙값 하나뿐인데,
    그건 원래 잴 때마다 달라지는 값이다. 그래서 «언제 잰 값인지»를 늘 함께 적는다.

    첫 계산은 브라우저에서만 한다. 서버에서 재면 그 시각이 HTML 에 박혀
    화면이 살아날 때 값이 어긋난다(하이드레이션 불일치).
  */
  const isClient = useIsClient();
  /** 「다시 측정」을 누를 때마다 올린다. 이 값이 바뀌면 다시 잰다. */
  const [runToken, setRunToken] = useState(0);

  /*
    잰 값과 잰 시각을 함께 만든다.
    따로 두면 «지표는 새 값인데 시각은 옛날»인 순간이 생긴다.
  */
  const measurement = useMemo(
    () => (isClient ? { report: evaluateAcceptance(), at: new Date().toISOString() } : undefined),
    // runToken 은 다시 재기 위한 신호다. 값 자체는 쓰지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClient, runToken],
  );

  const report = measurement?.report;
  const measuredAt = measurement?.at;

  const today = new Date().toISOString().slice(0, 10);
  const hasSessions = sessions.length > 0;

  const todayCount = sessions.filter((session) => isToday(session.startedAt, today)).length;
  const qrRate = hasSessions
    ? Math.round((sessions.filter((session) => session.qrGenerated).length / sessions.length) * 1000) / 10
    : undefined;

  const average = (values: number[]) =>
    values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;

  const averageScore = average(
    sessions.flatMap((session) => session.candidates.map((candidate) => candidate.total)),
  );
  const averageLinkage = average(
    sessions.map((session) => session.finalItinerary.metrics.linkageScore),
  );
  const averageGeneration = average(sessions.map((session) => session.generationMs));

  /** 검색이 한 건이라도 문서를 회수한 비율. 「출처를 댈 수 있었는가」와 같은 뜻이다. */
  const retrievalSuccess = report
    ? Math.round(
        (report.results.filter((result) => result.retrieval.documents.length > 0).length /
          report.totalQuestions) *
          1000,
      ) / 10
    : undefined;

  /** 검색기가 뒤지는 색인의 크기. 질문마다 같으므로 첫 결과에서 읽는다. */
  const corpusSize = report?.results[0]?.retrieval.corpusSize;

  /** 질문 하나에 평균 몇 건이 회수됐는가. 소수 한 자리까지 본다. */
  const averageRetrieved = report
    ? Math.round(
        (report.results.reduce((sum, result) => sum + result.retrieval.documents.length, 0) /
          Math.max(report.totalQuestions, 1)) *
          10,
      ) / 10
    : undefined;

  /** 한 건도 회수하지 못한 질문. 색인을 보강해야 할 지점이다. */
  const emptyQuestions = report
    ? report.results.filter((result) => result.retrieval.documents.length === 0).length
    : undefined;

  const metricValue = (value: number | undefined, unit: string) =>
    value === undefined ? NO_DATA : `${value}${unit}`;

  const run = () => setRunToken((token) => token + 1);

  return (
    <div className="flex flex-col gap-lg">

      <Panel
        title="검수 지표"
        description="검수 때 확인하는 세 가지 목표치입니다. 화면을 열 때 검색기를 돌려 지금 값을 잽니다."
        action={
          <span className="flex flex-wrap items-center gap-xs">
            {measuredAt ? (
            <span className="text-micro text-content-muted" data-numeric="">
              {measuredAt.slice(0, 19).replace('T', ' ')} 측정
            </span>
          ) : null}
          <Button size="sm" variant="accent" iconLeft={Play} onClick={run}>
            다시 측정
          </Button>
          </span>
        }
      >
        {report ? (
          <>
            <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
              {report.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-card bg-surface-sunken p-md surface-outline"
                >
                  <div className="flex items-center justify-between gap-sm">
                    <p className="text-caption text-content-muted">{metric.label}</p>
                    <Badge size="sm" tone={metric.passed ? 'positive' : 'critical'}>
                      {metric.passed ? '충족' : '미달'}
                    </Badge>
                  </div>
                  <p className="mt-2xs flex items-baseline gap-[0.2em]">
                    <span
                      className={`text-title font-bold ${metric.passed ? 'text-positive' : 'text-critical'}`}
                      data-numeric=""
                    >
                      {metric.value}
                    </span>
                    <span className="text-caption text-content-muted">{metric.unit}</span>
                  </p>
                  <p className="mt-2xs text-micro text-content-muted">
                    목표 {metric.target}
                    {metric.unit}
                  </p>
                  {/*
                    막대는 목표 대비 위치를 눈으로 잡아 준다. 숫자만으로는 «얼마나 여유 있나»가 안 보인다.
                    낮을수록 좋은 지표는 방향을 뒤집는다 — 안 그러면 충족했는데 막대가 비어 보인다.
                  */}
                  <Meter
                    className="mt-sm"
                    label={`${metric.label} ${metric.lowerIsBetter ? '목표 대비 여유' : '목표 대비'}`}
                    value={metricAchievement(metric)}
                    tone={metric.passed ? 'positive' : 'critical'}
                  />
                </div>
              ))}
            </div>

            <p className="mt-md flex items-center gap-xs text-subhead font-bold">
              {report.passed ? (
                <>
                  <CircleCheck className="size-[1.2em] text-positive" aria-hidden />
                  <span className="text-positive">
                    기준 평가질문 {report.totalQuestions}건 기준, 세 지표를 모두 충족했습니다.
                  </span>
                </>
              ) : (
                <>
                  <CircleX className="size-[1.2em] text-critical" aria-hidden />
                  <span className="text-critical">일부 지표가 목표에 미달했습니다.</span>
                </>
              )}
            </p>
          </>
        ) : (
          <Callout tone="brand" icon={Gauge}>
            「지표 측정」을 누르면 기준 평가질문 전체를 검색기에 통과시켜
            <strong> 출처 제시율 {ACCEPTANCE_TARGETS.sourceCitationRate}% 이상</strong>,
            <strong> 답변–근거 일치율 {ACCEPTANCE_TARGETS.answerEvidenceMatchRate}% 이상</strong>,
            <strong> 응답시간 중앙값 {ACCEPTANCE_TARGETS.medianResponseMs / 1000}초 이내</strong>{' '}
            충족 여부를 그 자리에서 잽니다.
          </Callout>
        )}
      </Panel>

      {/* ── 검색 동작 (위 판이 다루지 않는 값만) ────────────────────── */}
      <Panel
        title="검색 동작"
        description="위 지표가 목표를 넘었는지를 본다면, 여기서는 검색기가 어떤 점수로 문서를 골랐는지를 봅니다."
      >
        <div className="grid grid-cols-2 gap-sm lg:grid-cols-4">
          <Stat
            label="색인 문서"
            value={metricValue(corpusSize, '')}
            unit="건"
            icon={FileSearch}
            hint="검색기가 뒤지는 대상"
          />
          <Stat
            label="회수 성공률"
            value={metricValue(retrievalSuccess, '%')}
            tone={retrievalSuccess === undefined ? 'neutral' : 'positive'}
            icon={Quote}
            hint="문서를 한 건이라도 회수한 질문 비율"
          />
          <Stat
            label="질문당 평균 회수"
            value={metricValue(averageRetrieved, '')}
            unit="건"
            icon={CircleCheck}
            hint="많을수록 고를 여지가 넓습니다"
          />
          <Stat
            label="빈손 질문"
            value={metricValue(emptyQuestions, '')}
            unit="건"
            tone={emptyQuestions === undefined || emptyQuestions === 0 ? 'neutral' : 'critical'}
            icon={Clock}
            hint="한 건도 회수하지 못한 질문"
          />
        </div>
      </Panel>

      {/* ── 현장 실적 (로그를 가져와야 채워짐) ─────────────────────── */}
      <Panel
        title="현장 이용 실적"
        description="키오스크에서 가져온 세션 로그로 계산합니다. 로그가 없으면 값 대신 자료 없음으로 둡니다."
        action={
          <Badge tone={hasSessions ? 'brand' : 'neutral'}>
            {hasSessions ? `세션 ${sessions.length}건` : '가져온 로그 없음'}
          </Badge>
        }
      >
        <div className="grid grid-cols-2 gap-sm lg:grid-cols-3">
          <Stat
            label="오늘 생성 일정"
            value={hasSessions ? todayCount : NO_DATA}
            unit={hasSessions ? '건' : undefined}
            tone="brand"
            icon={Route}
          />
          <Stat
            label="전체 세션"
            value={hasSessions ? sessions.length : NO_DATA}
            unit={hasSessions ? '건' : undefined}
            tone="brand"
            icon={ScrollText}
          />
          <Stat
            label="QR 전환율"
            value={metricValue(qrRate, '%')}
            tone={qrRate === undefined ? 'neutral' : 'accent'}
            icon={QrCode}
            hint="일정을 휴대폰으로 가져간 비율"
          />
          <Stat
            label="평균 추천점수"
            value={averageScore === undefined ? NO_DATA : Math.round(averageScore * 10) / 10}
            unit={averageScore === undefined ? undefined : '점'}
            tone="neutral"
            icon={Star}
          />
          <Stat
            label="평균 연계지수"
            value={averageLinkage === undefined ? NO_DATA : Math.round(averageLinkage * 10) / 10}
            unit={averageLinkage === undefined ? undefined : '점'}
            tone="neutral"
            icon={Gauge}
          />
          <Stat
            label="평균 일정 생성시간"
            value={averageGeneration === undefined ? NO_DATA : formatElapsed(averageGeneration)}
            tone="neutral"
            icon={Clock}
          />
        </div>

        {hasSessions ? null : (
          <Callout className="mt-md" tone="caution" icon={TriangleAlert}>
            아직 가져온 로그가 없어 <strong>«—» 로 비워 두었습니다.</strong> 0 으로 적으면
            «실적이 0이었다»로 읽히기 때문입니다. 키오스크에서 로그를 내보낸 뒤{' '}
            <strong>8.1 세션 로그</strong>에서 불러오면 이 칸들이 채워집니다.
          </Callout>
        )}
      </Panel>
    </div>
  );
}
