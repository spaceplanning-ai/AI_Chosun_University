'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ATTRACTIONS } from '@namdo-prism/core/data';
import { REGION_LABELS } from '@namdo-prism/core/domain';
import type { Region } from '@namdo-prism/core/domain';

/**
 * 취급 시·군·구.
 *
 * ── 무엇을 정하는가 ────────────────────────────────────────────────
 * 「이 서비스가 다루는 지역은 어디까지인가」를 정한다.
 * 관광지 자료는 소재지 표기로 지역 분포와 권역을 나누므로, 다루기로 한 곳이
 * 어디인지 적어 두지 않으면 «오타로 생긴 소재지»와 «새로 넣은 소재지»를
 * 구별할 방법이 없다. 「전남 담양군」을 「전남 담양」으로 잘못 쳐도 아무도 모른다.
 *
 * ── 무엇이 이 값을 읽는가 ──────────────────────────────────────────
 * 「관리」의 검증이 읽는다. 목록에 없는 소재지를 쓰는 관광지는 그 자리에서 걸린다.
 * 설정만 있고 아무도 안 읽는 화면은 두지 않는다.
 *
 * 저장은 브라우저까지다 — 관광지 자료와 같은 사정이다.
 */

export interface CoveredDistrict {
  /** 「전남 담양군」. 관광지의 소재지 표기와 글자 그대로 같아야 한다. */
  id: string;
  region: Region;
  /** 「담양군」. 지역 이름을 뗀 부분. */
  city: string;
}

/** 소재지 표기를 만든다. 저장할 때도 검증할 때도 이 한 곳을 거친다. */
export function districtId(region: Region, city: string): string {
  return `${REGION_LABELS[region]} ${city.trim()}`;
}

/**
 * 첫 목록은 지금 자료에 실제로 쓰이고 있는 소재지에서 뽑는다.
 * 빈 목록으로 시작하면 열자마자 22곳이 전부 오류로 뜬다.
 */
const seed = (): CoveredDistrict[] => {
  const found = new Map<string, CoveredDistrict>();
  for (const attraction of ATTRACTIONS) {
    if (found.has(attraction.district)) continue;
    const prefix = `${REGION_LABELS[attraction.region]} `;
    found.set(attraction.district, {
      id: attraction.district,
      region: attraction.region,
      city: attraction.district.startsWith(prefix)
        ? attraction.district.slice(prefix.length)
        : attraction.district,
    });
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id, 'ko'));
};

interface CoveredDistrictState {
  districts: CoveredDistrict[];
  /** 이미 있는 곳이면 아무 일도 하지 않는다. 같은 소재지가 둘이면 셈이 어긋난다. */
  add: (region: Region, city: string) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useCoveredDistricts = create<CoveredDistrictState>()(
  persist(
    (set) => ({
      districts: seed(),
      add: (region, city) =>
        set((state) => {
          const id = districtId(region, city);
          if (city.trim().length === 0 || state.districts.some((entry) => entry.id === id)) {
            return state;
          }
          return {
            districts: [...state.districts, { id, region, city: city.trim() }].sort((a, b) =>
              a.id.localeCompare(b.id, 'ko'),
            ),
          };
        }),
      remove: (id) =>
        set((state) => ({ districts: state.districts.filter((entry) => entry.id !== id) })),
      reset: () => set({ districts: seed() }),
    }),
    { name: 'namdo-prism.admin.districts' },
  ),
);
