/**
 * 이미지 여행카드의 줄바꿈 검증.
 *
 * 캔버스에는 CSS `word-break: keep-all` 이 닿지 않는다. 화면에서는 멀쩡한 제목이
 * 카드에서만 "부 / 모님과" 처럼 갈라지는데, 카드가 관람객이 가져가는 결과물이라
 * 이 어긋남은 화면보다 오래 남는다. 그래서 규칙을 코드로 고정한다.
 *
 * 캔버스 API 가 없는 환경이므로, 글자 폭을 아는 가짜 컨텍스트로 순수 로직만 검사한다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wrapTextForTest } from '../src/lib/travelCard';

/** 모든 글자가 같은 폭(10)이라고 보는 측정기. 줄바꿈 위치만 보면 되므로 이것으로 충분하다. */
const context = {
  measureText: (value: string) => ({ width: [...value].length * 10 }),
} as unknown as CanvasRenderingContext2D;

const wrap = (text: string, widthInChars: number, maxLines = 10) =>
  wrapTextForTest(context, text, widthInChars * 10, maxLines);

describe('여행카드 줄바꿈', () => {
  it('어절 중간에서 끊지 않는다', () => {
    const lines = wrap('광주의 맛에서 화순의 오래된 이야기까지, 부모님과 함께 떠나는 1박 2일', 20);
    for (const line of lines) {
      for (const word of line.split(' ')) {
        assert.ok(
          '광주의 맛에서 화순의 오래된 이야기까지, 부모님과 함께 떠나는 1박 2일'.includes(word),
          `쪼개진 어절: ${word}`,
        );
      }
    }
  });

  it('줄이 최대 폭을 넘지 않는다', () => {
    const lines = wrap('부모님과 함께 떠나는 담양 메타세쿼이아 가로수길 여행', 12);
    for (const line of lines) assert.ok([...line].length <= 12, `넘침: ${line}`);
  });

  it('한 어절이 한 줄보다 길면 그때만 글자 단위로 자른다', () => {
    const lines = wrap('가나다라마바사아자차카타파하', 5);
    assert.deepEqual(lines, ['가나다라마', '바사아자차', '카타파하']);
  });

  it('최대 줄 수를 넘지 않는다', () => {
    const lines = wrap('하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열', 4, 3);
    assert.equal(lines.length, 3);
  });

  it('빈 문자열과 공백만 있는 입력에서 빈 줄을 만들지 않는다', () => {
    assert.deepEqual(wrap('', 10), []);
    assert.deepEqual(wrap('   ', 10), []);
  });

  it('연속 공백이 줄 안에서 하나로 정리된다', () => {
    assert.deepEqual(wrap('광주   전남', 10), ['광주 전남']);
  });
});
