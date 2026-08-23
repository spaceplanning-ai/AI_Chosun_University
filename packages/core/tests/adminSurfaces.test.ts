/**
 * 어드민 화면이 기대는 값들의 계약 검증.
 *
 * ── 왜 이 파일이 있는가 ────────────────────────────────────────────
 * 여기 모인 것들은 «화면은 멀쩡히 뜨는데 숫자만 조용히 틀리는» 종류다.
 * 실제로 다음 둘이 그렇게 틀렸다.
 *
 *   · 응답시간은 낮을수록 좋은 지표인데 「값 ÷ 목표」로 그려서,
 *     7초 목표에 0.1ms 인 값이 «충족» 뱃지 옆에 0점 막대로 섰다.
 *   · 색인이 관광지에서 파생 키워드를 붙인다는 사실을 화면이 베껴 쓰면
 *     엔진이 바뀔 때 조용히 어긋난다.
 *
 * 타입검사·린트·빌드가 모두 통과하는 결함이라, 값을 직접 재야만 드러난다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACCEPTANCE_TARGETS } from '../src/config/kiosk';
import { evaluateAcceptance, metricAchievement } from '../src/domain/shared/acceptance';
import { buildDocumentIndex } from '../src/domain/linkage-recommendation/retrieval';
import { OFFICIAL_DOCUMENTS } from '../src/data/officialDocuments';
import { ATTRACTIONS } from '../src/data/attractions';
import { getAttraction } from '../src/data/attractions';

describe('검수지표 달성률', () => {
  it('높을수록 좋은 지표는 목표 대비 비율로 잰다', () => {
    const metric = { label: '출처 제시율', value: 45, target: 90, unit: '%', passed: false };
    assert.equal(metricAchievement(metric), 50);
  });

  it('목표를 넘어도 100 을 넘기지 않는다', () => {
    const metric = { label: '출처 제시율', value: 100, target: 90, unit: '%', passed: true };
    assert.equal(metricAchievement(metric), 100);
  });

  it('낮을수록 좋은 지표는 남은 여유로 잰다', () => {
    // 7초 목표에 0.1ms — 사실상 여유가 가득하다. 뒤집지 않으면 0 이 나온다.
    const fast = {
      label: '응답시간',
      value: 0.1,
      target: 7000,
      unit: 'ms',
      passed: true,
      lowerIsBetter: true,
    };
    assert.ok(metricAchievement(fast) > 99, `여유가 100 에 가까워야 하는데 ${metricAchievement(fast)}`);

    // 목표를 넘긴 값은 0 으로 바닥을 친다. 음수 막대가 그려지면 안 된다.
    const slow = { ...fast, value: 9000, passed: false };
    assert.equal(metricAchievement(slow), 0);
  });

  it('응답시간 지표에는 방향이 표시돼 있다', () => {
    // 방향 표시가 빠지면 위의 뒤집기가 적용되지 않아 화면에서 0 점으로 그려진다.
    const report = evaluateAcceptance();
    const responseTime = report.metrics.find(
      (metric) => metric.target === ACCEPTANCE_TARGETS.medianResponseMs,
    );
    assert.ok(responseTime, '응답시간 지표를 찾지 못했습니다');
    assert.equal(responseTime.lowerIsBetter, true);
  });

  it('비율 지표에는 방향 표시가 없다', () => {
    const report = evaluateAcceptance();
    const rates = report.metrics.filter((metric) => metric.unit === '%');
    assert.ok(rates.length >= 2);
    for (const metric of rates) {
      assert.notEqual(metric.lowerIsBetter, true, `${metric.label} 에 방향 표시가 잘못 붙었습니다`);
    }
  });
});

describe('검색 색인 구성', () => {
  const index = buildDocumentIndex(OFFICIAL_DOCUMENTS);

  it('문서마다 색인 항목이 하나씩 생긴다', () => {
    assert.equal(index.length, OFFICIAL_DOCUMENTS.length);
  });

  it('문서에 적힌 키워드는 모두 색인에 남는다', () => {
    for (const entry of index) {
      for (const keyword of entry.document.keywords) {
        assert.ok(
          entry.keywords.includes(keyword),
          `${entry.document.title} 의 «${keyword}» 가 색인에서 빠졌습니다`,
        );
      }
    }
  });

  it('근거 관광지의 이름과 시군구가 색인에 더해진다', () => {
    // 이 파생이 있어야 «담양 죽녹원 입장료» 같은 질의가 제목에 없는 낱말로도 걸린다.
    const withAttraction = index.find((entry) => entry.document.coversAttractionIds.length > 0);
    assert.ok(withAttraction, '근거 관광지가 있는 문서가 없습니다');

    const attraction = getAttraction(withAttraction.document.coversAttractionIds[0]!);
    assert.ok(attraction, '근거 관광지를 찾지 못했습니다');
    assert.ok(
      withAttraction.keywords.includes(attraction.name),
      '관광지 이름이 색인에 더해지지 않았습니다',
    );
    assert.ok(
      withAttraction.keywords.includes(attraction.district),
      '시군구가 색인에 더해지지 않았습니다',
    );
  });
});

describe('시군구 표기', () => {
  it('관광지의 시군구는 지역 접두어를 포함한다', () => {
    /*
      권역을 「담양군」으로 적어 두면 실제 값 「전남 담양군」과 글자가 달라
      집계가 조용히 0 이 된다. 표기 규칙이 바뀌면 여기서 먼저 걸린다.
    */
    for (const attraction of ATTRACTIONS) {
      const prefix = attraction.region === 'gwangju' ? '광주 ' : '전남 ';
      assert.ok(
        attraction.district.startsWith(prefix),
        `${attraction.name} 의 시군구 «${attraction.district}» 가 «${prefix}» 로 시작하지 않습니다`,
      );
    }
  });
});
