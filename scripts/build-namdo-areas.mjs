/**
 * 행정경계 GeoJSON → 지도용 위경도 경계 (광주 5구 + 전남 22시군).
 *
 *     npm run map:areas
 *     node scripts/build-namdo-areas.mjs --source <url|파일경로>
 *
 * ── 왜 SVG 안내도 생성기와 따로 두는가 ─────────────────────────────
 * `build-district-map.mjs` 는 **손으로 그린 입체 안내도**를 만든다. 투영·기울임·옆면·
 * 이름표 자리가 모두 그 그림 전용이고, 광주 5구만 다룬다.
 *
 * 여기서 만드는 것은 **실제 지도 위에 얹을 경계**뿐이다 — 투영도 기울임도 없다.
 * 전남 22시군까지 넣으면 안내도 쪽 좌표계가 광주 기준이라 함께 다룰 수 없다.
 * 그래서 «지도에 얹는 자료»만 따로 뽑는다.
 *
 * ── 출처 ───────────────────────────────────────────────────────────
 * southkorea/southkorea-maps — 통계청 2013 시군구 경계
 * 코드 앞 두 자리: 24 = 광주광역시, 36 = 전라남도
 * ──────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { argv } from 'node:process';

const DEFAULT_SOURCE =
  'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo.json';

/**
 * 담을 지역. 앞 두 자리가 곧 시·도다.
 *
 * 전북은 **서비스 대상이 아니다** — 이 사업은 광주·전남을 다룬다.
 * 그래도 그리는 이유는, 전남 위쪽이 잘린 채 회색으로 남으면 «지도가 덜 그려진» 것처럼 보이고
 * 담양·곡성처럼 도 경계에 붙은 시군이 어디까지인지 읽히지 않기 때문이다.
 * 관광지가 없으므로 이름표도 멀리서는 뜨지 않는다.
 */
const REGION_BY_PREFIX = { 24: 'gwangju', 35: 'jeonbuk', 36: 'jeonnam' };
/** 관광지 자료(`attractions.json`)의 `district` 값 앞에 붙는 말. */
const PREFIX_LABEL = { gwangju: '광주', jeonbuk: '전북', jeonnam: '전남' };

/**
 * 단순화 강도(도 단위).
 *
 * 지도 위에 얹는 선이라 안내도만큼 매끄러울 필요가 없다 — 바탕 지도의 도로가 이미 촘촘하다.
 * 전남은 해안선과 섬이 많아 원본을 그대로 두면 파일이 몇 MB가 된다.
 * 화면에서 형태를 알아볼 수 있는 선에서 가장 세게 줄인다.
 */
const TOLERANCE = 0.0022;

/**
 * 남길 섬의 최소 크기(제곱도).
 *
 * 신안·완도·진도는 고리가 수백 개다. 지도에서 점처럼 찍히는 섬까지 담으면
 * 파일만 커지고 화면에서는 보이지도 않는다. 눈에 보이는 크기부터 남긴다.
 */
const MIN_RING_AREA = 0.00012;

/** 좌표 소수 자릿수. 5자리면 약 1m 이내다 — 시군 경계에는 넘치도록 충분하다. */
const PRECISION = 5;

/**
 * 격자에 맞추는 자릿수.
 *
 * 이웃한 두 시군은 **같은 선**을 맞대고 있다. 그런데 각자 따로 단순화하면 그 선이
 * 미세하게 어긋나 두 줄로 갈라지거나 사이에 틈이 생긴다 —
 * 지도에서 «경계가 두 겹으로 그려진» 것처럼 보이는 까닭이 이것이다.
 *
 * 그래서 단순화 **전에** 좌표를 같은 격자에 맞춰 둔다. 맞닿은 점이 완전히 같은 값이 되면
 * 뒤따르는 단순화도 같은 판단을 내려, 두 시군이 같은 선을 그린다.
 * 4자리는 약 11m — 시군 경계에서는 눈에 띄지 않는 거리다.
 */
const SNAP = 4;

/** 좌표를 격자에 맞추고, 그 결과 겹쳐진 연속 점은 하나로 줄인다. */
function snapRing(ring) {
  const snapped = ring.map(([x, y]) => [Number(x.toFixed(SNAP)), Number(y.toFixed(SNAP))]);
  return snapped.filter(
    ([x, y], index) => index === 0 || x !== snapped[index - 1][0] || y !== snapped[index - 1][1],
  );
}

const sourceIndex = argv.indexOf('--source');
const source = sourceIndex === -1 ? DEFAULT_SOURCE : argv[sourceIndex + 1];

console.log(`1/4 원본 읽기 — ${source}`);
const raw = source.startsWith('http')
  ? await (await fetch(source)).text()
  : readFileSync(source, 'utf8');
const geo = JSON.parse(raw);

/** 폴리곤·멀티폴리곤을 고리 목록으로 편다. */
function toRings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

/** 라머-더글러스-포이커. 형태를 지키면서 점을 줄인다. */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDistance = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicular(points[i], first, last);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance <= tolerance) return [first, last];

  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

function perpendicular([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

/**
 * 모서리 깎기(Chaikin).
 *
 * 줄인 경계는 꺾이는 자리가 각져 «자료를 그대로 찍어낸» 선으로 보인다.
 * 각 변을 1/4·3/4 지점으로 갈라 다시 이으면 모서리가 둥글게 말려, 같은 좌표로도
 * 손으로 다듬은 선처럼 읽힌다.
 *
 * 맞닿은 시군이 갈라지지 않는 이유: 이 계산은 **변 하나만 보고** 하므로,
 * 앞서 격자에 맞춰 둔 공통 구간은 양쪽에서 똑같은 결과가 나온다.
 */
function smoothRing(ring, passes = 2) {
  let points = ring;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      next.push([x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25]);
      next.push([x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75]);
    }
    points = next;
  }
  return points;
}

