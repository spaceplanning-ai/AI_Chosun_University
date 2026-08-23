'use client';

import { SEARCH_SETTINGS } from '@/config/resourceSchemas';
import { useResourceStore } from '@/state/resources';

/**
 * 지금 저장된 검색 판정 기준.
 *
 * ── 왜 훅으로 빼는가 ───────────────────────────────────────────────
 * 이 값을 읽는 화면이 넷이다 — 검색 방식·검색 테스트·품질 검증·기준 질문.
 * 각 화면이 저장소를 직접 뒤지면 «기본값을 무엇으로 볼지»가 화면마다 갈리고,
 * 설정을 고쳐도 어떤 화면만 안 따라오는 일이 생긴다.
 *
 * 기본값은 스키마에 적힌 것을 그대로 쓴다. 화면에 숫자를 또 적어 두면
 * 스키마를 고쳤을 때 두 값이 어긋난다.
 */

export interface SearchSettings {
  minSimilarity: number;
  limit: number;
  /** 몇 위 안에 들어야 근거로 인정할지. */
  hitRank: number;
  /** 최고 점수가 이보다 낮으면 질의를 바꿔 다시 검색한다. */
  rerankThreshold: number;
  requireOfficialSource: boolean;
}

/** 스키마에 적힌 기본값. 화면이 숫자를 따로 들고 있지 않도록 여기서 꺼낸다. */
function defaultOf(key: string): unknown {
  return SEARCH_SETTINGS.fields.find((field) => field.key === key)?.defaultValue;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number {
  const value = record?.[key] ?? defaultOf(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function useSearchSettings(): SearchSettings {
  const { records } = useResourceStore(SEARCH_SETTINGS);
  // 설정은 한 벌뿐이므로 언제나 첫 줄을 본다.
  const saved = records[0] as Record<string, unknown> | undefined;

  const requireOfficialSource = saved?.requireOfficialSource ?? defaultOf('requireOfficialSource');

  return {
    minSimilarity: readNumber(saved, 'minSimilarity'),
    limit: readNumber(saved, 'topK'),
    hitRank: readNumber(saved, 'hitRank'),
    rerankThreshold: readNumber(saved, 'rerankThreshold'),
    requireOfficialSource: requireOfficialSource === true,
  };
}
