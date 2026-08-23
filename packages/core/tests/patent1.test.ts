/**
 * 특허 후보 제1안 불변식 검증.
 *
 * 검수 게이트가 "재현 가능"을 요구하므로(피드백 4장), 재현성과 규칙 준수를 사람 눈이 아니라
 * 테스트가 지킨다. 각 테스트는 수동 검증 과정에서 실제로 무너졌던 지점을 그대로 고정한 것이다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ATTRACTIONS, requireAttraction } from '../src/data/attractions';
import { DEMO_SCENARIOS } from '../src/data/scenarios';
import { SCHEDULING, TRUST_THRESHOLDS } from '../src/config/scoring';
import { buildConditionVector } from '../src/domain/linkage-recommendation/conditionVector';
import { filterEligible } from '../src/domain/linkage-recommendation/eligibility';
import { assessLinkage } from '../src/domain/linkage-recommendation/linkageIndex';
import { assessTrust, assessTrustForAll } from '../src/domain/linkage-recommendation/trust';
import { generateItinerary } from '../src/domain/linkage-recommendation/index';
import { parseClock } from '../src/lib/time';
import type { TravelConditions } from '../src/domain/types/travel';

const REFERENCE_DATE = '2026-08-10';

function generate(conditions: TravelConditions) {
  return generateItinerary({ conditions, referenceDate: REFERENCE_DATE, itineraryId: 'it_test' });
}

describe('조건벡터 구조화 (처리단계 3)', () => {
  it('보행 관련 조건이 겹쳐도 감내 한계가 바닥나지 않는다', () => {
    // 감점을 단순 합산하면 0이 되어 후보 대부분이 사라졌던 회귀를 고정한다.
    const vector = buildConditionVector({
      companion: 'parents',
      duration: 'oneNight',
      interests: ['nature'],
      transport: 'transit',
      specialNeeds: ['lessWalking', 'seniorFriendly'],
      origin: '서울역',
    });
    assert.ok(vector.walkingTolerance >= 30, `walkingTolerance=${vector.walkingTolerance}`);
  });

  it('관심유형 가중치의 합은 항상 1이다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const vector = buildConditionVector(scenario.conditions);
      const total = Object.values(vector.interestWeights).reduce((sum, w) => sum + w, 0);
      assert.ok(Math.abs(total - 1) < 1e-9, `${scenario.id}: 합계 ${total}`);
    }
  });

  it('관심분야를 하나도 고르지 않아도 가중치가 0으로 붕괴하지 않는다', () => {
    const vector = buildConditionVector({
      companion: 'solo',
      duration: 'day',
      interests: [],
      transport: 'undecided',
      specialNeeds: [],
      origin: '서울역',
    });
    assert.ok(Math.max(...Object.values(vector.interestWeights)) > 0);
  });
});

describe('정보 신뢰도 (처리단계 4·5)', () => {
  it('노후 단일 출처만 가진 관광지는 제외 판정을 받는다', () => {
    // 나주 영산포는 2024년 상인회 자료 1건뿐 — 제외 규칙이 시연 중 실제로 발동해야 한다.
    const assessment = assessTrust('yeongsanpo', REFERENCE_DATE);
    assert.equal(assessment.verdict, 'excluded');
    assert.ok(assessment.score < TRUST_THRESHOLDS.exclude);
  });

  it('복수 공식기관이 최근 갱신한 관광지는 채택 판정을 받는다', () => {
    const assessment = assessTrust('acc', REFERENCE_DATE);
    assert.equal(assessment.verdict, 'accepted');
    assert.ok(assessment.score >= TRUST_THRESHOLDS.demote);
  });

  it('모든 신뢰도 요소가 근거 문장을 동반한다', () => {
    for (const attraction of ATTRACTIONS) {
      for (const factor of assessTrust(attraction.id, REFERENCE_DATE).factors) {
        assert.ok(factor.evidence.length > 0, `${attraction.id}/${factor.id} 근거 문장 없음`);
      }
    }
  });
});

describe('초광역 연계지수 (처리단계 6)', () => {
  it('한 지역만으로 구성된 일정은 지역 균형·이동 효율이 0이다', () => {
    const gwangjuOnly = ATTRACTIONS.filter((a) => a.region === 'gwangju').slice(0, 3);
    const linkage = assessLinkage(gwangjuOnly);
    const componentValue = (id: string) =>
      linkage.components.find((component) => component.id === id)?.value;

    assert.equal(componentValue('regionBalance'), 0);
    assert.equal(componentValue('corridorEfficiency'), 0);
  });

  it('두 지역이 섞였다고 자동으로 만점이 되지는 않는다', () => {
    // 제안서 7.2가 배제한 "무조건 각 지역 한 곳씩" 규칙과 본 지수를 구분하는 지점이다.
    const mixed = [requireAttraction('acc'), requireAttraction('purple-island')];
    const linkage = assessLinkage(mixed);
    assert.ok(linkage.score < 100, `score=${linkage.score}`);
  });

  it('경계를 여러 번 넘나들수록 이동 효율이 낮아진다', () => {
    const efficient = ['acc', 'yangnim', 'juknokwon', 'gwanbangjerim'].map(requireAttraction);
    const zigzag = ['acc', 'juknokwon', 'yangnim', 'gwanbangjerim'].map(requireAttraction);

    const efficiencyOf = (attractions: typeof efficient) =>
      assessLinkage(attractions).components.find((c) => c.id === 'corridorEfficiency')?.value ?? 0;

    assert.ok(efficiencyOf(efficient) > efficiencyOf(zigzag));
  });
});

describe('후보 제외 (처리단계 5)', () => {
  it('모든 제외 기록에 단계·사유·설명이 붙는다', () => {
    const conditions = DEMO_SCENARIOS[0]!.conditions;
    const vector = buildConditionVector(conditions);
    const trust = assessTrustForAll(ATTRACTIONS.map((a) => a.id), REFERENCE_DATE);
    const { exclusions } = filterEligible({
      attractions: ATTRACTIONS,
      vector,
      conditions,
      trust,
      referenceDate: REFERENCE_DATE,
    });

    assert.ok(exclusions.length > 0, '제외 사례가 하나도 없으면 설명가능성을 시연할 수 없다');
    for (const exclusion of exclusions) {
      assert.ok(exclusion.reason.length > 0);
      assert.ok(exclusion.stage.length > 0);
      assert.ok(exclusion.detail.length > 0, `${exclusion.attractionId}: 상세 설명 없음`);
    }
  });

  it('제외된 관광지는 최종 일정에 등장하지 않는다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const { itinerary, trace } = generate(scenario.conditions);
      const placed = new Set(
        itinerary.days.flatMap((day) => day.stops).map((stop) => stop.attractionId),
      );
      for (const exclusion of trace.exclusions) {
        assert.ok(
          !placed.has(exclusion.attractionId),
          `${scenario.id}: ${exclusion.attractionId} 가 제외 기록과 일정에 동시에 존재`,
        );
      }
    }
  });
});

describe('일정 생성 (처리단계 7·8)', () => {
  it('같은 입력과 같은 기준일이면 항상 같은 결과가 나온다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const first = generate(scenario.conditions).itinerary;
      const second = generate(scenario.conditions).itinerary;
      assert.deepEqual(
        first.days.flatMap((day) => day.stops.map((stop) => stop.attractionId)),
        second.days.flatMap((day) => day.stops.map((stop) => stop.attractionId)),
        `${scenario.id}: 재현되지 않음`,
      );
      assert.equal(first.metrics.linkageScore, second.metrics.linkageScore);
    }
  });

  it('빈 날이 결과에 남지 않는다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      for (const day of generate(scenario.conditions).itinerary.days) {
        assert.ok(day.stops.length > 0, `${scenario.id}: ${day.dayIndex}일차가 비어 있음`);
      }
    }
  });

  it('같은 관광지가 한 일정에 두 번 들어가지 않는다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const ids = generate(scenario.conditions).itinerary.days.flatMap((day) =>
        day.stops.map((stop) => stop.attractionId),
      );
      assert.equal(new Set(ids).size, ids.length, `${scenario.id}: 중복 방문지`);
    }
  });

  it('모든 방문이 운영시간 안에서 끝난다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      for (const day of generate(scenario.conditions).itinerary.days) {
        for (const stop of day.stops) {
          const attraction = requireAttraction(stop.attractionId);
          const endsAt = stop.startMinutes + stop.stayMinutes;
          assert.ok(
            endsAt <= parseClock(attraction.openingHours.close),
            `${scenario.id}: ${attraction.name} 종료 ${endsAt}분 > 마감 ${attraction.openingHours.close}`,
          );
          assert.ok(
            stop.startMinutes >= parseClock(attraction.openingHours.open),
            `${scenario.id}: ${attraction.name} 개장 전 시작`,
          );
        }
      }
    }
  });

  it('하루 일정이 활동 가능시간을 넘지 않는다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const vector = buildConditionVector(scenario.conditions);
      for (const day of generate(scenario.conditions).itinerary.days) {
        const load = day.stops.reduce(
          (total, stop) => total + stop.travelFromPreviousMinutes + stop.stayMinutes,
          0,
        );
        assert.ok(
          load <= vector.dailyCapacityMinutes,
          `${scenario.id}: ${day.dayIndex}일차 ${load}분 > 한도 ${vector.dailyCapacityMinutes}분`,
        );
      }
    }
  });

  it('하루 방문지 수가 상한을 넘지 않는다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      for (const day of generate(scenario.conditions).itinerary.days) {
        assert.ok(day.stops.length <= SCHEDULING.maxStopsPerDay);
      }
    }
  });

  it('모든 방문지가 수치를 포함한 추천 근거와 근거문서를 갖는다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      for (const day of generate(scenario.conditions).itinerary.days) {
        for (const stop of day.stops) {
          assert.ok(stop.rationale.reasons.length > 0, `${stop.attractionId}: 추천 이유 없음`);
          assert.ok(
            stop.rationale.sourceDocumentIds.length > 0,
            `${stop.attractionId}: 근거문서 없음`,
          );
        }
      }
    }
  });

  it('연계 보정은 연계지수가 실제로 올라갈 때만 적용된다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const correction = generate(scenario.conditions).trace.linkageCorrection;
      if (!correction) continue;
      assert.ok(
        correction.linkageAfter > correction.linkageBefore,
        `${scenario.id}: 보정 후 연계지수가 오르지 않음`,
      );
    }
  });

  it('화면에 표시되는 지표와 로그의 연계지수가 일치한다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const { itinerary, trace } = generate(scenario.conditions);
      assert.equal(itinerary.metrics.linkageScore, trace.linkage.score, scenario.id);
      assert.equal(itinerary.metrics.linkageScore, itinerary.linkage.score, scenario.id);
    }
  });
});
