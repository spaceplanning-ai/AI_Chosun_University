'use client';

import { RECOMMENDER_SETTINGS } from '@/config/resourceSchemas';
import { SectionedSettingsView, type SettingsSection } from './SectionedSettingsView';

/**
 * 추천 설정 (3.1).
 *
 * ── 왜 구역을 나눴는가 ─────────────────────────────────────────────
 * 여섯 칸이 한 줄로 이어져 있으면 «지금 무엇을 정하는 중인지»가 흐려진다.
 * 값들은 추천이 만들어지는 순서대로 세 몫으로 갈린다.
 *
 *   ① 후보 추리기 — 어디까지를 후보로 볼 것인가 (몇 곳을 볼지, 어디서 자를지)
 *   ② 골라 담기   — 그중 무엇을 어떤 방식으로 고를 것인가
 *   ③ 근거 붙이기 — 고른 결과에 무엇을 함께 내보낼 것인가
 *
 * 이 순서는 추천 엔진이 실제로 도는 순서와 같다. 화면을 따라 내려가는 것이
 * 곧 «추천이 만들어지는 과정»을 따라가는 일이 된다.
 */

const SECTIONS: readonly SettingsSection[] = [
  { id: 'rec-pool', label: '후보 추리기', fields: ['candidateCount', 'trustFloor'] },
  { id: 'rec-pick', label: '골라 담기', fields: ['algorithm', 'diversityFactor', 'maxPerRegion'] },
  { id: 'rec-evidence', label: '근거 붙이기', fields: ['explainEveryStop'] },
];

export function RecommenderSettingsView() {
  return (
    <SectionedSettingsView
      schema={RECOMMENDER_SETTINGS}
      navLabel="추천 설정 구성"
      sections={SECTIONS}
      sheetDescription="저장하면 다음 추천부터 이 값으로 계산합니다."
    />
  );
}
