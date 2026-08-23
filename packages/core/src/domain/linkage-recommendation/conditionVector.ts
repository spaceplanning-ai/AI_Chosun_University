/**
 * 특허 후보 제1안 — 처리단계 3) 여행조건을 복수의 평가요소로 변환하는 단계.
 *
 * 선택형 입력(동행자·기간·관심·이동수단·특별조건)을 연속값 벡터로 바꾼다.
 * 이후의 모든 점수 계산은 원본 선택값이 아니라 이 벡터만을 입력으로 받는다.
 * 조건이 하나 바뀌었을 때 어떤 평가요소가 얼마나 움직였는지를 벡터 비교만으로 설명할 수 있어야 하기 때문이다.
 */

import { DAY_COUNT_BY_DURATION, SCHEDULING } from '../../config/scoring';
import { clamp, clampScore, sum } from '../../lib/number';
import { INTERESTS } from '../types/travel';
import type { Companion, ConditionVector, Interest, TravelConditions } from '../types/travel';

/** 동행유형이 암묵적으로 시사하는 관심분야. 명시 선택이 없을 때의 사전분포로 쓴다. */
const COMPANION_INTEREST_PRIORS: Record<Companion, readonly Interest[]> = {
  solo: ['photo', 'culture', 'rest'],
  couple: ['photo', 'food', 'culture'],
  friends: ['food', 'activity', 'photo'],
  child: ['activity', 'nature', 'rest'],
  parents: ['rest', 'nature', 'food'],
  group: ['food', 'culture', 'history'],
};

/** 명시적으로 고른 관심분야의 기본 가중치. */
const EXPLICIT_INTEREST_WEIGHT = 1;

/** 동행유형에서 추론한 관심분야의 가중치. 명시 선택보다 약하게 반영한다. */
const IMPLICIT_INTEREST_WEIGHT = 0.32;

function buildInterestWeights(conditions: TravelConditions): Record<Interest, number> {
  const raw = Object.fromEntries(INTERESTS.map((interest) => [interest, 0])) as Record<
    Interest,
    number
  >;

  for (const interest of conditions.interests) {
    raw[interest] += EXPLICIT_INTEREST_WEIGHT;
  }
  for (const interest of COMPANION_INTEREST_PRIORS[conditions.companion]) {
    raw[interest] += IMPLICIT_INTEREST_WEIGHT;
  }

  const total = sum(Object.values(raw));
  if (total === 0) {
    // 어떤 신호도 없으면 균등분포로 둔다. 0으로 두면 이후 취향 적합도가 전부 0이 된다.
    const uniform = 1 / INTERESTS.length;
    return Object.fromEntries(INTERESTS.map((interest) => [interest, uniform])) as Record<
      Interest,
      number
    >;
  }

  return Object.fromEntries(
    INTERESTS.map((interest) => [interest, raw[interest] / total]),
  ) as Record<Interest, number>;
}

export function buildConditionVector(conditions: TravelConditions): ConditionVector {
  const needs = new Set(conditions.specialNeeds);
  const { companion, transport } = conditions;

  // 보행 관련 조건은 서로 겹친다. '걷기 적게' + '부모님과 편하게'를 모두 고른 이용자에게
  // 감점을 단순 합산하면 감내 한계가 0에 붙어 후보 대부분이 사라진다.
  // 따라서 특별조건은 최댓값 하나만 반영하고, 동행유형 감점만 더한 뒤 하한을 둔다.
  const needWalkingPenalty = Math.max(
    needs.has('lessWalking') ? 26 : 0,
    needs.has('seniorFriendly') ? 20 : 0,
    needs.has('childFriendly') ? 12 : 0,
  );
  const companionWalkingPenalty =
    companion === 'parents' ? 16 : companion === 'child' ? 10 : companion === 'group' ? 6 : 0;
  const walkingTolerance = clamp(72 - needWalkingPenalty - companionWalkingPenalty, 30, 100);

  const indoorPreference = clampScore(
    38 +
      (needs.has('moreIndoor') ? 34 : 0) +
      (conditions.interests.includes('rest') ? 8 : 0) +
      (conditions.interests.includes('culture') ? 6 : 0) +
      (conditions.interests.includes('nature') ? -14 : 0) +
      (conditions.interests.includes('sea') ? -16 : 0),
  );

  const costSensitivity = clampScore(
    38 + (needs.has('lowerCost') ? 34 : 0) + (companion === 'group' ? 10 : 0),
  );

  const transitDependency = clampScore(
    transport === 'transit' ? 92 : transport === 'undecided' ? 58 : transport === 'rentalCar' ? 24 : 10,
  );

  const seniorConsideration = clampScore(
    (companion === 'parents' ? 82 : companion === 'group' ? 36 : 8) +
      (needs.has('seniorFriendly') ? 16 : 0),
  );

  const childConsideration = clampScore(
    (companion === 'child' ? 86 : 4) + (needs.has('childFriendly') ? 14 : 0),
  );

  const compactnessDemand = clampScore(
    38 +
      (needs.has('shorterDistance') ? 34 : 0) +
      (needs.has('lessWalking') ? 12 : 0) +
      (transport === 'transit' ? 10 : 0),
  );

  const dailyCapacityMinutes = clamp(
    SCHEDULING.baseDailyMinutes +
      (companion === 'parents' ? -70 : 0) +
      (companion === 'child' ? -55 : 0) +
      (needs.has('lessWalking') ? -35 : 0),
    300,
    SCHEDULING.baseDailyMinutes,
  );

  return {
    interestWeights: buildInterestWeights(conditions),
    walkingTolerance,
    indoorPreference,
    costSensitivity,
    dailyCapacityMinutes,
    transitDependency,
    seniorConsideration,
    childConsideration,
    compactnessDemand,
    dayCount: DAY_COUNT_BY_DURATION[conditions.duration],
    origin: conditions.origin,
  };
}

/**
 * 조건벡터에 제약조건 변화량을 더한다.
 * 특허 후보 제2안이 재계산을 위해 호출하지만, 벡터를 소유한 쪽은 제1안 모듈이므로 여기에 둔다.
 */
export function applyVectorDelta(
  vector: ConditionVector,
  delta: {
    walkingTolerance?: number;
    indoorPreference?: number;
    costSensitivity?: number;
    compactnessDemand?: number;
    interestBoost?: Partial<Record<Interest, number>>;
  },
): ConditionVector {
  const boosted = { ...vector.interestWeights };
  if (delta.interestBoost) {
    for (const [interest, boost] of Object.entries(delta.interestBoost)) {
      boosted[interest as Interest] = Math.max(0, boosted[interest as Interest] + (boost ?? 0));
    }
  }
  const total = sum(Object.values(boosted));
  const interestWeights =
    total > 0
      ? (Object.fromEntries(
          INTERESTS.map((interest) => [interest, boosted[interest] / total]),
        ) as Record<Interest, number>)
      : vector.interestWeights;

  return {
    ...vector,
    interestWeights,
    walkingTolerance: clampScore(vector.walkingTolerance + (delta.walkingTolerance ?? 0)),
    indoorPreference: clampScore(vector.indoorPreference + (delta.indoorPreference ?? 0)),
    costSensitivity: clampScore(vector.costSensitivity + (delta.costSensitivity ?? 0)),
    compactnessDemand: clampScore(vector.compactnessDemand + (delta.compactnessDemand ?? 0)),
  };
}
