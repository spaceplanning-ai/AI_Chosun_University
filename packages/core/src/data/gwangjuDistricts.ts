/**
 * 광주광역시 자치구 안내도.
 *
 * 경계 도형은 손으로 그리지 않는다. 통계청 시군구 경계 GeoJSON 을 변환한
 * `gwangjuDistricts.geometry.ts`(자동 생성)에서 가져오고, 이 파일은 **사람이 쓰는 말**
 * — 안내 문구와 데이터 연결 — 만 갖는다.
 *
 *     npm run map:districts     # 경계 갱신
 *
 * 둘을 나눈 이유는 데이터 교체 요구(피드백 3.2)와 같다. 경계가 바뀌어도 안내 문구는 그대로 두고,
 * 안내 문구를 고쳐도 경계를 다시 만들 필요가 없다.
 */

import { ATTRACTIONS } from './attractions';
import { DISTRICT_GEOMETRY, DISTRICT_VIEW } from './gwangjuDistricts.geometry';
import type { Attraction } from '../domain/types/catalog';

export { DISTRICT_VIEW };

/** 구마다 사람이 써 넣는 값. 통계청 코드로 경계와 이어 붙인다. */
interface DistrictNotes {
  code: string;
  /** `attractions.json` 의 `district` 값. 이 문자열로 자원을 이어 붙인다. */
  datasetDistrict: string;
  /** 관람객에게 이 구를 한 줄로 설명하는 말. */
  summary: string;
}

const DISTRICT_NOTES: readonly DistrictNotes[] = [
  {
    code: '24010',
    datasetDistrict: '광주 동구',
    summary: '국립아시아문화전당과 무등산. 도심 문화가 가장 짙은 곳입니다.',
  },
  {
    code: '24020',
    datasetDistrict: '광주 서구',
    summary: '광주의 한가운데. 행정과 상업의 중심입니다.',
  },
  {
    code: '24030',
    datasetDistrict: '광주 남구',
    summary: '양림동 근대역사문화마을이 있는 남쪽. 골목이 이야기를 품은 곳입니다.',
  },
  {
    code: '24040',
    datasetDistrict: '광주 북구',
    summary: '호수와 박물관이 모인 북쪽. 담양으로 이어지는 길목입니다.',
  },
  {
    code: '24050',
    datasetDistrict: '광주 광산구',
    summary: 'KTX 광주송정역이 있는 관문. 남도 여행이 시작되는 곳입니다.',
  },
];

export interface GwangjuDistrict {
  /** 통계청 시군구 코드. 경계와 안내 문구를 잇는 열쇠. */
  id: string;
  name: string;
  englishName: string;
  datasetDistrict: string;
  summary: string;
  /** SVG path (`DISTRICT_VIEW` 좌표계). */
  path: string;
  /** 뒤에서 앞 순서. 그린 순서가 곧 앞뒤이므로 이 값 오름차순으로 그린다. */
  drawOrder: number;
  /** 앞쪽 실루엣에만 생기는 옆면. 평상시 높이. */
  wall: string;
  /** 고른 구가 솟았을 때의 옆면. */
  wallLifted: string;
  /** 구 이름을 얹을 위치. 도형 안쪽에서 경계와 가장 먼 점. */
  labelAnchor: readonly [number, number];
  /** 카카오맵에 얹을 실제 경계. [위도, 경도]. */
  boundary: readonly (readonly (readonly [number, number])[])[];
  /** 카카오맵 이름표 위치. [위도, 경도]. */
  labelLatLng: readonly [number, number];
}

/**
 * 경계와 안내 문구를 맞붙인다.
 *
 * 안내 문구가 없는 구는 **목록에서 조용히 빠지는 게 아니라 그대로 나온다.**
 * 경계 자료를 갱신했는데 구가 늘었다면 화면에 나타나야 알아채고 문구를 채울 수 있다.
 */
const BUILT_DISTRICTS: GwangjuDistrict[] = DISTRICT_GEOMETRY.map((geometry) => {
  const notes = DISTRICT_NOTES.find((entry) => entry.code === geometry.code);
  return {
    id: geometry.code,
    name: geometry.name,
    englishName: geometry.englishName,
    datasetDistrict: notes?.datasetDistrict ?? `광주 ${geometry.name}`,
    summary: notes?.summary ?? '',
    path: geometry.path,
    drawOrder: geometry.drawOrder,
    wall: geometry.wall,
    wallLifted: geometry.wallLifted,
    labelAnchor: geometry.labelAnchor,
    boundary: geometry.boundary,
    labelLatLng: geometry.labelLatLng,
  };
});

// 화면 순서는 자원이 많은 곳부터가 아니라 코드 순으로 고정한다. 목록이 실행마다 흔들리면 안 된다.
export const GWANGJU_DISTRICTS: readonly GwangjuDistrict[] = [...BUILT_DISTRICTS].sort((a, b) =>
  a.id.localeCompare(b.id),
);

/** 이 구에 있는 관광 자원. 자원이 바뀌면 안내 문구도 함께 바뀐다. */
export function districtAttractions(district: GwangjuDistrict): readonly Attraction[] {
  return ATTRACTIONS.filter((attraction) => attraction.district === district.datasetDistrict);
}

/**
 * 색 단계(0–3). 자원 수를 **네 구간**으로만 나눈다.
 * 값마다 다른 색을 주면 관람객이 색에서 정확한 수치를 읽어 내려 하게 되는데,
 * 그건 색이 할 수 있는 일이 아니다. 정확한 수는 라벨의 숫자가 말한다.
 */
export function districtIntensity(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}
