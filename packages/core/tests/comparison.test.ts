/**
 * 비교 테스트 모드 검증.
 *
 * 이 결과가 특허의 진보성 주장과 논문의 비교 자극물로 쓰이므로,
 * "비교가 공정하게 이루어졌는가"를 테스트가 지킨다.
 * 대조군이 실수로 제안 방식의 검증 로직을 물려받으면 비교가 무의미해지는데,
 * 그런 회귀를 눈으로 잡기는 어렵다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEMO_SCENARIOS } from '../src/data/scenarios';
import {
  BASELINES,
  BASELINE_IDS,
  compareAlgorithms,
  compareScenario,
} from '../src/domain/shared/comparison';

const REFERENCE_DATE = '2026-08-10';
const CONDITION_SETS = DEMO_SCENARIOS.map((scenario) => scenario.conditions);
const REPORT = compareAlgorithms(CONDITION_SETS, REFERENCE_DATE);

describe('비교의 공정성', () => {
  it('모든 방식이 같은 조건으로 실행된다', () => {
    for (const [index, scenario] of REPORT.scenarios.entries()) {
      assert.deepEqual(scenario.conditions, CONDITION_SETS[index]);
    }
  });

  it('대조군이 정의된 수만큼 실행된다', () => {
    for (const scenario of REPORT.scenarios) {
      assert.equal(scenario.baselines.length, BASELINE_IDS.length);
    }
  });

  it('대조군 정의가 화면·문서에 노출할 수 있을 만큼 갖춰져 있다', () => {
    for (const id of BASELINE_IDS) {
      const baseline = BASELINES[id];
      assert.ok(baseline.name.length > 0);
      assert.ok(baseline.models.length > 0, `${id}: 모사 대상 설명 없음`);
      assert.ok(baseline.rule.length > 0, `${id}: 선정 규칙 없음`);
      assert.ok(baseline.omits.length > 0, `${id}: 미수행 처리 목록 없음`);
    }
  });

  it('같은 입력이면 비교 결과도 재현된다', () => {
    const again = compareScenario(CONDITION_SETS[0]!, REFERENCE_DATE);
    assert.deepEqual(again.proposed.attractionIds, REPORT.scenarios[0]!.proposed.attractionIds);
    assert.deepEqual(
      again.baselines.map((baseline) => baseline.attractionIds),
      REPORT.scenarios[0]!.baselines.map((baseline) => baseline.attractionIds),
    );
  });
});

describe('대조군이 제안 방식의 처리를 물려받지 않는다', () => {
  it('대조군은 추천 근거를 산출하지 않는다', () => {
    for (const scenario of REPORT.scenarios) {
      for (const baseline of scenario.baselines) {
        assert.equal(
          baseline.measures.explainedRatio,
          0,
          `${baseline.name}: 근거 제시율이 0이 아니면 대조군 정의가 오염된 것`,
        );
      }
    }
  });

  it('제안 방식은 모든 방문지에 근거를 제시한다', () => {
    for (const scenario of REPORT.scenarios) {
      assert.equal(scenario.proposed.measures.explainedRatio, 100);
    }
  });

  it('제안 방식은 운영시간·활동시간 위반을 만들지 않는다', () => {
    for (const scenario of REPORT.scenarios) {
      assert.equal(scenario.proposed.measures.openingHourViolations, 0);
      assert.equal(scenario.proposed.measures.overloadedDays, 0);
    }
  });

  it('대조군은 검증을 하지 않으므로 위반이 실제로 발생한다', () => {
    // 위반이 한 번도 없다면 대조군이 제안 방식과 사실상 같아진 것이므로 비교가 성립하지 않는다.
    const totalViolations = REPORT.scenarios.reduce(
      (total, scenario) =>
        total +
        scenario.baselines.reduce(
          (sum, baseline) =>
            sum + baseline.measures.openingHourViolations + baseline.measures.overloadedDays,
          0,
        ),
      0,
    );
    assert.ok(totalViolations > 0, '대조군에서 위반이 전혀 없으면 비교가 무의미하다');
  });
});

describe('종합 지표', () => {
  it('연계지수 개선폭이 실제 시나리오 평균과 일치한다', () => {
    const expected =
      REPORT.scenarios.reduce((total, scenario) => {
        const baselineMean =
          scenario.baselines.reduce((sum, baseline) => sum + baseline.measures.linkageScore, 0) /
          scenario.baselines.length;
        return total + (scenario.proposed.measures.linkageScore - baselineMean);
      }, 0) / REPORT.scenarios.length;

    assert.ok(
      Math.abs(REPORT.summary.linkageGain - expected) < 0.11,
      `보고값 ${REPORT.summary.linkageGain} vs 계산값 ${expected}`,
    );
  });

  it('회피 지표는 음수가 아니다', () => {
    // 음수라면 제안 방식이 대조군보다 더 많은 위반을 만들었다는 뜻이며, 그 자체가 결함이다.
    assert.ok(REPORT.summary.avoidedWalkingViolations >= 0);
    assert.ok(REPORT.summary.avoidedOpeningHourViolations >= 0);
    assert.ok(REPORT.summary.avoidedUntrustedStops >= 0);
  });

  it('제안 방식의 연계지수가 대조군 평균보다 높다', () => {
    assert.ok(
      REPORT.summary.linkageGain > 0,
      `초광역 연계가 핵심 주장인데 개선폭이 ${REPORT.summary.linkageGain}`,
    );
  });
});
