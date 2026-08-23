/**
 * 행정경계 GeoJSON → SVG 좌표 변환.
 *
 *     node scripts/build-district-map.mjs --source <url|파일경로>
 *
 * ── 왜 지도 라이브러리를 쓰지 않는가 ───────────────────────────────
 * Leaflet·MapLibre 같은 지도 라이브러리는 **타일 서버에서 배경지도를 받아 온다.**
 * 전시장 키오스크는 오프라인으로 돌아가야 하므로(피드백 [기타]) 그 순간 지도가 회색 격자만 남는다.
 * 그래서 경계 좌표를 **빌드 시점에 SVG 좌표로 바꿔 정적으로 심는다.**
 * 실행 시점에는 네트워크도, 추가 의존성도 필요 없다.
 *
 * ── 출처 ───────────────────────────────────────────────────────────
 * southkorea/southkorea-maps — 통계청 2013 시군구 경계 (github.com/southkorea/southkorea-maps)
 * 경계를 갱신하려면 `--source` 에 새 GeoJSON 을 주고 다시 실행하면 된다.
 * 화면 코드는 손댈 필요가 없다.
 * ──────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { argv } from 'node:process';

const DEFAULT_SOURCE =
  'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo.json';

/** 광주광역시. 통계청 시군구 코드의 앞 두 자리. */
const CODE_PREFIX = '24';

/**
 * 출력 좌표계.
 *
 * 높이는 고정하지 않고 **경계의 실제 가로세로비에서 계산**한다.
 * 정사각형으로 고정하면 광주처럼 옆으로 넓은 지역은 viewBox 안에 빈 띠가 생기고,
 * 그 빈 띠 때문에 화면에서 지도가 작게 앉는다.
 */
const VIEW_WIDTH = 200;
const VIEW_PADDING = 2;

/**
 * 단순화 강도(출력 좌표 단위).
 *
 * 세게 줄이면 해안선과 경계가 각져 «자료를 그대로 찍어낸» 느낌이 난다.
 * 안내도는 읽는 그림이므로 형태가 매끄러워야 한다 — 점을 조금 더 남긴다.
 */
const SIMPLIFY_TOLERANCE = 0.12;

/**
 * 모서리를 깎은 뒤 다시 거르는 강도.
 *
 * Chaikin 은 점을 두 배로 늘리는데 그중 상당수는 거의 일직선 위에 있다.
 * 형태는 그대로 두고 그런 점만 걷어 내면 파일이 절반 이하로 줄어든다.
 */
const RESIMPLIFY_TOLERANCE = 0.05;

/**
 * 옆면 높이 (기울이기 전 좌표 단위).
 *
 * 화면에서는 여기에 기울임 비율이 곱해져 더 낮아 보인다.
 * 두 값을 만들어 두는 이유는, 고른 구가 위로 솟을 때 옆면도 그만큼 길어져야
 * «떠 있는» 것이 아니라 «들린» 것으로 보이기 때문이다.
 */
/*
  구들은 서로 맞붙어 하나의 판을 이룬다. 그래서 **안쪽 옆면은 이웃에 가려 보이지 않고**,
  광주 바깥 테두리에만 두께가 드러난다 — 실제 지형이 그런 모습이다.

  고른 구는 이 판에서 들려 나온다. 그때 비로소 그 구의 옆면 전체가 드러나므로
  옆면을 훨씬 길게 잡아, «판에서 뽑혀 올라온 조각»으로 읽히게 한다.
*/
const WALL_DEPTH = { rest: 5, lifted: 11.3 };

/**
 * 구 사이에 두는 틈 (출력 좌표 단위).
 *
 * 0 이면 경계가 완전히 맞물려 **윗면이 이음매 없는 하나의 판**이 된다.
 * 구를 나누는 선은 얇은 경계선이 맡는다 — 턱이 아니라 선으로.
 * 값을 키우면 판이 조각으로 흩어진다.
 */
