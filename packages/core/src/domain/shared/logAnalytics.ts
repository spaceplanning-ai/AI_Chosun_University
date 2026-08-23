/**
 * 연구로그 집계 (제안서 16장 C안 "연구용 로그 … + 대시보드").
 *
 * 화면과 분리한 순수 함수로 둔다. 집계가 컴포넌트 안에 있으면
 * "대시보드에 보이는 숫자"와 "논문에 쓰는 숫자"가 갈라지고, 테스트도 할 수 없다.
 *
 * 집계 항목은 제안서 10.2 연구목적에서 역산했다 —
 * 큰 글씨 모드의 접근성 효과, 지역 분산, 제외 사유 분포, 재구성 만족도.
 */

import { getAttraction } from '../../data/attractions';
import { REFINEMENT_DEFINITIONS } from '../../config/refinements';
import { EXCLUSION_REASON_LABELS } from '../labels';
import { average, roundTo } from '../../lib/number';
import type { SessionLog } from '../../lib/logging/schema';
import type { Region } from '../types/catalog';

export interface CountEntry {
  key: string;
  label: string;
  value: number;
  /** 전체 대비 비율(%). 막대 길이는 이 값이 아니라 value 기준으로 그린다. */
  share: number;
}

export interface AchievementEntry extends CountEntry {
  /** 목표를 달성한 요청의 비율(%). */
  achievedRatio: number;
}

export interface LogAnalytics {
  sessionCount: number;
  /** 세션당 평균값. 세션이 없으면 0. */
  averages: {
    linkageScore: number;
    trustScore: number;
    walkingLoad: number;
    travelMinutes: number;
    generationMs: number;
  };
  /** 접근성 연구용 — 큰 글씨 모드 사용 비율. */
  uiModeShare: CountEntry[];
  /** 지역 분산 — 방문지 기준. */
  regionShare: CountEntry[];
  /** 연계지수 구간 분포. */
  linkageDistribution: CountEntry[];
  /** 가장 많이 추천된 관광지. */
  topAttractions: CountEntry[];
  /** 제외 사유 분포. */
  exclusionReasons: CountEntry[];
  /** 재구성 요청별 사용 횟수와 달성률. */
  refinementUsage: AchievementEntry[];
  /** QR 생성 비율(%). */
  qrGeneratedRatio: number;
}

function toEntries(
  counts: ReadonlyMap<string, number>,
  label: (key: string) => string,
  limit?: number,
): CountEntry[] {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (limit === undefined ? sorted : sorted.slice(0, limit)).map(([key, value]) => ({
    key,
    label: label(key),
    value,
    share: roundTo((value / total) * 100, 1),
  }));
}

function increment(counts: Map<string, number>, key: string, by = 1): void {
  counts.set(key, (counts.get(key) ?? 0) + by);
}

/** 연계지수 구간. 0–100을 다섯 칸으로 나눈다. */
const LINKAGE_BUCKETS = [
  { key: '0-20', label: '0–20', min: 0, max: 20 },
  { key: '20-40', label: '20–40', min: 20, max: 40 },
  { key: '40-60', label: '40–60', min: 40, max: 60 },
  { key: '60-80', label: '60–80', min: 60, max: 80 },
  { key: '80-100', label: '80–100', min: 80, max: 100.1 },
] as const;

const REGION_LABEL: Record<Region, string> = { gwangju: '광주', jeonnam: '전남' };

export function analyzeLogs(sessions: readonly SessionLog[]): LogAnalytics {
  const uiModes = new Map<string, number>();
  const regions = new Map<string, number>();
  const buckets = new Map<string, number>();
  const attractions = new Map<string, number>();
  const exclusions = new Map<string, number>();
  const refinementCounts = new Map<string, number>();
  const refinementAchieved = new Map<string, number>();

  for (const session of sessions) {
    increment(uiModes, session.uiMode);

    const metrics = session.finalItinerary.metrics;
    increment(regions, 'gwangju', metrics.stopsByRegion.gwangju);
    increment(regions, 'jeonnam', metrics.stopsByRegion.jeonnam);

    const bucket = LINKAGE_BUCKETS.find(
      (entry) => metrics.linkageScore >= entry.min && metrics.linkageScore < entry.max,
    );
    if (bucket) increment(buckets, bucket.key);

    for (const attractionId of session.finalItinerary.stopAttractionIds) {
      increment(attractions, attractionId);
    }
    for (const exclusion of session.exclusions) {
      increment(exclusions, exclusion.reason);
    }
    for (const trace of session.refinements) {
      increment(refinementCounts, trace.refinementId);
      if (trace.objectiveSatisfied) increment(refinementAchieved, trace.refinementId);
    }
  }

  const refinementUsage: AchievementEntry[] = toEntries(
    refinementCounts,
    (key) => REFINEMENT_DEFINITIONS[key as keyof typeof REFINEMENT_DEFINITIONS]?.label ?? key,
  ).map((entry) => ({
    ...entry,
    achievedRatio: roundTo(((refinementAchieved.get(entry.key) ?? 0) / entry.value) * 100, 1),
  }));

  return {
    sessionCount: sessions.length,
    averages: {
      linkageScore: roundTo(
        average(sessions.map((session) => session.finalItinerary.metrics.linkageScore)),
        1,
      ),
      trustScore: roundTo(
        average(sessions.map((session) => session.finalItinerary.metrics.averageTrust)),
        1,
      ),
      walkingLoad: roundTo(
        average(sessions.map((session) => session.finalItinerary.metrics.walkingLoad)),
        1,
      ),
      travelMinutes: Math.round(
        average(sessions.map((session) => session.finalItinerary.metrics.travelMinutes)),
      ),
      generationMs: roundTo(average(sessions.map((session) => session.generationMs)), 1),
    },
    uiModeShare: toEntries(uiModes, (key) => (key === 'large' ? '큰 글씨 모드' : '일반 모드')),
    regionShare: toEntries(regions, (key) => REGION_LABEL[key as Region] ?? key),
    // 구간 분포는 값 순서가 아니라 구간 순서로 보여야 분포로 읽힌다.
    linkageDistribution: LINKAGE_BUCKETS.map((bucket) => {
      const value = buckets.get(bucket.key) ?? 0;
      return {
        key: bucket.key,
        label: bucket.label,
        value,
        share: roundTo((value / (sessions.length || 1)) * 100, 1),
      };
    }),
    topAttractions: toEntries(
      attractions,
      (key) => getAttraction(key)?.name ?? key,
      8,
    ),
    exclusionReasons: toEntries(
      exclusions,
      (key) => EXCLUSION_REASON_LABELS[key as keyof typeof EXCLUSION_REASON_LABELS] ?? key,
    ),
    refinementUsage,
    qrGeneratedRatio:
      sessions.length === 0
        ? 0
        : roundTo(
            (sessions.filter((session) => session.qrGenerated).length / sessions.length) * 100,
            1,
          ),
  };
}
