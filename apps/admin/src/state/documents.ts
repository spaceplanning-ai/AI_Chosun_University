'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OFFICIAL_DOCUMENTS } from '@namdo-prism/core/data';
import type { OfficialDocument } from '@namdo-prism/core/domain';

/**
 * 편집 중인 공식문서.
 *
 * 관광지 자료와 같은 구조다 — 브라우저에만 남고, 저장소에 반영하려면
 * JSON 으로 내려받아 `packages/core/src/data/documents.json` 을 교체한다.
 * 백엔드가 붙으면 이 store 의 세 동작(add/update/remove)만 API 호출로 바뀐다.
 *
 * 왜 화면 밖으로 뺐는가 — 문서를 고치면 신뢰도와 검색 근거가 함께 달라진다.
 * 화면 안에 두면 다른 화면이 옛 자료를 그대로 보게 된다.
 */

interface DocumentEditorState {
  documents: OfficialDocument[];
  update: (id: string, patch: Partial<OfficialDocument>) => void;
  add: (document: OfficialDocument) => void;
  remove: (id: string) => void;
  /** 저장소의 원본으로 되돌린다. 고치다 꼬였을 때의 탈출구다. */
  reset: () => void;
}

const seed = () => OFFICIAL_DOCUMENTS.map((document) => structuredClone(document));

export const useDocumentEditor = create<DocumentEditorState>()(
  persist(
    (set) => ({
      documents: seed(),
      update: (id, patch) =>
        set((state) => ({
          documents: state.documents.map((document) =>
            document.id === id ? { ...document, ...patch } : document,
          ),
        })),
      add: (document) => set((state) => ({ documents: [document, ...state.documents] })),
      remove: (id) =>
        set((state) => ({ documents: state.documents.filter((document) => document.id !== id) })),
      reset: () => set({ documents: seed() }),
    }),
    { name: 'namdo-prism.admin.documents' },
  ),
);