const DISTRICT_INSET = 0;

/**
 * 카카오맵 위에 덮을 경계의 단순화 강도(도 단위).
 *
 * 실제 지도 위에 얹는 폴리곤이라 화면용 SVG 만큼 촘촘할 필요가 없다.
 * 점이 많으면 지도를 끌 때마다 다시 그리느라 눈에 띄게 버벅인다.
 */
const BOUNDARY_TOLERANCE = 0.0008;

function readArg(name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

async function loadSource(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`내려받기 실패: ${response.status} ${source}`);
    return response.json();
  }
  return JSON.parse(readFileSync(source, 'utf8'));
}

/** Polygon 과 MultiPolygon 을 같은 모양(고리 배열)으로 편다. */
function toRings(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon);
}

/** 점과 선분 사이 거리의 제곱. 단순화에서 반복 호출되므로 제곱근을 쓰지 않는다. */
function squaredSegmentDistance(point, start, end) {
  let [x, y] = start;
  let deltaX = end[0] - x;
  let deltaY = end[1] - y;

  if (deltaX !== 0 || deltaY !== 0) {
    const t = ((point[0] - x) * deltaX + (point[1] - y) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
    if (t > 1) {
      [x, y] = end;
    } else if (t > 0) {
      x += deltaX * t;
      y += deltaY * t;
    }
  }

  deltaX = point[0] - x;
  deltaY = point[1] - y;
  return deltaX * deltaX + deltaY * deltaY;
}

/** Douglas–Peucker. 모양을 결정하는 꼭짓점만 남긴다. */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const toleranceSquared = tolerance * tolerance;

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const distance = squaredSegmentDistance(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (maxDistance > toleranceSquared && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/**
 * 모서리를 깎아 형태를 부드럽게 만든다 (Chaikin).
 *
 * 각 변을 1:3, 3:1 로 나눈 두 점으로 꼭짓점을 대체한다.
 * 뾰족한 각이 사라지면서도 전체 윤곽은 유지되어, 원본의 «톱니»만 정리된다.
 * 행정경계의 의미가 바뀔 만큼 뭉개지지 않도록 한 번만 돌린다.
 */
function smoothRing(ring) {
  const smoothed = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    smoothed.push([
      Number((ax * 0.75 + bx * 0.25).toFixed(1)),
      Number((ay * 0.75 + by * 0.25).toFixed(1)),
    ]);
    smoothed.push([
      Number((ax * 0.25 + bx * 0.75).toFixed(1)),
      Number((ay * 0.25 + by * 0.75).toFixed(1)),
    ]);
  }
  return smoothed;
}

/**
 * 도형을 안쪽으로 살짝 줄인다.
 *
 * 무게중심 쪽으로 당기되, **줄이는 폭이 구의 크기와 무관하게 일정하도록** 배율을 구마다 계산한다.
 * 같은 배율을 쓰면 광산구는 크게 남구는 조금 줄어들어 틈 너비가 들쭉날쭉해진다.
 */
function insetRings(rings, inset) {
  const points = rings.flat();
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;

  const meanRadius =
    points.reduce((sum, [x, y]) => sum + Math.hypot(x - cx, y - cy), 0) / points.length;
  const scale = Math.max(0, 1 - inset / meanRadius);

  return rings.map((ring) =>
    ring.map(([x, y]) => [
      Number((cx + (x - cx) * scale).toFixed(1)),
      Number((cy + (y - cy) * scale).toFixed(1)),
    ]),
  );
}

/** 다각형의 부호 있는 넓이. SVG 는 y 축이 아래로 향하므로, **양수면 화면에서 시계방향**이다. */
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/**
 * 입체의 옆면을 만든다 — 보이는 모서리만.
 *
 * 위에서 비스듬히 내려다보는 시점에서는 도형의 **앞쪽(아래쪽) 모서리에만** 옆면이 보인다.
 * 뒤쪽 모서리의 옆면은 도형 자체에 가려지므로 그리면 낭비이고, 반투명일 때는 잘못된 그림이 된다.
 *
 * 판정은 간단하다 — 고리를 화면 기준 시계방향으로 맞춰 두면,
 * **오른쪽에서 왼쪽으로 흐르는 모서리**가 곧 앞쪽 실루엣이다.
 * (모든 옆면이 수직이므로 3차원 법선을 계산할 필요가 없다.)
 */
function buildWalls(rings, depth) {
  const subpaths = [];

  for (const ring of rings) {
    // 자료 출처마다 고리를 감는 방향이 달라, 판정 전에 방향을 통일한다.
    const clockwise = signedArea(ring) > 0;
    const ordered = clockwise ? ring : [...ring].reverse();
    const count = ordered.length;

    const isVisible = (i) => ordered[(i + 1) % count][0] < ordered[i][0];

    /*
      보이는 모서리를 **이어진 줄기 단위로 묶는다.**
      모서리마다 사각형을 따로 그리면, 장과 장 사이 경계 픽셀이 반투명으로 칠해져
      옆면에 세로 줄무늬가 생긴다. 한 줄기를 한 덩어리 면으로 그리면 그 이음새 자체가 없어진다.
    */
    let start = 0;
    while (start < count && (!isVisible(start) || isVisible((start - 1 + count) % count))) {
      start += 1;
    }
    // 고리 전체가 보이는 경우(드물다)에는 0 번에서 시작한다.
    if (start === count) start = isVisible(0) ? 0 : -1;
    if (start === -1) continue;

    let index = start;
    let visited = 0;
    while (visited < count) {
      if (isVisible(index)) {
        const chain = [ordered[index]];
        while (isVisible(index) && visited < count) {
          chain.push(ordered[(index + 1) % count]);
          index = (index + 1) % count;
          visited += 1;
        }

        const top = chain.map(([x, y]) => `${x} ${y}`);
        const bottom = [...chain]
          .reverse()
          .map(([x, y]) => `${x} ${Number((y + depth).toFixed(1))}`);
        subpaths.push(`M${top.join('L')}L${bottom.join('L')}Z`);
        continue;
      }
      index = (index + 1) % count;
      visited += 1;
    }
  }

  return subpaths.join('');
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToRing(point, ring) {
  let smallest = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    smallest = Math.min(smallest, squaredSegmentDistance(point, ring[j], ring[i]));
  }
  return Math.sqrt(smallest);
}

/**
 * 라벨을 놓을 지점 — 도형 안쪽에서 경계로부터 가장 먼 곳.
 *
 * 무게중심(centroid)은 오목한 도형에서 **도형 밖으로 나간다.** 광산구처럼 한쪽이 파인 구에서
 * 구 이름이 옆 구 위에 찍히게 되므로, 격자를 훑어 안쪽에서 가장 여유로운 점을 고른다.
 */
function labelAnchor(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let best = null;
  let bestDistance = -1;
  const steps = 60;

  for (let i = 1; i < steps; i += 1) {
    for (let j = 1; j < steps; j += 1) {
      const candidate = [
        minX + ((maxX - minX) * i) / steps,
        minY + ((maxY - minY) * j) / steps,
      ];
      if (!pointInRing(candidate, ring)) continue;
      const distance = distanceToRing(candidate, ring);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }

  return { anchor: best ?? [(minX + maxX) / 2, (minY + maxY) / 2], clearance: bestDistance };
}

const source = readArg('--source', DEFAULT_SOURCE);
console.log(`1/4 경계 자료 읽는 중 — ${source}`);
const geojson = await loadSource(source);

const features = geojson.features.filter((feature) =>
  String(feature.properties.code ?? '').startsWith(CODE_PREFIX),
);
if (features.length === 0) throw new Error(`코드 ${CODE_PREFIX} 로 시작하는 구역을 찾지 못했습니다.`);
console.log(`   ${features.length}개 구역: ${features.map((f) => f.properties.name).join(', ')}`);

console.log('2/4 투영');
// 위도만큼 경도 간격이 좁아지는 것을 반영한다. 빼먹으면 남북으로 길쭉하게 찌그러진다.
const allPoints = features.flatMap((feature) => toRings(feature.geometry).flat());
const midLatitude =
  (Math.min(...allPoints.map((p) => p[1])) + Math.max(...allPoints.map((p) => p[1]))) / 2;
const longitudeScale = Math.cos((midLatitude * Math.PI) / 180);

const project = ([lng, lat]) => [lng * longitudeScale, -lat];
const projected = allPoints.map(project);
const minX = Math.min(...projected.map((p) => p[0]));
const maxX = Math.max(...projected.map((p) => p[0]));
const minY = Math.min(...projected.map((p) => p[1]));
const maxY = Math.max(...projected.map((p) => p[1]));

const spanX = maxX - minX;
const spanY = maxY - minY;
const scale = (VIEW_WIDTH - VIEW_PADDING * 2) / spanX;
const VIEW = {
  width: VIEW_WIDTH,
  height: Number((spanY * scale + VIEW_PADDING * 2).toFixed(2)),
};
const offsetX = VIEW_PADDING;
const offsetY = VIEW_PADDING;

const toView = (coordinate) => {
  const [x, y] = project(coordinate);
  return [
    Number(((x - minX) * scale + offsetX).toFixed(1)),
    Number(((y - minY) * scale + offsetY).toFixed(1)),
  ];
};

/**
 * 카카오맵용 위경도 경계.
 *
 * 화면용 SVG 좌표는 이미 투영·기울임이 들어가 있어 지도 위에 얹을 수 없다.
 * 같은 원본에서 **투영하지 않은 위경도**를 따로 뽑아, 두 지도가 같은 자료를 쓰게 한다.
 * 한쪽만 갱신되어 경계가 어긋나는 일을 막는다.
 */
function toBoundary(geometry) {
  return toRings(geometry)
    .map((ring) => simplify(ring, BOUNDARY_TOLERANCE))
    .filter((ring) => ring.length >= 4)
    .sort((a, b) => b.length - a.length)
    .map((ring) =>
      ring.map(([lng, lat]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]),
    );
}

console.log('3/4 단순화');
const entries = features.map((feature) => {
  const rings = toRings(feature.geometry)
    .map((ring) => simplify(ring.map(toView), SIMPLIFY_TOLERANCE))
    .filter((ring) => ring.length >= 4)
    .map(smoothRing)
    .map((ring) => simplify(ring, RESIMPLIFY_TOLERANCE))
    // 큰 고리부터. 첫 고리가 본체이고 나머지는 섬·비지(飛地)다.
    .sort((a, b) => b.length - a.length);

  // 틈을 준 뒤에 경로·옆면·라벨 위치를 모두 같은 도형에서 뽑는다. 하나라도 어긋나면 따로 논다.
  const inset = insetRings(rings, DISTRICT_INSET);

  const path = inset
    .map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`)
    .join('');
  const boundary = toBoundary(feature.geometry);
  /*
    이름표 위치도 위경도로 따로 구한다.
    화면용 좌표를 거꾸로 되돌리면 투영·기울임·틈이 모두 섞여 실제 위치와 어긋난다.
    같은 «안쪽에서 가장 여유로운 점» 규칙을 위경도 위에서 그대로 적용한다.
  */
  const labelLatLng = (() => {
    // labelAnchor 는 [x, y] 를 기대하므로 [경도, 위도] 순서로 넣고 결과를 뒤집는다.
    const ring = boundary[0].map(([lat, lng]) => [lng, lat]);
    const { anchor: found } = labelAnchor(ring);
    return [Number(found[1].toFixed(5)), Number(found[0].toFixed(5))];
  })();
  const wall = buildWalls(inset, WALL_DEPTH.rest);
  const wallLifted = buildWalls(inset, WALL_DEPTH.lifted);
  const { anchor } = labelAnchor(inset[0]);
  const originalPoints = toRings(feature.geometry).reduce((sum, ring) => sum + ring.length, 0);

  console.log(
    `   ${feature.properties.name.padEnd(5)} ${String(originalPoints).padStart(5)} → ` +
      `${String(rings.reduce((sum, r) => sum + r.length, 0)).padStart(4)}점 · 옆면 ${String((wall.match(/M/g) ?? []).length).padStart(3)}줄기 · 지도경계 ${String(boundary.reduce((sum, r) => sum + r.length, 0)).padStart(4)}점`,
  );

  /*
    앞뒤 정렬용 깊이값 — **도형의 가장 아래 지점**이다.
    무게중심으로 정렬하면 크고 오목한 구(광산구)의 중심이 실제로 가리는 이웃보다
    뒤로 계산되어, 두께가 엉뚱한 순서로 겹친다.
  */
  const nearEdgeY = Math.max(...inset.flat().map(([, y]) => y));

  return {
    code: feature.properties.code,
    name: feature.properties.name,
    nearEdgeY: Number(nearEdgeY.toFixed(2)),
    inset,
    drawOrder: 0,
    wall,
    wallLifted,
    boundary,
    labelLatLng,
    englishName: feature.properties.name_eng,
    path,
    labelAnchor: anchor.map((value) => Number(value.toFixed(2))),
  };
});

/**
 * 그리는 순서를 짝지어 비교해 정한다.
 *
 * 「도형의 가장 아래 지점」 하나로 줄 세우면 틀리는 경우가 있다.
 * 광산구는 남쪽 끝이 길어 전체로는 «앞»으로 계산되지만, 정작 서구 옆에서는 서구보다 뒤에 있다.
 * 그래서 나중에 그려진 광산구의 옆면이 서구를 덮어 버린다.
 *
 * 두 구가 **화면에서 가로로 겹치는 구간**에서만 앞뒤를 따지면 이 문제가 사라진다.
 * 겹치는 띠 안에서 더 아래까지 내려온 구가 앞이다. 그렇게 얻은 «뒤에 있다» 관계를 위상정렬한다.
 */
function resolveDrawOrder(items) {
  const bounds = items.map(({ inset }) => {
    const points = inset.flat();
    return {
      points,
      minX: Math.min(...points.map(([x]) => x)),
      maxX: Math.max(...points.map(([x]) => x)),
    };
  });

  /*
    가로로 겨우 몇 점 스치는 정도로는 앞뒤를 따지지 않는다.
    그런 조각난 겹침까지 관계로 삼으면 A→B→C→A 같은 순환이 생겨 순서를 못 정한다.
  */
  const MIN_OVERLAP = 6;

  /** a 가 b 보다 앞이면 true. 의미 있는 겹침이 없으면 판단하지 않는다. */
  const isInFront = (a, b) => {
    const left = Math.max(bounds[a].minX, bounds[b].minX);
    const right = Math.min(bounds[a].maxX, bounds[b].maxX);
    if (right - left < MIN_OVERLAP) return undefined;

    const lowestIn = (index) => {
      const inBand = bounds[index].points.filter(([x]) => x >= left && x <= right);
      return inBand.length > 0 ? Math.max(...inBand.map(([, y]) => y)) : -Infinity;
    };
    return lowestIn(a) > lowestIn(b);
  };

  // behind[i] = i 보다 먼저 그려야 하는(뒤에 있는) 구들
  const behind = items.map(() => new Set());
  for (let a = 0; a < items.length; a += 1) {
    for (let b = a + 1; b < items.length; b += 1) {
      const front = isInFront(a, b);
      if (front === undefined) continue;
      if (front) behind[a].add(b);
      else behind[b].add(a);
    }
  }

  const order = [];
  const placed = new Set();
  while (order.length < items.length) {
    // 남은 것 중 «뒤에 있어야 할 것»이 모두 놓인 구를 꺼낸다.
    const next = items
      .map((_, index) => index)
      .filter((index) => !placed.has(index))
      .find((index) => [...behind[index]].every((dependency) => placed.has(dependency)));

    if (next === undefined) {
      // 순환이 생기면(세 구가 서로 물릴 때) 남은 것은 아래쪽 순으로 둔다.
      const rest = items
        .map((_, index) => index)
        .filter((index) => !placed.has(index))
        .sort((x, y) => items[x].nearEdgeY - items[y].nearEdgeY);
      for (const index of rest) {
        order.push(index);
        placed.add(index);
      }
      console.log('   ! 앞뒤 관계에 순환이 있어 일부는 아래쪽 순으로 두었습니다.');
      break;
    }

    order.push(next);
    placed.add(next);
  }

  return order;
}

const drawOrder = resolveDrawOrder(entries);
drawOrder.forEach((entryIndex, position) => {
  entries[entryIndex].drawOrder = position;
});
console.log(`   그리는 순서: ${drawOrder.map((i) => entries[i].name).join(' → ')}`);

console.log('4/4 파일 작성');
const output = `/**
 * 광주광역시 자치구 경계 — **자동 생성 파일. 직접 고치지 마세요.**
 *
 *     npm run map:districts
 *
 * 출처: southkorea/southkorea-maps — 통계청 ${geojson.features[0]?.properties?.base_year ?? '2013'} 시군구 경계
 * 원본 위경도를 등장방형 투영(위도 보정 포함)으로 ${VIEW.width}×${VIEW.height} 좌표계에 맞추고,
 * Douglas–Peucker(허용오차 ${SIMPLIFY_TOLERANCE})로 단순화한 결과입니다.
 *
 * \`labelAnchor\` 는 무게중심이 아니라 **도형 안쪽에서 경계와 가장 먼 점**입니다.
 * 오목한 구에서 무게중심이 도형 밖으로 나가 이름이 옆 구에 찍히는 것을 막습니다.
 */

export const DISTRICT_VIEW = { width: ${VIEW.width}, height: ${VIEW.height} } as const;

export interface DistrictGeometry {
  code: string;
  name: string;
  englishName: string;
  /** SVG path. 여러 고리는 하나의 path 에 이어 붙였다. */
  path: string;
  /** 뒤에서 앞 순서. 그린 순서가 곧 앞뒤이므로 이 값 오름차순으로 그린다. */
  drawOrder: number;
  /** 앞쪽 실루엣에만 생기는 옆면. 평상시 높이. */
  wall: string;
  /** 고른 구가 솟았을 때의 옆면. 그만큼 길다. */
  wallLifted: string;
  labelAnchor: readonly [number, number];
  /** 카카오맵에 얹을 실제 경계. [위도, 경도] 순서이며 투영하지 않은 원본값이다. */
  boundary: readonly (readonly (readonly [number, number])[])[];
  /** 카카오맵 이름표 위치. [위도, 경도]. */
  labelLatLng: readonly [number, number];
}

export const DISTRICT_GEOMETRY: readonly DistrictGeometry[] = ${JSON.stringify(
  entries.map(({ inset: _inset, nearEdgeY: _nearEdgeY, ...rest }) => rest),
  null,
  2,
)
  .replace(/"([a-zA-Z]+)":/g, '$1:')
  .replace(/"/g, "'")};
`;

const outPath = readArg('--out', 'packages/core/src/data/gwangjuDistricts.geometry.ts');
writeFileSync(outPath, output, 'utf8');
console.log(`완료 — ${outPath} (${(output.length / 1024).toFixed(1)}KB)`);
