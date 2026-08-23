/**
 * 백엔드가 채워 줄 자료의 계약.
 *
 * 프런트엔드는 이 타입만 보고 화면을 그린다.
 * 백엔드는 이 모양대로만 주면 화면이 그대로 살아난다 — 화면 코드를 고칠 필요가 없다.
 */

/** 어떤 화면이 어떤 자료를 기다리는지 나타내는 한 항목. */
export interface ContractField {
  /** 응답 필드명. 백엔드가 이 이름으로 준다. */
  name: string;
  /** 타입 표기. 문서용이므로 사람이 읽는 문자열이다. */
  type: string;
  /** 이 값이 화면에서 무엇으로 쓰이는지. */
  note: string;
}

/** 화면 하나가 기다리는 API 하나. */
export interface BackendContract {
  /** 이 계약을 쓰는 화면 id. `navigation.ts` 의 id 와 같다. */
  viewId: string;
  /** 예상 엔드포인트. 실제 경로는 백엔드가 정하되 이름은 이 뜻을 유지한다. */
  endpoint: string;
  method: 'GET' | 'POST';
  /** 응답에 담겨야 하는 필드. */
  fields: readonly ContractField[];
}

/**
 * 백엔드 대기 중인 화면들의 계약 목록.
 *
 * 여기에만 적어 두면 화면·문서·인계 자료가 같은 내용을 본다.
 */
export const BACKEND_CONTRACTS: readonly BackendContract[] = [
  {
    viewId: 'doc-chunk',
    endpoint: '/api/documents/{documentId}/chunks',
    method: 'GET',
    fields: [
      { name: 'chunkId', type: 'string', note: '청크 식별자' },
      { name: 'order', type: 'number', note: '문서 안 순서' },
      { name: 'text', type: 'string', note: '원문. 화면에 그대로 보여 준다' },
      { name: 'tokenCount', type: 'number', note: '토큰 수' },
      { name: 'embeddingState', type: "'pending' | 'done' | 'failed'", note: '임베딩 진행 상태' },
      { name: 'usageCount', type: 'number', note: '검색에 쓰인 횟수' },
    ],
  },
  {
    viewId: 'doc-embedding',
    endpoint: '/api/embeddings/status',
    method: 'GET',
    fields: [
      { name: 'model', type: 'string', note: '임베딩 모델명' },
      { name: 'dimension', type: 'number', note: '벡터 차원' },
      { name: 'version', type: 'string', note: '재현을 위한 버전. 로그에도 같이 남는다' },
      { name: 'indexedChunks', type: 'number', note: '색인 완료 청크 수' },
      { name: 'pendingChunks', type: 'number', note: '대기 중 청크 수' },
      { name: 'lastIndexedAt', type: 'string (ISO)', note: '마지막 색인 시각' },
    ],
  },
  {
    viewId: 'sys-model',
    endpoint: '/api/system/model',
    method: 'GET',
    fields: [
      { name: 'model', type: 'string', note: '사용 중인 생성모델' },
      { name: 'temperature', type: 'number', note: '샘플링 온도' },
      { name: 'maxTokens', type: 'number', note: '최대 출력 토큰' },
      { name: 'version', type: 'string', note: '연구 로그에 함께 기록할 버전' },
    ],
  },
  {
    viewId: 'sys-prompt',
    endpoint: '/api/system/prompts',
    method: 'GET',
    fields: [
      { name: 'promptId', type: 'string', note: '프롬프트 식별자' },
      { name: 'version', type: 'string', note: '버전. 결과 재현의 열쇠' },
      { name: 'body', type: 'string', note: '프롬프트 본문' },
      { name: 'appliedAt', type: 'string (ISO)', note: '적용 시작일' },
      { name: 'isExperiment', type: 'boolean', note: '실험용인지 운영용인지' },
    ],
  },
  {
    viewId: 'sys-embedding',
    endpoint: '/api/system/embedding',
    method: 'GET',
    fields: [
      { name: 'model', type: 'string', note: '임베딩 모델' },
      { name: 'dimension', type: 'number', note: '차원' },
      { name: 'version', type: 'string', note: '버전' },
    ],
  },
  {
    viewId: 'field-survey',
    endpoint: '/api/surveys/responses',
    method: 'GET',
    fields: [
      { name: 'responseId', type: 'string', note: '응답 식별자' },
      { name: 'sessionId', type: 'string', note: '어느 세션의 응답인지 잇는 열쇠' },
      { name: 'perceivedFit', type: 'number (1–5)', note: '인지된 적합성' },
      { name: 'perceivedTrust', type: 'number (1–5)', note: '인지된 신뢰도' },
      { name: 'explanationClarity', type: 'number (1–5)', note: '설명 이해도' },
      { name: 'satisfaction', type: 'number (1–5)', note: '추천 만족도' },
      { name: 'visitIntention', type: 'number (1–5)', note: '방문의도' },
    ],
  },
];

/** 화면 id 로 그 화면이 기다리는 계약을 찾는다. 없으면 undefined. */
export function findContract(viewId: string): BackendContract | undefined {
  return BACKEND_CONTRACTS.find((contract) => contract.viewId === viewId);
}
