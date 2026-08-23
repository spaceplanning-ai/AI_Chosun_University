/**
 * 일정 제목의 한국어 검증.
 *
 * 제목은 결과화면에서 가장 큰 글자이고, 이미지 여행카드와 QR 모바일 페이지에도 그대로 실린다.
 * 그런데 제목은 표 두 개(지명·모티프, 동행)를 이어 붙여 만들어지므로
 * 표에 값을 하나 더하는 순간 "광주의 남도의 맛", "연인 떠나는" 같은 비문이 조용히 생긴다.
 * 조합 전체를 돌려 조사 겹침과 누락을 잡는다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateItinerary } from '../src/domain/linkage-recommendation/index';
import {
  COMPANION_LABELS,
  COMPANION_TITLE_PHRASES,
  DURATION_LABELS,
  DURATION_TITLE_PHRASES,
} from '../src/domain/labels';
import { DEMO_SCENARIOS } from '../src/data/scenarios';
import type { Companion } from '../src/domain/types/travel';

const REFERENCE_DATE = '2026-08-10';
const COMPANIONS = Object.keys(COMPANION_TITLE_PHRASES) as Companion[];

/** 「…의 …의」 처럼 관형격 조사가 잇따라 나오는지. */
function hasDoubledPossessive(title: string): boolean {
  return /의\s+\S*의\s/.test(`${title} `);
}

describe('일정 제목의 한국어', () => {
  const titles = DEMO_SCENARIOS.flatMap((scenario) =>
    COMPANIONS.map((companion) => {
      const conditions = { ...scenario.conditions, companion };
      return generateItinerary({
        conditions,
        referenceDate: REFERENCE_DATE,
        itineraryId: `it_title_${companion}`,
      }).itinerary.title;
    }),
  );

  it('시나리오 × 동행 조합 전체에서 제목이 만들어진다', () => {
    assert.ok(titles.length >= COMPANIONS.length);
    for (const title of titles) assert.ok(title.length > 0);
  });

  it('관형격 조사가 겹치지 않는다', () => {
    const broken = titles.filter(hasDoubledPossessive);
    assert.deepEqual(broken, [], `조사 겹침: ${broken.join(' / ')}`);
  });

  it('동행 표현 뒤에 「떠나는」이 자연스럽게 이어진다', () => {
    // 「떠나는」을 꾸미려면 부사구여야 한다. 명사를 그대로 두면 "연인 떠나는" 같은 비문이 된다.
    // 부사구로 성립하는 끝맺음만 허용한다: 부사 자체(혼자·함께) 또는 공동격 조사(과·와).
    const ADVERBIAL_ENDINGS = ['혼자', '함께', '과', '와'];
    for (const [companion, phrase] of Object.entries(COMPANION_TITLE_PHRASES)) {
      const ok = ADVERBIAL_ENDINGS.some((ending) => phrase.endsWith(ending));
      assert.ok(ok, `${companion}: "${phrase} 떠나는" 은 부사구가 아니다`);
    }
  });

  it('기간 표현이 문장 끝에서 명사로 끝난다', () => {
    // 「혼자 떠나는 3일 이상」처럼 말이 끊기지 않아야 한다.
    for (const [duration, phrase] of Object.entries(DURATION_TITLE_PHRASES)) {
      assert.ok(
        /(?:여행|여정|일)$/.test(phrase),
        `${duration}: "떠나는 ${phrase}" 는 문장이 끝나지 않는다`,
      );
    }
  });

  it('기간 표현과 선택지 라벨의 키가 어긋나지 않는다', () => {
    assert.deepEqual(
      Object.keys(DURATION_TITLE_PHRASES).sort(),
      Object.keys(DURATION_LABELS).sort(),
    );
  });

  it('제목용 표현과 선택지 라벨을 각각 유지한다', () => {
    // 두 표는 쓰임이 다르므로 키가 어긋나면 안 된다.
    assert.deepEqual(
      Object.keys(COMPANION_TITLE_PHRASES).sort(),
      Object.keys(COMPANION_LABELS).sort(),
    );
  });
});