/**
 * 모서리를 깎은 뒤 다시 거르는 강도.
 *
 * 깎기는 점을 네 배로 늘리는데 그중 상당수는 거의 일직선 위에 있다.
 * 형태는 그대로 두고 그런 점만 걷어 내면 파일이 절반 아래로 줄어든다.
 */
const RESIMPLIFY = 0.0009;

/** 고리가 감싸는 넓이(부호 없음). 섬을 걸러 낼 때만 쓴다. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** 고리에서 가장 가까운 변까지의 거리. 이름표 자리를 고를 때 쓴다. */
function distanceToRing(point, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    best = Math.min(best, perpendicular(point, ring[j], ring[i]));
  }
  return best;
}

/**
 * 이름표를 놓을 자리.
 *
 * 무게중심을 쓰면 «ㄷ» 자로 굽은 시군에서 이름표가 도형 바깥에 앉는다.
 * 그래서 도형 안쪽에서 **경계로부터 가장 먼 점**을 격자로 찾는다 — 눈으로 고르는 자리와 같다.
 */
function labelPoint(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const steps = 40;
  let best = [(minX + maxX) / 2, (minY + maxY) / 2];
  let bestDistance = -1;

  for (let i = 1; i < steps; i += 1) {
    for (let j = 1; j < steps; j += 1) {
      const point = [minX + ((maxX - minX) * i) / steps, minY + ((maxY - minY) * j) / steps];
      if (!inside(point, ring)) continue;
      const distance = distanceToRing(point, ring);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
  }
  return best;
}

console.log('2/4 지역 고르기');
const features = geo.features.filter((feature) => {
  const prefix = String(feature.properties.code).slice(0, 2);
  return REGION_BY_PREFIX[prefix] !== undefined;
});
console.log(`   ${features.length}개`);

console.log('3/4 단순화');
const areas = features
  .map((feature) => {
    const region = REGION_BY_PREFIX[String(feature.properties.code).slice(0, 2)];
    const name = feature.properties.name;

    const rings = toRings(feature.geometry)
      // 맞닿은 시군이 같은 선을 그리도록, 줄이기 전에 먼저 격자에 맞춘다.
      .map(snapRing)
      .map((ring) => simplify(ring, TOLERANCE))
      .filter((ring) => ring.length >= 4 && ringArea(ring) >= MIN_RING_AREA)
      // 각진 모서리를 깎고, 깎으며 늘어난 군더더기 점을 다시 걷어 낸다.
      .map((ring) => simplify(smoothRing(ring), RESIMPLIFY))
      // 큰 고리부터. 첫 고리가 본체이고 나머지는 섬이다.
      .sort((a, b) => ringArea(b) - ringArea(a));

    const originalPoints = toRings(feature.geometry).reduce((sum, ring) => sum + ring.length, 0);
    const points = rings.reduce((sum, ring) => sum + ring.length, 0);
    console.log(
      `   ${name.padEnd(6)} ${String(originalPoints).padStart(6)} → ${String(points).padStart(4)}점 · ${String(rings.length).padStart(3)}고리`,
    );

    const [lng, lat] = labelPoint(rings[0]);

    return {
      code: String(feature.properties.code),
      name,
      region,
      datasetDistrict: `${PREFIX_LABEL[region]} ${name}`,
      boundary: rings.map((ring) =>
        ring.map(([x, y]) => [Number(y.toFixed(PRECISION)), Number(x.toFixed(PRECISION))]),
      ),
      labelLatLng: [Number(lat.toFixed(PRECISION)), Number(lng.toFixed(PRECISION))],
    };
  })
  // 광주 → 전남 → 전북, 그 안에서는 이름순. 화면 목록의 순서가 여기서 정해진다.
  .sort((a, b) => {
    const order = { gwangju: 0, jeonnam: 1, jeonbuk: 2 };
    return order[a.region] === order[b.region]
      ? a.name.localeCompare(b.name, 'ko')
      : order[a.region] - order[b.region];
  });

console.log('4/4 파일 쓰기');
const output = `/**
 * 지도용 행정경계 — 광주 5구 · 전남 22시군 · 전북 15시군. **자동 생성 파일이므로 직접 고치지 않는다.**
 *
 *     npm run map:areas
 *
 * 출처: southkorea/southkorea-maps (통계청 2013 시군구 경계)
 * 좌표는 [위도, 경도] 순이며 소수 ${PRECISION}자리까지 남긴다.
 */

export interface NamdoAreaGeometry {
  /** 통계청 시군구 코드. */
  code: string;
  name: string;
  region: 'gwangju' | 'jeonnam' | 'jeonbuk';
  /** \`attractions.json\` 의 \`district\` 값. 이 문자열로 관광지를 이어 붙인다. */
  datasetDistrict: string;
  /** 실제 경계. [위도, 경도]. 첫 고리가 본체이고 나머지는 섬이다. */
  boundary: readonly (readonly (readonly [number, number])[])[];
  /** 이름표 자리. 도형 안쪽에서 경계로부터 가장 먼 점. */
  labelLatLng: readonly [number, number];
}

export const NAMDO_AREA_GEOMETRY: readonly NamdoAreaGeometry[] = ${JSON.stringify(areas, null, 2)};
`;

const target = 'packages/core/src/data/namdoAreas.geometry.ts';
writeFileSync(target, output, 'utf8');

const totalPoints = areas.reduce(
  (sum, area) => sum + area.boundary.reduce((inner, ring) => inner + ring.length, 0),
  0,
);
console.log(`\n${target} — ${areas.length}개 지역 · ${totalPoints}점 · ${(output.length / 1024).toFixed(0)}KB`);
