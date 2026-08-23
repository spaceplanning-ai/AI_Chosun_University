'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ATTRACTIONS } from '@namdo-prism/core/data';
import type { Attraction } from '@namdo-prism/core/domain';

/**
 * 편집 중인 관광지 자료.
 *
 * ── 왜 화면 밖으로 뺐는가 ──────────────────────────────────────────
 * 「등록」에서 고친 값을 「관리」의 검증이 그대로 봐야 한다.
 * 화면 안에 두면 두 화면이 각자의 사본을 들고 있게 되어,
 * 한쪽에서 고친 오류가 다른 쪽 검증에 잡히지 않는다.
 *
 * ── 어디에 저장되는가 ──────────────────────────────────────────────
 * 백엔드가 없으므로 브라우저에만 남는다. 저장소에 반영하려면
 * 「관리」에서 JSON 으로 내려받아 `packages/core/src/data/attractions.json` 을 교체한다.
 * 그 사실은 화면에도 적어 둔다 — 저장됐다고 오해하면 작업이 통째로 사라진다.
 */

interface AttractionEditorState {
  attractions: Attraction[];
  /** 한 곳의 일부 값만 고친다. */
  update: (id: string, patch: Partial<Attraction>) => void;
  /** 새 관광지를 목록 맨 앞에 넣는다. */
  add: (attraction: Attraction) => void;
  remove: (id: string) => void;
  /** 저장소의 원본으로 되돌린다. 고치다 꼬였을 때의 탈출구다. */
  reset: () => void;
}

const seed = () => ATTRACTIONS.map((attraction) => structuredClone(attraction));

export const useAttractionEditor = create<AttractionEditorState>()(
  persist(
    (set) => ({
      attractions: seed(),
      update: (id, patch) =>
        set((state) => ({
          attractions: state.attractions.map((attraction) =>
            attraction.id === id ? { ...attraction, ...patch } : attraction,
          ),
        })),
      add: (attraction) => set((state) => ({ attractions: [attraction, ...state.attractions] })),
      remove: (id) =>
        set((state) => ({
          attractions: state.attractions.filter((attraction) => attraction.id !== id),
        })),
      reset: () => set({ attractions: seed() }),
    }),
    {
      name: 'namdo-prism.admin.attractions',
      /*
        ── 왜 판을 올리는가 ──────────────────────────────────────────
        예전에는 「관광지 등록」을 누르는 순간 목록에 빈 줄을 넣고 상세를 열었다.
        지금은 확인창에서 「등록」을 눌러야 들어가지만, 그 시절에 만들어진
        **이름 없는 줄이 브라우저에 그대로 남아 있다.** 화면에서는 빈 줄로 보이고
        검증에서는 오류로 잡혀, 마치 지금도 누르자마자 저장되는 것처럼 보인다.

        고친 자료는 사람이 손으로 채운 것이라 통째로 버릴 수 없다.
        그래서 초기화하지 않고 «이름 없는 줄»만 걷어낸다.
      */
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as AttractionEditorState | undefined;
        if (!state || version >= 1) return state as AttractionEditorState;
        return {
          ...state,
          attractions: state.attractions.filter(
            (attraction) => attraction.name.trim().length > 0 && attraction.id.trim().length > 0,
          ),
        };
      },
    },
  ),
);
