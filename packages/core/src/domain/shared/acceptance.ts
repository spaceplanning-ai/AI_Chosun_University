/**
 * 검수 게이트 자동 판정.
 *
 * 제안서 17.2와 피드백 4장의 Go기준을 사람이 표를 그려 세는 대신 코드가 계산하게 한다.
 *
 * ── 지표 정의 (해석의 여지를 남기지 않기 위해 명시) ────────────────
 *   출처 제시율   = 검색 결과가 1건 이상인 질문 수 ÷ 전체 질문 수
 *                  "답변에 출처가 붙었는가"를 프런트엔드에서 확인 가능한 형태로 옮긴 것.
 *
 *   근거 일치율   = 정답 문서 중 최소 1건이 상위 N위 안에 회수된 질문 수 ÷ 전체 질문 수
 *                  N은 `EVIDENCE_MATCH_RANK`. 관람객이 실제로 보게 되는 상위 근거만 인정한다.
 *
 *   응답시간 중앙값 = 질문별 검색 소요시간의 중앙값
 *                  평균이 아니라 중앙값을 쓰는 것은 검수기준 문구를 그대로 따른 것이다.
 *
 * 본 판정은 프런트엔드 오프라인 검색기를 대상으로 한다.
 * 백엔드 RAG가 연결되면 `retrieve` 구현만 교체하고 같은 판정 로직을 쓴다.
 * ──────────────────────────────────────────────────────────────────
 */

import { ACCEPTANCE_TARGETS } from '../../config/kiosk';
import { BENCHMARK_QUESTIONS, type BenchmarkQuestion } from '../../data/benchmarkQuestions';
import { roundTo } from '../../lib/number';
import { retrieveForQuestion, type RetrievalSettings } from '../linkage-recommendation/retrieval';
import type { RetrievalResult } from '../types/evidence';

/** 이 순위 안에 정답 문서가 들어와야 "근거가 일치했다"고 본다. */
export const EVIDENCE_MATCH_RANK = 3;

export interface BenchmarkResult {
  question: BenchmarkQuestion;
  retrieval: RetrievalResult;
  /** 출처가 하나라도 제시되었는가. */
  hasCitation: boolean;
  /** 상위 N위 안에 정답 문서가 있는가. */
  matchesEvidence: boolean;
  /** 상위 N위 안에서 실제로 맞힌 정답 문서. */
  matchedDocumentIds: string[];
  elapsedMs: number;
}

export interface AcceptanceMetric {
  label: string;
  value: number;
  target: number;
  unit: string;
  /** 목표 달성 여부. 응답시간처럼 낮을수록 좋은 지표는 방향이 반대다. */
  passed: boolean;
  /**
   * 낮을수록 좋은 지표인가.
   *
   * 화면에서 «목표 대비 얼마나 왔는가»를 그릴 때 방향을 알아야 한다.
   * 없으면 «값 ÷ 목표» 로 계산하게 되어, 7초 목표에 0.2ms 인 응답시간이
   * 0% 로 그려진다 — 충족했는데 막대는 비어 있는 모순이 생긴다.
   */
  lowerIsBetter?: boolean;
}

/**
 * 목표를 얼마나 채웠는가 (0–100).
 *
 * 높을수록 좋은 지표는 «값 ÷ 목표», 낮을수록 좋은 지표는 «남은 여유»로 잰다.
 * 두 경우를 한 식으로 쓰면 7초 목표에 0.1ms 인 응답시간이 0% 로 그려져,
 * 충족 표시 옆에 빈 막대가 서는 모순이 생긴다.
 *
 * 화면이 아니라 여기에 두는 이유는 방향이 지표의 성질이기 때문이다 —
 * 화면마다 다시 판단하면 어느 한 곳에서 반드시 뒤집힌다.
 */
export function metricAchievement(metric: AcceptanceMetric): number {
  const target = Math.max(metric.target, 1);
  const ratio = metric.lowerIsBetter === true ? 1 - metric.value / target : metric.value / target;
  return Math.max(0, Math.min(100, ratio * 100));
}

export interface AcceptanceReport {
  results: BenchmarkResult[];
  metrics: AcceptanceMetric[];
  /** 모든 지표가 목표를 충족했는가. Go/No-Go 판단의 요약값. */
  passed: boolean;
  totalQuestions: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function evaluateBenchmark(
  question: BenchmarkQuestion,
  /** 어드민의 「검색 설정」. 안 주면 기본 기준으로 잰다. */
  settings?: RetrievalSettings & { hitRank?: number },
): BenchmarkResult {
  const retrieval = retrieveForQuestion(question.question, undefined, settings);
  const hitRank = settings?.hitRank ?? EVIDENCE_MATCH_RANK;
  const topRanked = retrieval.documents
    .filter((document) => document.rank <= hitRank)
    .map((document) => document.documentId);
  const matchedDocumentIds = question.expectedDocumentIds.filter((id) => topRanked.includes(id));

  return {
    question,
    retrieval,
    hasCitation: retrieval.documents.length > 0,
    matchesEvidence: matchedDocumentIds.length > 0,
    matchedDocumentIds,
    elapsedMs: retrieval.elapsedMs,
  };
}

export function evaluateAcceptance(
  questions: readonly BenchmarkQuestion[] = BENCHMARK_QUESTIONS,
  /** 어드민의 「검색 설정」. 안 주면 기본 기준으로 잰다. */
  settings?: RetrievalSettings & { hitRank?: number },
): AcceptanceReport {
  // 화살표로 감싼다 — `map` 이 넘기는 색인 번호가 설정 자리에 들어가면 안 된다.
  const results = questions.map((question) => evaluateBenchmark(question, settings));
  const total = results.length || 1;

  const sourceCitationRate = roundTo(
    (results.filter((result) => result.hasCitation).length / total) * 100,
    1,
  );
  const answerEvidenceMatchRate = roundTo(
    (results.filter((result) => result.matchesEvidence).length / total) * 100,
    1,
  );
  const medianResponseMs = roundTo(median(results.map((result) => result.elapsedMs)), 2);

  const metrics: AcceptanceMetric[] = [
    {
      label: '출처 제시율',
      value: sourceCitationRate,
      target: ACCEPTANCE_TARGETS.sourceCitationRate,
      unit: '%',
      passed: sourceCitationRate >= ACCEPTANCE_TARGETS.sourceCitationRate,
    },
    {
      label: '답변–근거 일치율',
      value: answerEvidenceMatchRate,
      target: ACCEPTANCE_TARGETS.answerEvidenceMatchRate,
      unit: '%',
      passed: answerEvidenceMatchRate >= ACCEPTANCE_TARGETS.answerEvidenceMatchRate,
    },
    {
      label: '응답시간 중앙값',
      value: medianResponseMs,
      target: ACCEPTANCE_TARGETS.medianResponseMs,
      lowerIsBetter: true,
      unit: 'ms',
      passed: medianResponseMs <= ACCEPTANCE_TARGETS.medianResponseMs,
    },
  ];

  return {
    results,
    metrics,
    passed: metrics.every((metric) => metric.passed),
    totalQuestions: results.length,
  };
}
