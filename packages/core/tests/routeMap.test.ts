/**
 * 여행경로 지도의 노드 겹침 검증.
 *
 * 지도 노드에는 순번 숫자가 적혀 있고, 그 숫자가 "몇 번째로 가는 곳인지"를 알려 준다.
 * 담양 관방제림과 메타세쿼이아 가로수길처럼 1km 남짓 떨어진 자원은 투영하면 원이 포개져
 * 숫자가 가려진다. 지도가 전달해야 할 정보가 사라지는 셈이라 규칙으로 고정한다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MIN_NODE_SEPARATION,
  pickGatewayLabelSide,
  separateOverlaps,
  type ProjectedPoint,
} from '../src/components/itinerary/RouteMap';

const distance = (a: ProjectedPoint, b: ProjectedPoint) => Math.hypot(b.x - a.x, b.y - a.y);

function closestPair(points: readonly ProjectedPoint[]): number {
  let smallest = Infinity;
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      smallest = Math.min(smallest, distance(points[a]!, points[b]!));
    }
  }
  return smallest;
}

const PADDING = 9;
const inBounds = (point: ProjectedPoint) =>
  point.x >= PADDING - 1e-6 &&
  point.x <= 100 - PADDING + 1e-6 &&
  point.y >= PADDING - 1e-6 &&
  point.y <= 100 - PADDING + 1e-6;

describe('지도 노드 겹침 해소', () => {
  it('가까이 붙은 두 노드를 최소 간격까지 벌린다', () => {
    const result = separateOverlaps([
      { x: 50, y: 50 },
      { x: 51, y: 50.4 },
    ]);
    assert.ok(
      closestPair(result) >= MIN_NODE_SEPARATION - 1e-6,
      `간격 ${closestPair(result)}`,
    );
  });

  it('완전히 같은 자리에 있어도 갈라진다', () => {
    const result = separateOverlaps([
      { x: 40, y: 40 },
      { x: 40, y: 40 },
      { x: 40, y: 40 },
    ]);
    assert.ok(closestPair(result) >= MIN_NODE_SEPARATION - 1e-6);
  });

  it('한 곳에 몰린 6곳도 모두 떨어진다', () => {
    // 담양에 자원이 몰린 일정이 실제로 이 형태가 된다.
    const clustered = Array.from({ length: 6 }, (_, index) => ({
      x: 50 + index * 0.3,
      y: 50 - index * 0.2,
    }));
    const result = separateOverlaps(clustered);
    assert.ok(closestPair(result) >= MIN_NODE_SEPARATION - 1e-6, `간격 ${closestPair(result)}`);
  });

  it('밀어낸 뒤에도 모든 노드가 화면 안에 남는다', () => {
    // 모서리에 몰린 경우가 가장 위험하다. 밀어내다 화면 밖으로 나가면 노드가 잘린다.
    const corner = Array.from({ length: 5 }, () => ({ x: PADDING, y: PADDING }));
    for (const point of separateOverlaps(corner)) {
      assert.ok(inBounds(point), `화면 밖: ${JSON.stringify(point)}`);
    }
  });

  it('세로로 긴 좌표계에서 아래쪽 노드가 잘리지 않는다', () => {
    /*
      좌표계는 경로 모양에 따라 세로로 길어진다. 그런데 잘라 내는 한계를 가로 길이 하나로만
      잡으면, 아래쪽 방문지들이 전부 같은 y 로 눌려 한 줄에 붙는다.
      정사각형이었다면 잘렸을 위치(y > 91)에 점을 두고, 그 자리가 유지되는지 본다.
    */
    const tall = { width: 100, height: 170 };
    const low = Array.from({ length: 4 }, (_, index) => ({ x: 50, y: 120 + index * 2 }));
    const spread = separateOverlaps(low, tall);

    assert.ok(closestPair(spread) >= MIN_NODE_SEPARATION - 1e-6, `간격 ${closestPair(spread)}`);
    for (const point of spread) {
      assert.ok(
        point.y >= PADDING - 1e-6 && point.y <= tall.height - PADDING + 1e-6,
        `세로 범위를 벗어남: ${point.y}`,
      );
    }
    // 정사각형 기준(91)이었다면 여기서 전부 눌렸을 것이다.
    assert.ok(
      spread.every((point) => point.y > 100 - PADDING),
      `아래쪽 노드가 위로 끌려 올라갔다: ${spread.map((p) => p.y.toFixed(1)).join(', ')}`,
    );
  });

  it('충분히 떨어진 노드는 건드리지 않는다', () => {
    // 필요할 때만 움직여야 지리적 배치가 그대로 읽힌다.
    const spread = [
      { x: 20, y: 20 },
      { x: 70, y: 25 },
      { x: 45, y: 80 },
    ];
    assert.deepEqual(separateOverlaps(spread), spread);
  });

  it('같은 입력이면 같은 결과가 나온다', () => {
    const input = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 50.2, y: 49.9 },
    ];
    assert.deepEqual(separateOverlaps(input), separateOverlaps(input));
  });
});

describe('관문 이름표 위치', () => {
  const gateway = { x: 50, y: 50 };

  it('아래에 노드가 있으면 위로 올라간다', () => {
    // 광주송정역과 1913 송정역시장이 실제로 이 배치가 된다.
    const side = pickGatewayLabelSide(gateway, [{ x: 50, y: 57 }]);
    assert.equal(side, 'above');
  });

  it('위에 노드가 있으면 아래로 내려간다', () => {
    assert.equal(pickGatewayLabelSide(gateway, [{ x: 50, y: 43 }]), 'below');
  });

  it('화면 아래끝에 붙으면 아래를 고르지 않는다', () => {
    // 아래로 두면 이름표가 지도 밖으로 잘려 나간다.
    assert.equal(pickGatewayLabelSide({ x: 50, y: 96 }, []), 'above');
  });

  it('화면 위끝에 붙으면 위를 고르지 않는다', () => {
    assert.equal(pickGatewayLabelSide({ x: 50, y: 4 }, []), 'below');
  });

  it('주변에 아무것도 없으면 기본값(아래)을 지킨다', () => {
    assert.equal(pickGatewayLabelSide(gateway, []), 'below');
  });
});
