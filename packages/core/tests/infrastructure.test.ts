/**
 * 데이터·검색·연계 인프라 검증.
 *
 * 검수 게이트 지표, QR 승계, CSV 내보내기처럼 "납품물이 실제로 쓸 수 있는가"를
 * 좌우하는 경로를 고정한다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ATTRACTIONS } from '../src/data/attractions';
import { OFFICIAL_DOCUMENTS } from '../src/data/officialDocuments';
import { BENCHMARK_QUESTIONS } from '../src/data/benchmarkQuestions';
import { DEMO_SCENARIOS } from '../src/data/scenarios';
import { validateDataset } from '../src/data/validate';
import { ACCEPTANCE_TARGETS } from '../src/config/kiosk';
import { evaluateAcceptance } from '../src/domain/shared/acceptance';
import { generateItinerary } from '../src/domain/linkage-recommendation/index';
import {
  buildHandoffPayload,
  decodeHandoff,
  encodeHandoff,
} from '../src/lib/session/handoff';
import { createSessionToken } from '../src/lib/session/token';
import { toCsv } from '../src/lib/logging/csv';
import { haversineKilometers } from '../src/domain/shared/scheduling';

describe('데이터 무결성', () => {
  it('오류 수준의 문제가 하나도 없다', () => {
    const errors = validateDataset(ATTRACTIONS, OFFICIAL_DOCUMENTS).filter(
      (issue) => issue.severity === 'error',
    );
    assert.deepEqual(errors, []);
  });

  it('제안서 12.2 권장 데이터 규모를 충족한다', () => {
    const gwangju = ATTRACTIONS.filter((a) => a.region === 'gwangju').length;
    const jeonnam = ATTRACTIONS.filter((a) => a.region === 'jeonnam').length;

    assert.ok(gwangju >= 7, `광주 ${gwangju}곳`);
    assert.ok(jeonnam >= 12, `전남 ${jeonnam}곳`);
    assert.ok(OFFICIAL_DOCUMENTS.length >= 30, `공식문서 ${OFFICIAL_DOCUMENTS.length}건`);
    assert.ok(BENCHMARK_QUESTIONS.length >= 30, `기준질문 ${BENCHMARK_QUESTIONS.length}개`);
    assert.ok(DEMO_SCENARIOS.length >= 4, `시연 시나리오 ${DEMO_SCENARIOS.length}종`);
  });

  it('기준 평가질문의 정답 문서가 모두 실재한다', () => {
    const documentIds = new Set(OFFICIAL_DOCUMENTS.map((document) => document.id));
    for (const question of BENCHMARK_QUESTIONS) {
      assert.ok(question.expectedDocumentIds.length > 0, `${question.id}: 정답 문서 없음`);
      for (const id of question.expectedDocumentIds) {
        assert.ok(documentIds.has(id), `${question.id}: 존재하지 않는 문서 ${id}`);
      }
    }
  });
});

describe('검수 게이트', () => {
  const report = evaluateAcceptance();

  it('출처 제시율이 목표를 충족한다', () => {
    const metric = report.metrics.find((entry) => entry.label === '출처 제시율')!;
    assert.ok(
      metric.value >= ACCEPTANCE_TARGETS.sourceCitationRate,
      `${metric.value}% < ${ACCEPTANCE_TARGETS.sourceCitationRate}%`,
    );
  });

  it('답변–근거 일치율이 목표를 충족한다', () => {
    const metric = report.metrics.find((entry) => entry.label === '답변–근거 일치율')!;
    assert.ok(
      metric.value >= ACCEPTANCE_TARGETS.answerEvidenceMatchRate,
      `${metric.value}% < ${ACCEPTANCE_TARGETS.answerEvidenceMatchRate}%`,
    );
  });

  it('응답시간 중앙값이 목표 이내다', () => {
    const metric = report.metrics.find((entry) => entry.label === '응답시간 중앙값')!;
    assert.ok(metric.value <= ACCEPTANCE_TARGETS.medianResponseMs);
  });

  it('종합 판정이 Go 다', () => {
    assert.equal(report.passed, true);
  });
});

describe('이동시간 모델', () => {
  it('실제 지리적 거리 순서를 보존한다', () => {
    const distanceBetween = (fromId: string, toId: string) => {
      const from = ATTRACTIONS.find((a) => a.id === fromId)!;
      const to = ATTRACTIONS.find((a) => a.id === toId)!;
      return haversineKilometers(from.coordinates, to.coordinates);
    };

    // 광주–담양(약 25km) < 광주–목포(약 70km) < 목포–여수(약 130km)
    assert.ok(distanceBetween('acc', 'juknokwon') < distanceBetween('acc', 'mokpo-modern'));
    assert.ok(
      distanceBetween('acc', 'mokpo-modern') < distanceBetween('mokpo-modern', 'odongdo'),
    );
  });
});

describe('키오스크 → 모바일 승계', () => {
  it('QR 페이로드가 왕복해도 일정이 보존된다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const { itinerary } = generateItinerary({
        conditions: scenario.conditions,
        referenceDate: '2026-08-10',
        itineraryId: 'it_test',
      });
      const payload = buildHandoffPayload(itinerary, scenario.conditions, createSessionToken());
      const decoded = decodeHandoff(encodeHandoff(payload));

      assert.ok(decoded, `${scenario.id}: 복호화 실패`);
      assert.equal(decoded.ti, itinerary.title, `${scenario.id}: 한글 제목 손상`);
      assert.deepEqual(
        decoded.d.flat().map(([id]) => id),
        itinerary.days.flatMap((day) => day.stops.map((stop) => stop.attractionId)),
        `${scenario.id}: 방문지 목록 불일치`,
      );
    }
  });

  it('QR 용량 한도 안에 들어간다', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const { itinerary } = generateItinerary({
        conditions: scenario.conditions,
        referenceDate: '2026-08-10',
        itineraryId: 'it_test',
      });
      const encoded = encodeHandoff(
        buildHandoffPayload(itinerary, scenario.conditions, createSessionToken()),
      );
      // QR 버전 상한과 전시장 인식률을 함께 고려한 실무 한도.
      assert.ok(encoded.length < 1200, `${scenario.id}: ${encoded.length}자`);
    }
  });

  it('손상된 토큰은 예외 대신 undefined 를 돌려준다', () => {
    assert.equal(decodeHandoff('!!!not-a-token!!!'), undefined);
    assert.equal(decodeHandoff(''), undefined);
    assert.equal(decodeHandoff(encodeHandoff({ v: 2 } as never)), undefined);
  });

  it('세션 토큰이 혼동하기 쉬운 문자를 쓰지 않는다', () => {
    for (let index = 0; index < 200; index += 1) {
      assert.match(createSessionToken(), /^[A-HJ-NP-Z2-9]+$/);
    }
  });
});

describe('CSV 내보내기', () => {
  it('쉼표·따옴표·줄바꿈이 든 값을 안전하게 감싼다', () => {
    const csv = toCsv(
      [{ text: '보행부담 74, 42로 감소', quoted: '그는 "괜찮다"고 했다', multiline: '첫째 줄\n둘째 줄' }],
      [
        { header: '설명', value: (row) => row.text },
        { header: '인용', value: (row) => row.quoted },
        { header: '여러줄', value: (row) => row.multiline },
      ],
    );

    assert.ok(csv.includes('"보행부담 74, 42로 감소"'));
    assert.ok(csv.includes('"그는 ""괜찮다""고 했다"'));
    assert.ok(csv.includes('"첫째 줄\n둘째 줄"'));
  });

  it('엑셀이 한글을 인식하도록 BOM으로 시작한다', () => {
    const csv = toCsv([{ name: '담양 죽녹원' }], [{ header: '관광지', value: (row) => row.name }]);
    assert.ok(csv.startsWith('﻿'));
  });
});
