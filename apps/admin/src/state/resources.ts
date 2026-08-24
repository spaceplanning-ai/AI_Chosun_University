'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ResourceRecord, ResourceSchema } from '@/config/resourceSchemas';

/**
 * 관리 화면이 다루는 자료의 보관소.
 *
 * ── 어디에 저장되는가 ──────────────────────────────────────────────
 * 백엔드가 없으므로 브라우저(localStorage)에 남긴다. 저장소에 반영하려면
 * 화면에서 JSON 으로 내려받아 넣어야 하며, 그 사실을 화면에도 적어 둔다.
 * 백엔드가 붙으면 이 파일만 API 호출로 바꾸면 되고 화면은 그대로다.
 *
 * ── 왜 스키마마다 store 를 따로 만드는가 ───────────────────────────
 * 하나의 store 에 모든 자료를 담으면 프롬프트를 고칠 때 시나리오 목록까지
 * 다시 그려진다. 자료끼리 서로를 끌고 다닐 이유가 없다.
 * 만든 store 는 스키마 id 로 기억해 두어, 화면을 오갈 때마다 새로 만들지 않는다.
 */

interface ResourceState {
  records: ResourceRecord[];
  /** 있으면 갈아 끼우고 없으면 뒤에 붙인다. 등록과 수정이 같은 경로를 쓴다. */
  upsert: (record: ResourceRecord) => void;
  remove: (id: string) => void;
  /** 초기 자료로 되돌린다. 고치다 꼬였을 때의 탈출구다. */
  reset: () => void;
}

type ResourceStoreHook = ReturnType<typeof createResourceStore>;

/** 스키마 id → 이미 만든 store. 렌더마다 새로 만들면 상태가 초기화된다. */
const STORES = new Map<string, ResourceStoreHook>();

function createResourceStore(schema: ResourceSchema) {
  const seed = () => schema.seed.map((record) => ({ ...record }));

  return create<ResourceState>()(
    persist(
      (set) => ({
        records: seed(),
        upsert: (record) =>
          set((state) => {
            const index = state.records.findIndex((existing) => existing.id === record.id);
            if (index === -1) return { records: [...state.records, record] };
            const records = [...state.records];
            records[index] = record;
            return { records };
          }),
        remove: (id) =>
          set((state) => ({ records: state.records.filter((record) => record.id !== id) })),
        reset: () => set({ records: seed() }),
      }),
      { name: `namdo-prism.admin.resource.${schema.id}` },
    ),
  );
}

/**
 * 스키마에 딸린 store 를 가져온다. 없으면 그때 만든다.
 *
 * `useMemo` 로 감싸지 않는다. 같은 id 면 늘 같은 것을 돌려주므로 외워 둘 이유가 없고,
 * 외워 두면 «훅을 만들어 내는 훅»이 되어 규칙이 흐려진다.
 */
function resourceStoreFor(schema: ResourceSchema): ResourceStoreHook {
  const existing = STORES.get(schema.id);
  if (existing) return existing;
  const created = createResourceStore(schema);
  STORES.set(schema.id, created);
  return created;
}

export function useResourceStore(schema: ResourceSchema) {
  /*
    이름이 `use` 로 시작해야 한다.

    이것은 zustand 가 만들어 준 **훅**이다. 그런데 이름이 `store` 면 도구들이
    그 사실을 알 수 없다 — 훅인지 아닌지는 이름으로만 판단하기 때문이다.
    React Compiler 는 그것을 보통 함수 호출로 보고 결과를 외워 두는데,
    그러면 자료가 바뀌어도 화면이 처음 값을 그대로 들고 있게 된다.
    실제로 그렇게 **목록이 영원히 빈 채로** 서 있었다.
  */
  const useStore = resourceStoreFor(schema);

  const records = useStore((state) => state.records);
  const upsert = useStore((state) => state.upsert);
  const remove = useStore((state) => state.remove);
  const reset = useStore((state) => state.reset);

  return { records, upsert, remove, reset };
}
