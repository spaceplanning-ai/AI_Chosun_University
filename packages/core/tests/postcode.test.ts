import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { resolveDistrict } from '../src/lib/postcode';
import { ATTRACTIONS } from '../src/data/attractions';
import { ALL_DISTRICTS, DISTRICTS_BY_REGION, isKnownDistrict } from '../src/domain/districts';

/**
 * 고른 주소 → 소재지·지역.
 *
 * 여기서 만든 소재지 표기가 관광지 자료의 기존 표기와 어긋나면
 * 「관리」의 지역 분포가 갈라지고 권역에서 관광지가 조용히 빠진다.
 * 그래서 «형식이 맞는가»가 아니라 «자료에 있는 표기와 같은가»를 본다.
 */

const sample = (sido: string, sigungu: string) => ({
  roadAddress: '',
  jibunAddress: '',
  sido,
  sigungu,
  zonecode: '00000',
});

describe('주소에서 소재지 뽑기', () => {
  it('광주·전남을 지역으로 옮긴다', () => {
    assert.equal(resolveDistrict(sample('광주광역시', '동구'))?.region, 'gwangju');
    assert.equal(resolveDistrict(sample('전라남도', '담양군'))?.region, 'jeonnam');
  });

  it('소재지를 관광지 자료와 같은 표기로 만든다', () => {
    assert.equal(resolveDistrict(sample('전라남도', '담양군'))?.district, '전남 담양군');
    assert.equal(resolveDistrict(sample('광주광역시', '북구'))?.district, '광주 북구');
  });

  it('만들어 낸 표기가 실제 자료에 쓰이고 있다', () => {
    // 자료의 소재지를 그대로 되돌려 낼 수 있어야 표기가 한 벌로 유지된다.
    const districts = new Set(ATTRACTIONS.map((attraction) => attraction.district));
    for (const [sido, sigungu] of [
      ['광주광역시', '동구'],
      ['광주광역시', '북구'],
      ['전라남도', '담양군'],
      ['전라남도', '여수시'],
    ] as const) {
      const resolved = resolveDistrict(sample(sido, sigungu));
      assert.ok(resolved, `${sido} ${sigungu}`);
      assert.ok(districts.has(resolved.district), `자료에 없는 표기: ${resolved.district}`);
    }
  });

  it('광주·전남 밖이면 아무것도 돌려주지 않는다', () => {
    // 사업 범위 밖 주소를 조용히 「광주」로 적으면 추천에 엉뚱한 곳이 섞인다.
    assert.equal(resolveDistrict(sample('서울특별시', '종로구')), undefined);
    assert.equal(resolveDistrict(sample('전라북도', '전주시')), undefined);
  });

  it('시·군·구가 비면 돌려주지 않는다', () => {
    assert.equal(resolveDistrict(sample('전라남도', '')), undefined);
  });
});

describe('시·군·구 목록', () => {
  it('광주 5개 구, 전남 22개 시·군을 담고 있다', () => {
    assert.equal(DISTRICTS_BY_REGION.gwangju.length, 5);
    assert.equal(DISTRICTS_BY_REGION.jeonnam.length, 22);
    assert.equal(ALL_DISTRICTS.length, 27);
  });

  it('자료의 모든 소재지가 목록 안에 있다', () => {
    // 목록에 없는 소재지가 자료에 있으면, 그 관광지는 어느 구역에도 안 잡힌다.
    for (const attraction of ATTRACTIONS) {
      assert.ok(isKnownDistrict(attraction.district), `목록에 없음: ${attraction.district}`);
    }
  });

  it('주소에서 뽑은 소재지가 목록의 표기와 같다', () => {
    // 두 길(주소 찾기 / 직접 고르기)이 같은 글자를 만들어야 한 벌로 유지된다.
    for (const entry of ALL_DISTRICTS) {
      const sido = entry.region === 'gwangju' ? '광주광역시' : '전라남도';
      assert.equal(resolveDistrict(sample(sido, entry.city))?.district, entry.label);
    }
  });
});
