/**
 * 다중 사용자 선호 병합 — C단계 확장 (제안서 12.3 / 16장 C안 "다중 사용자 선호 입력").
 *
 * 제안서 5.3의 관찰에서 출발한다. "여행은 개인보다 가족·연인·친구가 함께 결정하는 경우가 많다."
 * 그런데 조건 입력은 한 사람이 대표로 한다. 동행자마다 원하는 것이 다르면 대표자의 취향만 반영된다.
 *
 * ── 병합 원칙 ──────────────────────────────────────────────────────
 * 취향과 제약을 **다르게** 합친다. 이것이 이 모듈의 핵심 판단이다.
 *
 *   취향(관심유형)  → 합산 후 정규화. 모두의 관심이 조금씩이라도 반영되어야 한다.
 *   제약(보행·시간) → 가장 제약이 큰 사람을 따른다. 한 명이 못 가면 함께 못 가기 때문이다.
 *
 * 제약까지 평균을 내면 "평균적으로는 갈 만한데 어머니는 못 걷는" 일정이 나온다.
 * 평균은 누구의 조건도 아니다.
 * ──────────────────────────────────────────────────────────────────
 */

import { average, clampScore, sum } from '../../lib/number';
import { INTERESTS } from '../types/travel';
import type { ConditionVector, Interest, SpecialNeed, TravelConditions } from '../types/travel';
import { buildConditionVector } from './conditionVector';

export interface Participant {
  id: string;
  /** 화면에 표시되는 이름. 개인정보를 담지 않도록 '동행자 1' 같은 표기를 권장한다. */
  label: string;
  interests: Interest[];
  specialNeeds: SpecialNeed[];
}

/**
 * 참여자별 조건벡터를 만든다.
 * 동행유형·기간·이동수단·출발지는 함께 여행하므로 공통값을 쓰고,
 * 관심분야와 특별조건만 각자의 값으로 대체한다.
 */
export function buildParticipantVectors(
  base: TravelConditions,
  participants: readonly Participant[],
): { participant: Participant; vector: ConditionVector }[] {
  return participants.map((participant) => ({
    participant,
    vector: buildConditionVector({
      ...base,
      interests: participant.interests,
      specialNeeds: participant.specialNeeds,
    }),
  }));
}

/**
 * 여러 조건벡터를 하나로 합친다.
 *
 * 제약 축은 최솟값(감내 한계·활동시간) 또는 최댓값(민감도·배려 필요도)을 취해
 * 가장 제약이 큰 참여자를 기준으로 삼는다.
 */
export function mergeConditionVectors(vectors: readonly ConditionVector[]): ConditionVector {
  const first = vectors[0];
  if (!first) throw new Error('병합할 조건벡터가 없습니다.');
  if (vectors.length === 1) return first;

  // 취향은 합산 후 정규화 — 소수 의견도 0이 되지 않게 한다.
  const summed = Object.fromEntries(
    INTERESTS.map((interest) => [
      interest,
      sum(vectors.map((vector) => vector.interestWeights[interest])),
    ]),
  ) as Record<Interest, number>;
  const total = sum(Object.values(summed)) || 1;
  const interestWeights = Object.fromEntries(
    INTERESTS.map((interest) => [interest, summed[interest] / total]),
  ) as Record<Interest, number>;

  const pick = (select: (vector: ConditionVector) => number, mode: 'min' | 'max' | 'mean') => {
    const values = vectors.map(select);
    if (mode === 'min') return Math.min(...values);
    if (mode === 'max') return Math.max(...values);
    return average(values);
  };

  return {
    ...first,
    interestWeights,
    // 가장 덜 걸을 수 있는 사람이 기준이 된다.
    walkingTolerance: clampScore(pick((vector) => vector.walkingTolerance, 'min')),
    dailyCapacityMinutes: pick((vector) => vector.dailyCapacityMinutes, 'min'),
    // 배려가 필요한 사람이 한 명이라도 있으면 그 필요를 그대로 반영한다.
    seniorConsideration: clampScore(pick((vector) => vector.seniorConsideration, 'max')),
    childConsideration: clampScore(pick((vector) => vector.childConsideration, 'max')),
    costSensitivity: clampScore(pick((vector) => vector.costSensitivity, 'max')),
    compactnessDemand: clampScore(pick((vector) => vector.compactnessDemand, 'max')),
    // 실내 선호는 취향에 가까우므로 평균을 쓴다.
    indoorPreference: clampScore(pick((vector) => vector.indoorPreference, 'mean')),
    transitDependency: clampScore(pick((vector) => vector.transitDependency, 'max')),
  };
}

/* ── 공정성 평가 ──────────────────────────────────────────────────── */

export interface ParticipantSatisfaction {
  participantId: string;
  label: string;
  /** 이 참여자가 고른 관심유형 중 일정에 실제로 반영된 것. */
  coveredInterests: Interest[];
  /** 고른 관심유형 중 반영된 비율(0–100). */
  coverageRatio: number;
  /** 이 참여자의 보행 감내 한계를 넘는 방문지 수. */
  walkingViolations: number;
}

export interface GroupFairness {
  participants: ParticipantSatisfaction[];
  /**
   * 0–100 균형도. 참여자 간 반영률 격차가 작을수록 높다.
   * 평균이 높아도 한 사람만 만족했다면 낮게 나온다 — 그 상황을 잡아내는 것이 이 지표의 목적이다.
   */
  balance: number;
  /** 아무 관심분야도 반영되지 못한 참여자. 비어 있어야 정상이다. */
  unservedParticipants: string[];
}

export interface ItineraryFacts {
  /** 일정에 포함된 관광지의 관광유형 전체. */
  categories: readonly Interest[];
  /** 일정에 포함된 관광지의 보행부담 목록. */
  walkingLoads: readonly number[];
}

export function assessGroupFairness(
  entries: readonly { participant: Participant; vector: ConditionVector }[],
  facts: ItineraryFacts,
): GroupFairness {
  const includedCategories = new Set(facts.categories);

  const participants: ParticipantSatisfaction[] = entries.map(({ participant, vector }) => {
    const chosen = participant.interests;
    const covered = chosen.filter((interest) => includedCategories.has(interest));

    return {
      participantId: participant.id,
      label: participant.label,
      coveredInterests: covered,
      // 관심분야를 고르지 않은 참여자는 어떤 일정에도 불만이 없다고 본다.
      coverageRatio: chosen.length === 0 ? 100 : Math.round((covered.length / chosen.length) * 100),
      walkingViolations: facts.walkingLoads.filter((load) => load > vector.walkingTolerance).length,
    };
  });

  const ratios = participants.map((participant) => participant.coverageRatio);
  const spread = ratios.length <= 1 ? 0 : Math.max(...ratios) - Math.min(...ratios);

  return {
    participants,
    balance: clampScore(100 - spread),
    unservedParticipants: participants
      .filter((participant) => participant.coverageRatio === 0)
      .map((participant) => participant.label),
  };
}
