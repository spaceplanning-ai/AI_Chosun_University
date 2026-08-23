/**
 * 논문 연구모형 (제안서 10.3) 과 로그 필드의 대응.
 *
 * 제안서 10.4는 연구용 로그가 무엇을 담아야 하는지 적었고, 10.3은 어떤 변수를 볼 것인지 적었다.
 * 둘을 이어 두지 않으면 전시가 끝난 뒤에야 "그 변수를 재려면 이 값이 필요했는데 안 남겼다"를 알게 된다.
 *
 * 그래서 변수마다 **어느 로그 필드로 측정하는지**를 명시하고,
 * 프런트엔드가 채울 수 없는 변수는 숨기지 않고 그 사실을 함께 적는다.
 */

export type VariableRole = 'independent' | 'mediating' | 'dependent';

export const VARIABLE_ROLE_LABELS: Record<VariableRole, string> = {
  independent: '독립변수',
  mediating: '매개변수',
  dependent: '종속변수',
};

/** 이 변수를 무엇으로 측정하는가. */
export type MeasurementSource =
  | { kind: 'log'; field: string }
  | { kind: 'survey'; instrument: string }
  | { kind: 'unavailable'; reason: string };

export interface ResearchVariable {
  id: string;
  role: VariableRole;
  name: string;
  /** 제안서 10.2 연구목적 중 이 변수가 답하려는 질문. */
  question: string;
  measurement: MeasurementSource;
}

/**
 * 제안서 10.3의 변수 목록을 그대로 옮기되, 측정 수단을 덧붙였다.
 *
 * `kind: 'survey'` 는 전시 현장 설문(제안서 10.5)으로 받아야 하는 값이다.
 * 시스템이 대신 만들어 낼 수 없으므로 그렇게 표시한다 —
 * 로그에 비슷한 이름의 필드를 만들어 두면 측정한 것처럼 오해된다.
 */
export const RESEARCH_VARIABLES: readonly ResearchVariable[] = [
  {
    id: 'personalization',
    role: 'independent',
    name: '개인화 정도',
    question: '이용자 조건을 얼마나 반영했는가',
    measurement: { kind: 'log', field: 'conditionVector · candidates[].criteria.preferenceFit' },
  },
  {
    id: 'rationale-provided',
    role: 'independent',
    name: '추천 근거 제공 여부',
    question: 'AI 추천 근거 제시가 정보 신뢰도에 영향을 주는가',
    measurement: { kind: 'log', field: 'finalItinerary 각 방문지의 rationale.reasons' },
  },
  {
    id: 'source-provided',
    role: 'independent',
    name: '공식 출처 제공 여부',
    question: '공식 출처 표시가 신뢰도에 영향을 주는가',
    measurement: { kind: 'log', field: 'retrieval.documents[] · trustAssessments[]' },
  },
  {
    id: 'refinement-available',
    role: 'independent',
    name: '일정 수정 가능 여부',
    question: '수정기능이 추천 만족도에 영향을 주는가',
    measurement: { kind: 'log', field: 'refinements[] (사용 여부·횟수)' },
  },
  {
    id: 'ui-mode',
    role: 'independent',
    name: 'UI 모드',
    question: '큰 글씨 모드가 디지털 접근성에 영향을 주는가',
    measurement: { kind: 'log', field: 'uiMode · contrast' },
  },
  {
    id: 'device-context',
    role: 'independent',
    name: '키오스크 / 모바일 이용환경',
    question: '키오스크와 모바일의 사용성이 어떻게 다른가',
    measurement: {
      kind: 'unavailable',
      reason:
        'QR 접속 여부를 키오스크가 알 수 없다(오프라인 구동). 모바일 이용은 별도 측정이 필요하다.',
    },
  },

  {
    id: 'perceived-fit',
    role: 'mediating',
    name: '인지된 적합성',
    question: '추천 일정이 내 취향에 맞다고 느꼈는가',
    measurement: { kind: 'survey', instrument: '현장 설문 문항 1' },
  },
  {
    id: 'perceived-trust',
    role: 'mediating',
    name: '인지된 신뢰도',
    question: '공식 출처 표시로 신뢰가 생겼는가',
    measurement: { kind: 'survey', instrument: '현장 설문 문항 3' },
  },
  {
    id: 'explanation-clarity',
    role: 'mediating',
    name: '설명 이해도',
    question: '추천 이유를 쉽게 이해했는가',
    measurement: { kind: 'survey', instrument: '현장 설문 문항 2' },
  },
  {
    id: 'ease-of-use',
    role: 'mediating',
    name: '사용 편의성',
    question: '조작이 쉬웠는가',
    measurement: {
      kind: 'log',
      field: '보조지표로 generationMs · refinements[].elapsedMs (체감은 설문 필요)',
    },
  },

  {
    id: 'satisfaction',
    role: 'dependent',
    name: '추천 만족도',
    question: '추천 결과에 만족했는가',
    measurement: { kind: 'survey', instrument: '현장 설문 문항 5' },
  },
  {
    id: 'visit-intention',
    role: 'dependent',
    name: '광주·전남 방문의도',
    question: '실제로 이 여행을 고려할 의향이 있는가',
    measurement: { kind: 'survey', instrument: '현장 설문 문항 6' },
  },
  {
    id: 'qr-save-intention',
    role: 'dependent',
    name: 'QR 저장의도',
    question: '결과를 가져가고자 했는가',
    measurement: { kind: 'log', field: 'qrGenerated' },
  },
  {
    id: 'linked-travel-choice',
    role: 'dependent',
    name: '광주·전남 연계여행 선택의도',
    question: '두 지역을 함께 여행하고 싶어졌는가',
    measurement: {
      kind: 'log',
      field: 'finalItinerary.metrics.linkageScore · stopsByRegion (행동 측정치)',
    },
  },
];

/** 프런트엔드 로그만으로 측정 가능한 변수의 비율(%). 연구 설계 시 설문 필요량을 가늠하는 데 쓴다. */
export function logCoverageRatio(): number {
  const measurable = RESEARCH_VARIABLES.filter(
    (variable) => variable.measurement.kind === 'log',
  ).length;
  return Math.round((measurable / RESEARCH_VARIABLES.length) * 100);
}
