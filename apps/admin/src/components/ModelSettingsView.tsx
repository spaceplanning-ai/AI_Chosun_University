'use client';

import { MODEL_SETTINGS } from '@/config/resourceSchemas';
import { SectionedSettingsView, type SettingsSection } from './SectionedSettingsView';

/**
 * AI 모델 설정 (9.1).
 *
 * ── 왜 구역을 나눴는가 ─────────────────────────────────────────────
 * 다섯 칸이 한 덩어리로 있으면 «응답 변동성»과 «최대 토큰»이 같은 종류의 값처럼 보인다.
 * 실제로는 각각 다른 것을 정한다 — 무엇으로 답을 만들지, 답이 매번 얼마나 달라질지,
 * 얼마나 길게 받을지, 얼마나 기다릴지.
 *
 * 「응답 시간」에만 칸이 둘인 이유는 재시도가 제한시간과 한 몸이기 때문이다.
 * 제한시간을 넘겼을 때 무엇을 할지가 재시도이므로, 따로 두면 한쪽만 고치게 된다.
 */

const SECTIONS: readonly SettingsSection[] = [
  {
    id: 'model-name',
    label: '모델 설정',
    description: '어떤 모델로 답변을 만들지 고릅니다.',
    fields: ['model'],
  },
  {
    id: 'model-variety',
    label: '응답 변동성',
    description: '같은 질문에 매번 얼마나 비슷하게 답할지 정합니다. 낮을수록 답이 일정합니다.',
    fields: ['temperature'],
  },
  {
    id: 'model-length',
    label: '토큰 설정',
    description: '한 번에 주고받을 수 있는 최대 분량입니다.',
    fields: ['maxTokens'],
  },
  {
    id: 'model-wait',
    label: '응답 시간',
    description: '얼마나 기다릴지, 그 안에 답이 없으면 어떻게 할지 정합니다.',
    fields: ['timeoutSeconds', 'retryOnTimeout'],
  },
];

export function ModelSettingsView() {
  return (
    <SectionedSettingsView
      schema={MODEL_SETTINGS}
      navLabel="모델 설정 구성"
      sections={SECTIONS}
      sheetDescription="저장하면 다음 요청부터 이 값으로 호출합니다."
    />
  );
}
