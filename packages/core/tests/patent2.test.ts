/**
 * 특허 후보 제2안 불변식 검증.
 *
 * "최소변경"이라는 주장이 실제로 성립하는지, 그리고 재구성 결과가 갈 수 있는 일정인지를
 * 고정한다. 수동 검증에서 실제로 깨졌던 항목(운영시간 무시, 이동시간 폭증)이 그대로 테스트가 되었다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requireAttraction } from '../src/data/attractions';
import { DEMO_SCENARIOS } from '../src/data/scenarios';
import { REFINEMENT_DEFINITIONS, REFINEMENT_ORDER } from '../src/config/refinements';
import { buildConditionVector } from '../src/domain/linkage-recommendation/conditionVector';
import { generateItinerary } from '../src/domain/linkage-recommendation/index';
import { replanItinerary } from '../src/domain/minimal-change-replan/index';
import { buildMetricDeltas } from '../src/domain/minimal-change-replan/changeDiff';
import { MAX_REPLACEMENTS_PER_REQUEST } from '../src/domain/minimal-change-replan/minimalChange';
import { MINIMUM_SIMILARITY } from '../src/domain/minimal-change-replan/replacementSearch';
import { objectiveValue } from '../src/domain/minimal-change-replan/constraintChange';
import { computeMetrics } from '../src/domain/shared/metrics';
import { assessTrustForAll } from '../src/domain/linkage-recommendation/trust';
import { ATTRACTIONS } from '../src/data/attractions';
import { parseClock } from '../src/lib/time';
import type { RefinementId } from '../src/domain/types/replan';

const REFERENCE_DATE = '2026-08-10';

/** 시나리오 × 요청 전 조합을 한 번만 계산해 모든 테스트가 공유한다. */
const CASES = DEMO_SCENARIOS.flatMap((scenario) => {
  const vector = buildConditionVector(scenario.conditions);
  const generation = generateItinerary({
    conditions: scenario.conditions,
    referenceDate: REFERENCE_DATE,
    itineraryId: `it_${scenario.id}`,
  });

  return REFINEMENT_ORDER.map((refinementId: RefinementId) => ({
    scenarioId: scenario.id,
    refinementId,
    before: generation.itinerary,
    outcome: replanItinerary({
      itinerary: generation.itinerary,
      conditions: scenario.conditions,
      vector,
      refinementId,
      referenceDate: REFERENCE_DATE,
    }),
    capacityMinutes: vector.dailyCapacityMinutes,
  }));
});

const label = (entry: (typeof CASES)[number]) => `${entry.scenarioId}/${entry.refinementId}`;

describe('최소변경 원칙', () => {
  it('한 요청에서 교체되는 방문지가 상한을 넘지 않는다', () => {
    for (const entry of CASES) {
      assert.ok(
        entry.outcome.trace.replacements.length <= MAX_REPLACEMENTS_PER_REQUEST,
        `${label(entry)}: 교체 ${entry.outcome.trace.replacements.length}건`,
      );
    }
  });

  it('유지 장소 + 변경 장소 = 원래 방문지 수', () => {
    for (const entry of CASES) {
      const { keptStopIds, changedStopIds } = entry.outcome.trace;
      const originalCount = entry.before.days.flatMap((day) => day.stops).length;
      assert.equal(keptStopIds.length + changedStopIds.length, originalCount, label(entry));
    }
  });

  it('변화량이 교체 건수와 일치한다', () => {
    for (const entry of CASES) {
      const { trace } = entry.outcome;
      const originalCount = entry.before.days.flatMap((day) => day.stops).length;
      const expected = (trace.changedStopIds.length / originalCount) * 100;
      assert.ok(Math.abs(trace.changeRatio - expected) < 0.1, label(entry));
    }
  });

  it('일정 전체가 통째로 바뀌지 않는다 (절반 이상은 유지)', () => {
    for (const entry of CASES) {
      assert.ok(
        entry.outcome.trace.changeRatio <= 50,
        `${label(entry)}: 변화량 ${entry.outcome.trace.changeRatio}%`,
      );
    }
  });

  it('원본 일정을 변형하지 않는다', () => {
    // 재구성이 입력을 제자리에서 수정하면 "변경 전" 비교값이 오염된다.
    const entry = CASES[0]!;
    const beforeIds = entry.before.days.flatMap((day) =>
      day.stops.map((stop) => stop.attractionId),
    );
    replanItinerary({
      itinerary: entry.before,
      conditions: DEMO_SCENARIOS[0]!.conditions,
      vector: buildConditionVector(DEMO_SCENARIOS[0]!.conditions),
      refinementId: 'reduceWalking',
      referenceDate: REFERENCE_DATE,
    });
    assert.deepEqual(
      entry.before.days.flatMap((day) => day.stops.map((stop) => stop.attractionId)),
      beforeIds,
    );
  });
});

