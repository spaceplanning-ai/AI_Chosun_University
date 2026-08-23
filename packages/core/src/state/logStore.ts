'use client';

/**
 * 세션 로그 스토어.
 *
 * 키오스크가 세션마다 한 건씩 쌓고, 운영자가 CSV/JSON으로 내보낸다.
 * 어드민은 같은 스토어 타입에 파일을 가져와 채운다 — 두 앱이 별도 오리진에 배포되므로
 * localStorage 를 공유할 수 없고, 파일이 유일하게 성립하는 전달 경로다.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOG_SCHEMA_VERSION, type SessionLog, type SessionLogBundle } from '../lib/logging/schema';

/**
 * 보관 상한. 전시 기간 내내 무한정 쌓이면 localStorage 용량(보통 5MB)을 넘겨
 * 저장이 조용히 실패한다. 상한을 넘으면 오래된 것부터 버린다.
 */
export const MAX_RETAINED_SESSIONS = 300;

interface LogState {
  sessions: SessionLog[];
  append: (session: SessionLog) => void;
  /** 같은 sessionId 가 있으면 교체한다. 재구성으로 세션이 갱신될 때 쓴다. */
  upsert: (session: SessionLog) => void;
  replaceAll: (sessions: SessionLog[]) => void;
  clear: () => void;
}

export function createLogStore(storageKey: string) {
  return create<LogState>()(
    persist(
      (set) => ({
        sessions: [],
        append: (session) =>
          set((state) => ({ sessions: [...state.sessions, session].slice(-MAX_RETAINED_SESSIONS) })),
        upsert: (session) =>
          set((state) => {
            const index = state.sessions.findIndex(
              (existing) => existing.sessionId === session.sessionId,
            );
            if (index === -1) {
              return { sessions: [...state.sessions, session].slice(-MAX_RETAINED_SESSIONS) };
            }
            const sessions = [...state.sessions];
            sessions[index] = session;
            return { sessions };
          }),
        replaceAll: (sessions) => set({ sessions: sessions.slice(-MAX_RETAINED_SESSIONS) }),
        clear: () => set({ sessions: [] }),
      }),
      { name: storageKey },
    ),
  );
}

export type LogStore = ReturnType<typeof createLogStore>;

export function buildLogBundle(sessions: readonly SessionLog[], kioskId: string): SessionLogBundle {
  return {
    schemaVersion: LOG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    kioskId,
    sessions: [...sessions],
  };
}
