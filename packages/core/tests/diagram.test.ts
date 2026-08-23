/**
 * 특허 도면 생성 검증.
 *
 * 도면은 명세서에 그대로 실리므로, 박스가 겹치거나 화면 밖으로 나가면
 * 그 자체로 납품 결함이 된다. 브라우저 없이 확인할 수 있는 것은 기하 구조이므로
 * 그 부분만은 확실히 고정한다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PATENT_DIAGRAMS } from '../src/data/patentDiagrams';
import { renderDiagram } from '../src/design/diagram';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 배경 사각형을 제외한 노드 박스만 추출한다. */
function parseNodeRects(svg: string): Rect[] {
  return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(
    (match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      width: Number(match[3]),
      height: Number(match[4]),
    }),
  );
}

function parseViewBox(svg: string): { width: number; height: number } {
  const match = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  assert.ok(match, 'viewBox 를 찾지 못했습니다');
  return { width: Number(match[1]), height: Number(match[2]) };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

describe('특허 도면', () => {
  it('피드백 5.3이 지정한 A단계 우선 도면이 모두 있다', () => {
    const numbers = PATENT_DIAGRAMS.map((diagram) => diagram.number);
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6]);
  });

  for (const diagram of PATENT_DIAGRAMS) {
    describe(`도면 ${diagram.number}. ${diagram.title}`, () => {
      const svg = renderDiagram(diagram);
      const rects = parseNodeRects(svg);
      const viewBox = parseViewBox(svg);

      it('노드 박스가 서로 겹치지 않는다', () => {
        const collisions: string[] = [];
        for (let i = 0; i < rects.length; i += 1) {
          for (let j = i + 1; j < rects.length; j += 1) {
            if (overlaps(rects[i]!, rects[j]!)) collisions.push(`${i}↔${j}`);
          }
        }
        assert.deepEqual(collisions, []);
      });

      it('모든 박스가 화면 안에 들어온다', () => {
        const outside = rects.filter(
          (rect) =>
            rect.x < 0 ||
            rect.y < 0 ||
            rect.x + rect.width > viewBox.width ||
            rect.y + rect.height > viewBox.height,
        );
        assert.deepEqual(outside, []);
      });

      it('정의된 노드 수만큼 박스가 그려진다', () => {
        const expected =
          diagram.nodes.length + diagram.nodes.filter((node) => node.branch).length;
        assert.equal(rects.length, expected);
      });

      it('특수문자가 이스케이프되어 XML 이 깨지지 않는다', () => {
        // 배경/노드 rect 와 여는 태그 수가 맞으면 구조가 성립한다.
        assert.equal((svg.match(/<svg/g) ?? []).length, 1);
        assert.equal((svg.match(/<\/svg>/g) ?? []).length, 1);
        assert.ok(!/&(?!amp;|lt;|gt;|quot;|#)/.test(svg), '이스케이프되지 않은 & 가 있습니다');
      });
    });
  }

  it('제목·설명이 비어 있지 않다', () => {
    for (const diagram of PATENT_DIAGRAMS) {
      assert.ok(diagram.title.length > 0);
      assert.ok(diagram.caption.length > 0, `도면 ${diagram.number}: 설명 없음`);
      assert.ok(diagram.nodes.length >= 4, `도면 ${diagram.number}: 노드가 너무 적음`);
    }
  });
});
