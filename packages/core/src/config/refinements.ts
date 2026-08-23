/**
 * 일정 수정 요청 6종 정의 (제안서 6.5 / 8.6).
 *
 * 각 요청은 "이용자 언어로 된 버튼"인 동시에 "조건벡터에 가할 변화량"이다.
 * 변화량을 함수가 아니라 데이터로 적어 두었으므로 그대로 로그에 실리고,
 * 특허 명세서의 실시예 표로도 그대로 옮겨 쓸 수 있다.
 *
 * A단계는 `phase: 'A'` 인 2종만 노출한다(피드백 3.1 "제한형 2종 이상 실제 작동").
 * C단계 고도화에서 나머지 4종이 열린다(피드백 7.1 "반사실적 최소변경 일정재구성 전종 6개").
 */

import type { RefinementDefinition, RefinementId } from '../domain/types/replan';

export const REFINEMENT_DEFINITIONS: Record<RefinementId, RefinementDefinition> = {
  reduceWalking: {
    id: 'reduceWalking',
    label: '걷는 시간을 줄여줘',
    technicalName: '보행부담 최소화 재구성',
    objective: { kind: 'metric', metric: 'walkingLoad', direction: 'decrease' },
    constraintDelta: { walkingTolerance: -32, compactnessDemand: 14 },
    phase: 'A',
  },
  preferIndoor: {
    id: 'preferIndoor',
    label: '실내 일정으로 바꿔줘',
    technicalName: '실내 대안 치환 재구성',
    objective: { kind: 'metric', metric: 'indoorRatio', direction: 'increase' },
    constraintDelta: { indoorPreference: 38 },
    phase: 'A',
  },
  addNature: {
    id: 'addNature',
    label: '자연을 더 넣어줘',
    technicalName: '관광유형 구성비 조정 재구성 (자연)',
    objective: { kind: 'categoryShare', category: 'nature', direction: 'increase' },
    constraintDelta: { interestBoost: { nature: 0.3, rest: 0.05 } },
    phase: 'C',
  },
  includeSea: {
    id: 'includeSea',
    label: '바다를 포함해줘',
    technicalName: '관광유형 구성비 조정 재구성 (해양)',
    objective: { kind: 'categoryShare', category: 'sea', direction: 'increase' },
    constraintDelta: { interestBoost: { sea: 0.34 }, compactnessDemand: -10 },
    phase: 'C',
  },
  reduceCost: {
    id: 'reduceCost',
    label: '비용을 줄여줘',
    technicalName: '비용부담 최소화 재구성',
    objective: { kind: 'metric', metric: 'costLevel', direction: 'decrease' },
    constraintDelta: { costSensitivity: 36 },
    phase: 'C',
  },
  moreJeonnam: {
    id: 'moreJeonnam',
    label: '전남 관광지를 더 넣어줘',
    technicalName: '지역 구성비 조정 재구성 (전남)',
    objective: { kind: 'regionShare', region: 'jeonnam', direction: 'increase' },
    constraintDelta: { regionBias: { jeonnam: 26, gwangju: -10 }, compactnessDemand: -12 },
    phase: 'C',
  },
};

/** 화면 노출 순서. A단계 2종이 먼저 오도록 고정한다. */
export const REFINEMENT_ORDER: readonly RefinementId[] = [
  'reduceWalking',
  'preferIndoor',
  'addNature',
  'includeSea',
  'reduceCost',
  'moreJeonnam',
];

/** 현재 납품 단계에서 실제로 동작하는 재구성 요청만 돌려준다. */
export function getEnabledRefinements(phase: 'A' | 'C'): readonly RefinementDefinition[] {
  return REFINEMENT_ORDER.map((id) => REFINEMENT_DEFINITIONS[id]).filter(
    (definition) => phase === 'C' || definition.phase === 'A',
  );
}
