/**
 * 남도 행정구역 — 광주 5구 · 전남 22시군 · 전북 15시군.
 *
 * 경계 도형은 손으로 적지 않는다. 통계청 시군구 경계에서 뽑아 둔
 * `namdoAreas.geometry.ts`(자동 생성)에서 가져오고, 이 파일은 **사람이 쓰는 말**과
 * 자료 연결만 갖는다.
 *
 *     npm run map:areas     # 경계 갱신
 *
 * ── 왜 광주 5구와 따로 두지 않는가 ─────────────────────────────────
 * 지도 위에서는 광주 동구와 전남 담양군이 나란히 놓인다. 둘을 다른 목록으로 들고 있으면
 * 색·이름표·누름 처리를 두 벌로 적게 되고, 한쪽만 고치는 일이 생긴다.
 * 지도에 얹는 것은 «행정구역» 하나의 목록이다.
 */

import { ATTRACTIONS } from './attractions';
import { GWANGJU_DISTRICTS } from './gwangjuDistricts';
import { NAMDO_AREA_GEOMETRY, type NamdoAreaGeometry } from './namdoAreas.geometry';
import type { Attraction } from '../domain/types/catalog';

export interface NamdoArea extends NamdoAreaGeometry {
  /**
   * 이 구역을 한 줄로 설명하는 말.
   *
   * 광주 5개 구에만 있다. 전남 22개 시군은 아직 사람이 써 넣은 문구가 없어 비워 둔다 —
   * 없는 말을 지어내면 화면에 그럴듯한 거짓이 남는다.
   */
  summary?: string;
  englishName?: string;
}

/** 광주 5구는 이미 안내 문구를 갖고 있다. 같은 소재지 이름으로 이어 붙인다. */
const GWANGJU_NOTES = new Map(
  GWANGJU_DISTRICTS.map((district) => [
    district.datasetDistrict,
    { summary: district.summary, englishName: district.englishName },
  ]),
);

export const NAMDO_AREAS: readonly NamdoArea[] = NAMDO_AREA_GEOMETRY.map((area) => ({
  ...area,
  ...GWANGJU_NOTES.get(area.datasetDistrict),
}));

/** 이 구역에 속한 관광지. 소재지 문자열로 잇는다. */
export function areaAttractions(area: NamdoArea): Attraction[] {
  return ATTRACTIONS.filter((attraction) => attraction.district === area.datasetDistrict);
}

/**
 * 자원 수를 색 단계로 바꾼다.
 *
 * 절대 개수로 나누면 자료가 늘 때마다 색이 통째로 바뀐다. 단계는 «없음 / 적음 / 보통 / 많음»
 * 네 칸이면 충분하고, 그 이상은 지도에서 구별되지도 않는다.
 */
export function areaIntensity(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

/** 지도에서 이름표를 누를 수 있는 구역만. 자원이 없는 곳도 경계는 보인다. */
export function hasAttractions(area: NamdoArea): boolean {
  return areaAttractions(area).length > 0;
}

/**
 * 이 사업이 실제로 다루는 구역 — 광주와 전남.
 *
 * 전북은 지도에 그리되 대상은 아니다. 전남 위쪽이 잘린 채 회색으로 남으면
 * 지도가 덜 그려진 것처럼 보이고, 도 경계에 붙은 시군이 어디까지인지 읽히지 않는다.
 * 다만 **첫 화면은 대상 지역에 맞춘다** — 처음 보이는 범위가 곧 «무엇을 다루는가»이기 때문이다.
 */
export const SERVICE_AREAS: readonly NamdoArea[] = NAMDO_AREAS.filter(
  (area) => area.region !== 'jeonbuk',
);

/** 시·도 하나. 멀리서 볼 때 시군 대신 이것만 보인다. */
export interface NamdoProvince {
  region: NamdoArea['region'];
  name: string;
  /** 이름표 자리. 속한 시군들의 이름표 자리를 평균해 구한다. */
  labelLatLng: readonly [number, number];
  areas: readonly NamdoArea[];
}

/**
 * 시·도 단위 묶음.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 아주 멀리서 보면 시군 이름표는 서로 밀어내다 몇 개만 남는다. 그런데 그 몇 개는
 * «남은 것»일 뿐 «중요한 것»이 아니라서, 화면이 무엇을 말하는지 알 수 없게 된다.
 * 그 배율에서 사람이 알아야 하는 것은 시군이 아니라 «여기가 전남, 저기가 전북»이다.
 *
 * 이름표 자리는 시군 이름표 자리의 평균이다. 경계 상자의 한가운데를 쓰면
 * 섬이 많은 전남에서 바다 한복판에 앉는다.
 */
export const NAMDO_PROVINCES: readonly NamdoProvince[] = (
  [
    { region: 'gwangju' as const, name: '광주광역시' },
    { region: 'jeonnam' as const, name: '전라남도' },
    { region: 'jeonbuk' as const, name: '전라북도' },
  ]
).map(({ region, name }) => {
  const areas = NAMDO_AREAS.filter((area) => area.region === region);
  const lat = areas.reduce((sum, area) => sum + area.labelLatLng[0], 0) / areas.length;
  const lng = areas.reduce((sum, area) => sum + area.labelLatLng[1], 0) / areas.length;
  return { region, name, areas, labelLatLng: [lat, lng] as const };
});
