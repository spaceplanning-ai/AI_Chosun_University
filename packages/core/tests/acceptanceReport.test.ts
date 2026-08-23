/**
 * 기준질문 시험결과서와 연구모형 검증.
 *
 * 시험결과서는 검수 회의에 제출되는 산출물이므로,
 * "화면에는 미달인데 문서에는 충족으로 적히는" 어긋남이 절대 나오면 안 된다.
 * 그래서 문서에 찍히는 판정 문자열과 지표값이 report 와 같은지 직접 대조한다.
 *
 * 연구모형은 "설문으로 받아야 할 값에 로그 필드를 붙여 두는" 실수를 막는다.
 * 그렇게 되면 측정하지 않은 값을 측정한 것처럼 논문에 쓰게 된다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateAcceptance } from '../src/domain/shared/acceptance';
import {
  buildAcceptanceCsv,
  buildAcceptanceMarkdown,
} from '../src/domain/shared/acceptanceReport';
import {
  RESEARCH_VARIABLES,
  VARIABLE_ROLE_LABELS,
  logCoverageRatio,
} from '../src/data/researchModel';

const EXECUTED_AT = '2026-08-10T09:00:00.000Z';
const REFERENCE_DATE = '2026-08-10';
const REPORT = evaluateAcceptance();
const MARKDOWN = buildAcceptanceMarkdown({
  report: REPORT,
  executedAt: EXECUTED_AT,
  referenceDate: REFERENCE_DATE,
});
const CSV = buildAcceptanceCsv(REPORT);

describe('시험결과서와 화면의 일치', () => {
  it('모든 지표의 실측값과 목표값이 문서에 그대로 실린다', () => {
    for (const metric of REPORT.metrics) {
      assert.ok(
        MARKDOWN.includes(`${metric.value}${metric.unit}`),
        `실측값 누락: ${metric.label}`,
      );
      assert.ok(
        MARKDOWN.includes(`${metric.target}${metric.unit}`),
        `목표값 누락: ${metric.label}`,
      );
    }
  });

  it('종합 판정 문구가 report.passed 와 어긋나지 않는다', () => {
    const saysPassed = MARKDOWN.includes('충족 — 모든 지표가 목표를 넘었습니다.');
    const saysFailed = MARKDOWN.includes('미달 — 아래 표에서');
    assert.equal(saysPassed, REPORT.passed);
    assert.equal(saysFailed, !REPORT.passed);
  });

  it('시험 시각과 기준일이 문서에 남는다', () => {
    // 언제 측정한 값인지 없는 결과서는 검수 근거가 되지 못한다.
    assert.ok(MARKDOWN.includes(EXECUTED_AT));
    assert.ok(MARKDOWN.includes(REFERENCE_DATE));
  });

  it('질문 전체가 상세표에 실린다', () => {
    for (const result of REPORT.results) {
      assert.ok(MARKDOWN.includes(result.question.id), `누락된 질문: ${result.question.id}`);
    }
  });

  it('미달 질문이 없으면 그 사실을 명시한다', () => {
    const failures = REPORT.results.filter(
      (result) => !result.hasCitation || !result.matchesEvidence,
    );
    if (failures.length === 0) {
      assert.ok(MARKDOWN.includes('없습니다. 모든 질문에서'));
    } else {
      for (const failure of failures) {
        assert.ok(MARKDOWN.includes(failure.question.question));
      }
    }
  });
});

describe('시험결과 원자료 CSV', () => {
  it('머리글 한 줄 + 질문 수만큼의 행이 된다', () => {
    // 줄바꿈이 들어간 값이 있으면 행 수가 어긋난다. 인용부호 처리가 살아 있는지 함께 본다.
    const lines = CSV.trimEnd().split('\n');
    assert.equal(lines.length, REPORT.results.length + 1);
  });

  it('출처제시·근거일치가 Y/N 로만 적힌다', () => {
    for (const line of CSV.trimEnd().split('\n').slice(1)) {
      const cells = line.split(',');
      assert.ok(cells.includes('Y') || cells.includes('N'));
    }
  });
});

describe('연구모형과 로그의 대응', () => {
  it('변수 id 가 중복되지 않는다', () => {
    const ids = RESEARCH_VARIABLES.map((variable) => variable.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('세 가지 역할이 모두 채워져 있다', () => {
    for (const role of Object.keys(VARIABLE_ROLE_LABELS)) {
      assert.ok(
        RESEARCH_VARIABLES.some((variable) => variable.role === role),
        `역할 누락: ${role}`,
      );
    }
  });

  it('로그로 측정한다고 적은 변수에는 반드시 필드명이 있다', () => {
    for (const variable of RESEARCH_VARIABLES) {
      if (variable.measurement.kind !== 'log') continue;
      assert.ok(
        variable.measurement.field.trim().length > 0,
        `필드명이 비어 있다: ${variable.id}`,
      );
    }
  });

  it('설문·측정불가 변수는 로그 필드를 갖지 않는다', () => {
    // 설문값에 로그 필드를 붙여 두면 측정한 것처럼 오해된다. 타입으로 막히지만 의도를 남긴다.
    for (const variable of RESEARCH_VARIABLES) {
      if (variable.measurement.kind === 'log') continue;
      assert.ok(!('field' in variable.measurement));
    }
  });

  it('로그 측정 비율이 0~100 사이의 정수다', () => {
    const ratio = logCoverageRatio();
    assert.ok(Number.isInteger(ratio));
    assert.ok(ratio >= 0 && ratio <= 100);
  });
});
