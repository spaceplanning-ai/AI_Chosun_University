/**
 * 다중 사용자 선호 병합 검증 (C단계 기능).
 *
 * 이 기능의 위험은 "합치는 방식이 조용히 잘못되는 것"이다.
 * 제약을 평균으로 합치면 누구도 만족하지 못하는 일정이 나오는데,
 * 지표는 그럴듯하게 나오므로 눈으로는 잘 안 보인다. 그래서 규칙 자체를 테스트로 고정한다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEMO_SCENARIOS } from '../src/data/scenarios';
import { requireAttraction } from '../src/data/attractions';
import { buildConditionVector } from '../src/domain/linkage-recommendation/conditionVector';
import {
  assessGroupFairness,
  buildParticipantVectors,
  mergeConditionVectors,
  type Participant,
} from '../src/domain/linkage-recommendation/groupConditions';
import { generateItinerary } from '../src/domain/linkage-recommendation/index';

const BASE = DEMO_SCENARIOS[0]!.conditions;
const REFERENCE_DATE = '2026-08-10';

const PARTICIPANTS: Participant[] = [
  { id: 'p1', label: '동행자 1', interests: ['nature', 'rest'], specialNeeds: ['lessWalking'] },
  { id: 'p2', label: '동행자 2', interests: ['food', 'photo'], specialNeeds: [] },
  { id: 'p3', label: '동행자 3', interests: ['culture', 'history'], specialNeeds: [] },
];

const ENTRIES = buildParticipantVectors(BASE, PARTICIPANTS);
const MERGED = mergeConditionVectors(ENTRIES.map((entry) => entry.vector));

describe('병합 규칙', () => {
  it('보행 감내 한계는 가장 낮은 사람을 따른다', () => {
    const lowest = Math.min(...ENTRIES.map((entry) => entry.vector.walkingTolerance));
    assert.equal(MERGED.walkingTolerance, lowest);
  });

  it('하루 활동 가능시간은 가장 짧은 사람을 따른다', () => {
    const shortest = Math.min(...ENTRIES.map((entry) => entry.vector.dailyCapacityMinutes));
    assert.equal(MERGED.dailyCapacityMinutes, shortest);
  });

  it('배려 필요도와 비용 민감도는 가장 높은 사람을 따른다', () => {
    const maxOf = (pick: (vector: (typeof ENTRIES)[number]['vector']) => number) =>
      Math.max(...ENTRIES.map((entry) => pick(entry.vector)));

    assert.equal(MERGED.seniorConsideration, maxOf((vector) => vector.seniorConsideration));
    assert.equal(MERGED.childConsideration, maxOf((vector) => vector.childConsideration));
    assert.equal(MERGED.costSensitivity, maxOf((vector) => vector.costSensitivity));
    assert.equal(MERGED.compactnessDemand, maxOf((vector) => vector.compactnessDemand));
  });

  it('제약을 평균으로 합치지 않는다', () => {
    // 평균과 같아져 버리면 "누구의 조건도 아닌" 값이 된다.
    const meanTolerance =
      ENTRIES.reduce((total, entry) => total + entry.vector.walkingTolerance, 0) / ENTRIES.length;
    const minTolerance = Math.min(...ENTRIES.map((entry) => entry.vector.walkingTolerance));

    // 참여자마다 감내 한계가 다른 구성이어야 이 테스트가 의미를 갖는다.
    assert.notEqual(meanTolerance, minTolerance);
    assert.equal(MERGED.walkingTolerance, minTolerance);
  });

  it('모든 참여자의 관심유형이 0보다 큰 가중치를 갖는다', () => {
    for (const participant of PARTICIPANTS) {
      for (const interest of participant.interests) {
        assert.ok(
          MERGED.interestWeights[interest] > 0,
          `${participant.label}의 ${interest} 가중치가 0`,
        );
      }
    }
  });

  it('관심유형 가중치 합은 1이다', () => {
    const total = Object.values(MERGED.interestWeights).reduce((sum, weight) => sum + weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  it('참여자가 한 명이면 그 사람의 벡터를 그대로 쓴다', () => {
    const single = buildParticipantVectors(BASE, [PARTICIPANTS[0]!]);
    assert.deepEqual(mergeConditionVectors(single.map((entry) => entry.vector)), single[0]!.vector);
  });

  it('빈 목록을 병합하려 하면 조용히 넘어가지 않는다', () => {
    assert.throws(() => mergeConditionVectors([]));
  });
});

describe('병합 결과로 만든 일정', () => {
  const { itinerary } = generateItinerary({
    conditions: {
      ...BASE,
      interests: [...new Set(PARTICIPANTS.flatMap((participant) => participant.interests))],
    },
    conditionVector: MERGED,
    referenceDate: REFERENCE_DATE,
    itineraryId: 'it_group',
  });

  const attractions = itinerary.days
    .flatMap((day) => day.stops)
    .map((stop) => requireAttraction(stop.attractionId));

  it('가장 제약이 큰 참여자의 보행 한계를 크게 넘지 않는다', () => {
    const limit = MERGED.walkingTolerance;
    const exceeded = attractions.filter((attraction) => attraction.walkingLoad > limit + 28);
    assert.deepEqual(
      exceeded.map((attraction) => `${attraction.name}(${attraction.walkingLoad})`),
      [],
      `감내 한계 ${limit}`,
    );
  });

  it('미리 만든 벡터를 넘기면 그것이 그대로 추적 기록에 남는다', () => {
    const { trace } = generateItinerary({
      conditions: BASE,
      conditionVector: MERGED,
      referenceDate: REFERENCE_DATE,
      itineraryId: 'it_group2',
    });
    assert.deepEqual(trace.conditionVector, MERGED);
  });

  it('벡터를 넘기지 않으면 조건에서 새로 만든다', () => {
    const { trace } = generateItinerary({
      conditions: BASE,
      referenceDate: REFERENCE_DATE,
      itineraryId: 'it_solo',
    });
    assert.deepEqual(trace.conditionVector, buildConditionVector(BASE));
  });
});

describe('공정성 평가', () => {
  const { itinerary } = generateItinerary({
    conditions: {
      ...BASE,
      interests: [...new Set(PARTICIPANTS.flatMap((participant) => participant.interests))],
    },
    conditionVector: MERGED,
    referenceDate: REFERENCE_DATE,
    itineraryId: 'it_fair',
  });

  const attractions = itinerary.days
    .flatMap((day) => day.stops)
    .map((stop) => requireAttraction(stop.attractionId));

  const fairness = assessGroupFairness(ENTRIES, {
    categories: attractions.flatMap((attraction) => attraction.categories),
    walkingLoads: attractions.map((attraction) => attraction.walkingLoad),
  });

  it('참여자 수만큼 평가 결과가 나온다', () => {
    assert.equal(fairness.participants.length, PARTICIPANTS.length);
  });

  it('반영률은 0–100 범위다', () => {
    for (const participant of fairness.participants) {
      assert.ok(participant.coverageRatio >= 0 && participant.coverageRatio <= 100);
    }
  });

  it('균형도는 반영률 격차에서 나온다', () => {
    const ratios = fairness.participants.map((participant) => participant.coverageRatio);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    assert.equal(fairness.balance, Math.max(0, 100 - spread));
  });

  it('한 사람만 만족한 경우를 균형도가 잡아낸다', () => {
    const lopsided = assessGroupFairness(ENTRIES, {
      // 동행자 1의 관심(자연·휴식)만 담긴 일정
      categories: ['nature', 'rest'],
      walkingLoads: [20],
    });
    assert.ok(lopsided.balance < 50, `균형도 ${lopsided.balance}`);
    assert.ok(lopsided.unservedParticipants.length > 0);
  });
});