describe('목표 달성 판정', () => {
  it('달성으로 표시했다면 목표 지표가 실제로 그 방향으로 움직였다', () => {
    for (const entry of CASES) {
      const { trace } = entry.outcome;
      if (!trace.objectiveSatisfied) continue;

      const trust = assessTrustForAll(ATTRACTIONS.map((a) => a.id), REFERENCE_DATE);
      const beforeValue = objectiveValue(
        entry.before.days,
        computeMetrics(entry.before.days, trust),
        trace.objective,
      );
      const afterValue = objectiveValue(
        entry.outcome.itinerary.days,
        computeMetrics(entry.outcome.itinerary.days, trust),
        trace.objective,
      );

      const improved =
        trace.objective.kind === 'metric' && trace.objective.direction === 'decrease'
          ? afterValue < beforeValue
          : afterValue > beforeValue;
      assert.ok(improved, `${label(entry)}: ${beforeValue} → ${afterValue}`);
    }
  });

  it('미달성이면 일정이 바뀌지 않았다', () => {
    for (const entry of CASES) {
      const { trace } = entry.outcome;
      if (trace.objectiveSatisfied) continue;
      assert.equal(trace.replacements.length, 0, `${label(entry)}: 미달성인데 교체가 일어남`);
      assert.equal(trace.changeRatio, 0, label(entry));
    }
  });

  it('교체가 없으면 지표가 그대로다', () => {
    for (const entry of CASES) {
      if (entry.outcome.trace.replacements.length > 0) continue;
      assert.deepEqual(entry.outcome.trace.after, entry.outcome.trace.before, label(entry));
    }
  });
});

describe('재구성 결과의 실현 가능성', () => {
  it('교체 후에도 모든 방문이 운영시간 안에서 끝난다', () => {
    for (const entry of CASES) {
      for (const day of entry.outcome.itinerary.days) {
        for (const stop of day.stops) {
          const attraction = requireAttraction(stop.attractionId);
          assert.ok(
            stop.startMinutes + stop.stayMinutes <= parseClock(attraction.openingHours.close),
            `${label(entry)}: ${attraction.name} 이 마감을 넘김`,
          );
        }
      }
    }
  });

  it('교체 후에도 하루 활동 가능시간을 넘지 않는다', () => {
    for (const entry of CASES) {
      for (const day of entry.outcome.itinerary.days) {
        const load = day.stops.reduce(
          (total, stop) => total + stop.travelFromPreviousMinutes + stop.stayMinutes,
          0,
        );
        assert.ok(
          load <= entry.capacityMinutes,
          `${label(entry)}: ${day.dayIndex}일차 ${load}분 > ${entry.capacityMinutes}분`,
        );
      }
    }
  });

  it('같은 관광지가 두 번 들어가지 않는다', () => {
    for (const entry of CASES) {
      const ids = entry.outcome.itinerary.days.flatMap((day) =>
        day.stops.map((stop) => stop.attractionId),
      );
      assert.equal(new Set(ids).size, ids.length, label(entry));
    }
  });
});

describe('교체 근거의 설명가능성', () => {
  it('채택된 교체는 유사도 기준을 만족한다', () => {
    for (const entry of CASES) {
      for (const replacement of entry.outcome.trace.replacements) {
        assert.ok(
          replacement.similarity >= MINIMUM_SIMILARITY,
          `${label(entry)}: 유사도 ${replacement.similarity}`,
        );
        assert.ok(replacement.metricGain > 0, `${label(entry)}: 개선폭이 0 이하`);
        assert.ok(replacement.reasons.length > 0, `${label(entry)}: 변경 이유 없음`);
      }
    }
  });

  it('기각된 대체안에 사유가 남는다', () => {
    for (const entry of CASES) {
      for (const alternative of entry.outcome.trace.rejectedAlternatives) {
        assert.ok(alternative.reason.length > 0, `${label(entry)}: 기각 사유 없음`);
      }
    }
  });

  it('영향도 순위가 내림차순이다', () => {
    for (const entry of CASES) {
      const contributions = entry.outcome.trace.impactRanking.map((impact) => impact.contribution);
      for (let index = 1; index < contributions.length; index += 1) {
        assert.ok(contributions[index - 1]! >= contributions[index]!, label(entry));
      }
    }
  });

  it('변경 전/후 비교표의 방향 판정이 실제 증감과 맞는다', () => {
    for (const entry of CASES) {
      const { trace } = entry.outcome;
      for (const delta of buildMetricDeltas(trace.before, trace.after, trace.objective)) {
        assert.equal(delta.delta, Number((delta.after - delta.before).toFixed(1)), label(entry));
        if (delta.delta === 0) assert.equal(delta.direction, 'unchanged', label(entry));
      }
    }
  });
});

describe('납품 단계 게이트', () => {
  it('A단계에서는 제한형 2종만 노출된다', () => {
    const phaseA = REFINEMENT_ORDER.filter((id) => REFINEMENT_DEFINITIONS[id].phase === 'A');
    assert.equal(phaseA.length, 2);
    assert.deepEqual(phaseA, ['reduceWalking', 'preferIndoor']);
  });

  it('전종 6개가 정의되어 있고 모두 서로 다른 목표를 갖는다', () => {
    assert.equal(REFINEMENT_ORDER.length, 6);
    const objectives = REFINEMENT_ORDER.map((id) =>
      JSON.stringify(REFINEMENT_DEFINITIONS[id].objective),
    );
    assert.equal(new Set(objectives).size, 6);
  });
});
