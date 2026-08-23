import { REGION_LABELS } from './labels';
import { REGIONS, type Region } from './types/catalog';

/**
 * 광주·전남의 시·군·구.
 *
 * ── 왜 목록을 박아 두는가 ──────────────────────────────────────────
 * 소재지를 손으로 치면 「전남 담양군」·「전남 담양」·「담양군」이 섞인다.
 * 형식은 다 멀쩡해서 검증기가 못 잡지만, 지역 분포와 권역은 이 글자를 그대로
 * 견주므로 한 글자만 달라도 그 관광지가 조용히 어디에도 안 잡힌다.
 * 고를 수 있는 것만 두면 그런 어긋남이 애초에 생기지 않는다.
 *
 * ── 왜 라이브러리를 안 쓰는가 ──────────────────────────────────────
 * 키오스크는 전시장에서 인터넷 없이 돈다. 행정구역을 내려받는 서비스에 기대면
 * 그 자리에서 빈 목록이 된다. 광주 5개 구와 전남 22개 시·군은 자주 바뀌지도
 * 않으므로, 목록 자체를 자료로 들고 있는 편이 작고 확실하다.
 *
 * 기준: 행정안전부 행정구역 (광주광역시 자치구 5, 전라남도 시 5·군 17).
 * 통합·분리가 있으면 이 파일만 고치면 된다 — 화면들은 여기만 본다.
 */

export const DISTRICTS_BY_REGION: Record<Region, readonly string[]> = {
  gwangju: ['광산구', '남구', '동구', '북구', '서구'],
  jeonnam: [
    '강진군',
    '고흥군',
    '곡성군',
    '광양시',
    '구례군',
    '나주시',
    '담양군',
    '목포시',
    '무안군',
    '보성군',
    '순천시',
    '신안군',
    '여수시',
    '영광군',
    '영암군',
    '완도군',
    '장성군',
    '장흥군',
    '진도군',
    '함평군',
    '해남군',
    '화순군',
  ],
};

export interface DistrictEntry {
  region: Region;
  /** 「담양군」. 지역 이름을 뗀 부분. */
  city: string;
  /** 「전남 담양군」. 관광지 자료의 소재지에 그대로 들어가는 글자다. */
  label: string;
}

/** 소재지 표기를 만든다. 저장할 때도 견줄 때도 이 한 곳을 거친다. */
export function districtLabel(region: Region, city: string): string {
  return `${REGION_LABELS[region]} ${city.trim()}`;
}

/** 광주·전남 전체를 한 줄로 편 목록. 고르는 칸이 이것을 그대로 쓴다. */
export const ALL_DISTRICTS: readonly DistrictEntry[] = REGIONS.flatMap((region) =>
  DISTRICTS_BY_REGION[region].map((city) => ({
    region,
    city,
    label: districtLabel(region, city),
  })),
);

/** 「전남 담양군」이 실제로 있는 곳인가. 없으면 오타이거나 사업 범위 밖이다. */
export function isKnownDistrict(label: string): boolean {
  return ALL_DISTRICTS.some((entry) => entry.label === label);
}
