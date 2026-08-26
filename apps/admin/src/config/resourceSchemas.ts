import type { TemplateVariable } from '@namdo-prism/core/ui';
import { COMPANIONS, COMPANION_LABELS } from '@namdo-prism/core/domain';

/**
 * 등록·수정·삭제 화면의 자료 정의.
 *
 * ── 왜 스키마로 두는가 ─────────────────────────────────────────────
 * 관리 화면들은 «목록 → 등록 → 수정 → 삭제»라는 같은 뼈대를 쓰고,
 * 다른 것은 어떤 칸을 갖느냐뿐이다. 그 차이만 여기 적고 그리기는
 * `ResourceManager` 하나가 맡는다 — 화면이 늘어도 고칠 곳은 이 파일뿐이다.
 *
 * ── 왜 초기 자료를 넣어 두는가 ─────────────────────────────────────
 * 빈 표로 시작하면 «무엇을 넣는 화면인지»가 보이지 않는다.
 * 다만 이 자료는 **관측된 값이 아니라 형식을 보여 주는 예시**이므로,
 * 실측치를 다루는 화면(지표·로그)에는 절대 넣지 않는다.
 * 여기 있는 것들은 모두 사람이 정해서 넣는 설정값이라 예시가 곧 초기 설정이 된다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 저장되는 한 줄. 화면마다 칸이 달라 열린 형태로 둔다. */
export interface ResourceRecord {
  id: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export type ResourceFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'toggle';

export interface ResourceField {
  key: string;
  label: string;
  kind: ResourceFieldKind;
  /** 입력칸 아래 한 줄. 무엇을 넣는 칸인지 알린다. */
  hint?: string;
  placeholder?: string;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  unit?: string;
  rows?: number;
  defaultValue?: string | number | boolean;
  /** 토글이 켜짐/꺼짐일 때 표에 적을 말. 「사용/중지」가 맞지 않는 칸이 있다. */
  onLabel?: string;
  offLabel?: string;
  /**
   * 본문에 끼워 넣을 수 있는 변수. 주면 여러 줄 입력칸이 «변수 넣기» 줄을 함께 그린다.
   * 손으로 적다 한 글자 틀리면 실행 시점에 조용히 안 채워지므로, 눌러서 넣게 한다.
   */
  variables?: readonly TemplateVariable[];
  /** 있으면 목록 표에도 이 칸을 보인다. 없으면 등록·수정 창에서만 다룬다. */
  column?: { header?: string; numeric?: boolean; width?: string };
}

export interface ResourceSchema {
  /** 저장 키이자 내보내는 파일 이름. */
  id: string;
  title: string;
  description: string;
  /** 「○○ 등록」처럼 버튼에 들어갈 이름. */
  singular: string;
  formDescription: string;
  searchPlaceholder: string;
  /** 삭제 확인 문구에 쓸 대표 칸. */
  titleField: string;
  fields: readonly ResourceField[];
  seed: readonly ResourceRecord[];
  /**
   * 등록을 창에서 받을지.
   *
   * 칸이 몇 개뿐인 자료는 화면을 통째로 바꿔 가며 적을 만큼의 일이 아니다.
   * 목록을 그대로 두고 창에서 받으면, 적고 나서 방금 넣은 줄이 바로 눈에 들어온다.
   * 칸이 많거나 곁들여 볼 것이 있는 자료(권역의 지수 같은)는 상세 화면이 낫다.
   */
  createInSheet?: boolean;
}

/** 라벨 사전을 선택지로 바꾼다. 문구의 원본은 언제나 도메인 라벨이다. */
function toOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** id 를 만든다. 같은 순간에 두 번 눌러도 겹치지 않도록 뒤에 무작위를 붙인다. */
function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newIdFor(schemaId: string): string {
  return makeId(schemaId);
}

/* ────────────────────────────────────────────────────────────────
   12.2 프롬프트 템플릿
   ──────────────────────────────────────────────────────────────── */

const PROMPT_PURPOSES = [
  { value: 'recommend', label: '관광지 추천' },
  { value: 'rationale', label: '추천 근거 설명' },
  { value: 'replan', label: '일정 재구성' },
  { value: 'answer', label: '질의 응답' },
  { value: 'title', label: '일정 제목 생성' },
];

/**
 * 실행 시점에 값이 채워지는 자리.
 *
 * 이 목록이 곧 «백엔드가 프롬프트에 넣어 줘야 하는 것»의 계약이다.
 * 여기 없는 이름을 본문에 적으면 채울 값이 없으므로, 편집칸이 그 자리에서 알린다.
 */
const PROMPT_VARIABLES: readonly TemplateVariable[] = [
  { token: 'documents', label: '공식문서', hint: '검색으로 회수한 문서 본문과 갱신일' },
  { token: 'question', label: '질문', hint: '관람객이 고른 조건에서 만든 질의' },
  { token: 'conditions', label: '여행조건', hint: '동행·기간·관심사·이동수단' },
  { token: 'candidates', label: '추천 후보', hint: '점수 상위 관광지와 그 점수' },
  { token: 'itinerary', label: '일정', hint: '지금 짜인 방문 순서' },
  { token: 'today', label: '기준일', hint: '휴무일·운영시간 판정에 쓰는 날짜' },
];

const PROMPT_SCHEMA: ResourceSchema = {
  id: 'sys-prompt',
  title: '프롬프트 템플릿',
  description:
    '답변 형식이 바뀌면 출처 제시율과 근거 일치율이 함께 흔들립니다. 판본을 남겨 되돌릴 수 있게 합니다. 아직 답변을 만드는 모델이 없어, 여기 저장한 문구는 보관만 되고 실행되지 않습니다.',
  singular: '템플릿',
  createInSheet: true,
  formDescription: '본문의 {{중괄호}} 자리에 실행 시점의 값이 채워집니다.',
  searchPlaceholder: '템플릿명·본문 검색',
  titleField: 'name',
  fields: [
    {
      key: 'name',
      label: '템플릿명',
      kind: 'text',
      required: true,
      placeholder: '예: 추천 근거 설명 v2',
      column: { header: '템플릿명' },
    },
    {
      key: 'purpose',
      label: '용도',
      kind: 'select',
      required: true,
      options: PROMPT_PURPOSES,
      hint: '어느 단계에서 쓰이는 프롬프트인지',
      column: { header: '용도', width: '10rem' },
    },
    {
      key: 'version',
      label: '판본',
      kind: 'number',
      min: 1,
      defaultValue: 1,
      hint: '본문을 고칠 때마다 올립니다',
      column: { header: '판본', numeric: true, width: '5rem' },
    },
    {
      key: 'active',
      label: '사용 여부',
      kind: 'toggle',
      defaultValue: true,
      hint: '끄면 이 템플릿은 호출되지 않습니다',
      column: { header: '상태', width: '6rem' },
    },
    {
      key: 'body',
      label: '본문',
      kind: 'textarea',
      required: true,
      rows: 8,
      variables: PROMPT_VARIABLES,
      placeholder: '당신은 광주·전남 관광 안내자입니다. 아래 공식문서만 근거로 삼아…',
    },
    {
      key: 'note',
      label: '메모',
      kind: 'textarea',
      rows: 3,
      hint: '왜 이렇게 고쳤는지. 나중에 판본을 되돌릴 때의 판단 근거가 됩니다',
    },
  ],
  seed: [
    {
      id: 'sys-prompt_base',
      name: '추천 근거 설명 기본',
      purpose: 'rationale',
      version: 1,
      active: true,
      body:
        '당신은 광주·전남 관광 안내자입니다.\n' +
        '아래 공식문서에 적힌 내용만 근거로 삼아 답하세요.\n' +
        '문서에 없는 내용은 «공식 자료에서 확인되지 않았습니다»라고 답합니다.\n' +
        '답변 끝에 근거로 삼은 문서명과 갱신일을 반드시 붙입니다.\n\n' +
        '[공식문서]\n{{documents}}\n\n[질문]\n{{question}}',
      note: '출처 제시율을 위해 문서명·갱신일 표기를 강제하는 문장을 넣어 둔 판본.',
    },
  ],
};

/**
 * 고를 수 있는 모델.
 *
 * 손으로 적게 두면 «claude-sonet-5» 같은 오타 하나로 호출이 통째로 실패하는데,
 * 화면에서는 멀쩡해 보인다. 부를 수 있는 이름은 정해져 있으므로 목록에서 고르게 한다.
 * 모델이 늘거나 이름이 바뀌면 여기만 고친다.
 */
const MODEL_OPTIONS = [
  { value: 'claude-opus-5', label: 'Claude Opus 5 — 가장 정확, 가장 느림' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — 정확도와 속도의 균형' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — 가장 빠름' },
];

export const MODEL_SETTINGS: ResourceSchema = {
  id: 'sys-model',
  title: 'AI 모델 설정',
  description: '답변을 만들 때 쓰는 모델과 호출 방식입니다. 아직 모델을 붙이지 않아 지금은 저장만 됩니다.',
  singular: '모델 설정',
  formDescription: '',
  searchPlaceholder: '',
  titleField: 'model',
  fields: [
    {
      key: 'model',
      label: '사용 모델',
      kind: 'select',
      required: true,
      options: MODEL_OPTIONS,
      hint: '빠른 모델일수록 응답이 이르고, 큰 모델일수록 설명이 촘촘합니다',
    },
    {
      key: 'temperature',
      // 저장 열쇠는 `temperature` 그대로 둔다 — 모델을 부를 때 넘기는 이름이라 바꾸면 안 붙는다.
      label: '응답 변동성',
      kind: 'number',
      min: 0,
      max: 2,
      defaultValue: 0.2,
      hint: '0 에 가까울수록 매번 같은 답이 나옵니다 (모델의 temperature 값)',
    },
    {
      key: 'maxTokens',
      label: '최대 토큰',
      kind: 'number',
      min: 256,
      defaultValue: 2048,
      hint: '답변이 끝까지 나오지 않고 잘리면 올려 주세요',
    },
    {
      key: 'timeoutSeconds',
      label: '응답 제한시간',
      kind: 'number',
      min: 1,
      unit: '초',
      defaultValue: 7,
      hint: '이 시간을 넘기면 기다리지 않습니다. 키오스크 목표는 7초입니다',
    },
    {
      key: 'retryOnTimeout',
      label: '시간을 넘기면 다시 시도',
      kind: 'toggle',
      defaultValue: false,
      onLabel: '다시 시도',
      offLabel: '바로 실패 처리',
      hint: '켜면 한 번 더 부르지만 관람객은 그만큼 더 기다립니다',
    },
  ],
  seed: [
    {
      id: 'sys-model_current',
      model: 'claude-sonnet-5',
      temperature: 0.2,
      maxTokens: 2048,
      timeoutSeconds: 7,
      retryOnTimeout: false,
    },
  ],
};


export const SEARCH_SETTINGS: ResourceSchema = {
  id: 'sys-search',
  title: '검색 판정 기준',
  description: '이 값이 출처 제시율과 근거 일치율을 직접 좌우합니다.',
  singular: '검색 설정',
  formDescription: '',
  searchPlaceholder: '',
  titleField: 'id',
  fields: [
    /*
      켜고 끄는 것이 맨 위에 온다.
      나머지는 «얼마나»를 정하는 숫자인데, 이 하나는 «할지 말지»를 정한다.
      끄면 아래 숫자들이 무슨 값이든 근거 없는 답변이 나갈 수 있으므로 먼저 본다.
    */
    {
      key: 'requireOfficialSource',
      label: '공식문서 근거 필수',
      kind: 'toggle',
      defaultValue: true,
      onLabel: '필수',
      offLabel: '선택',
      hint: '끄면 근거가 없어도 답을 내보냅니다',
    },
    {
      key: 'minSimilarity',
      label: '후보로 볼 최소 점수',
      kind: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.05,
      hint: '이보다 낮게 나온 문서는 아예 쓰지 않습니다',
    },
    {
      key: 'topK',
      label: '한 번에 찾아올 문서 수',
      kind: 'number',
      min: 1,
      unit: '건',
      defaultValue: 10,
      hint: '많이 가져올수록 후보는 넓지만 엉뚱한 것도 섞입니다',
    },
    {
      key: 'hitRank',
      label: '정답으로 볼 순위',
      kind: 'number',
      min: 1,
      unit: '위',
      defaultValue: 5,
      hint: '이 순위 안에 들어야 «근거를 찾았다»고 봅니다',
    },
    {
      key: 'rerankThreshold',
      label: '다시 찾아볼 점수',
      kind: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.2,
      hint: '가장 잘 맞은 문서가 이보다 낮으면 질문을 바꿔 다시 찾습니다',
    },
  ],
  seed: [
    {
      id: 'sys-search_current',
      minSimilarity: 0.05,
      topK: 10,
      hitRank: 5,
      rerankThreshold: 0.2,
      requireOfficialSource: true,
    },
  ],
};

/* ────────────────────────────────────────────────────────────────
   2.3 관광지 관계 관리
   ──────────────────────────────────────────────────────────────── */


/* ────────────────────────────────────────────────────────────────
   4.1 추천 모델 설정 — 값이 한 벌뿐인 설정
   ──────────────────────────────────────────────────────────────── */

export const RECOMMENDER_SETTINGS: ResourceSchema = {
  id: 'rec-model',
  title: '추천 구성',
  description: '후보를 몇 개까지 볼지, 어디서 자를지 정합니다. 배점은 추천 가중치 화면에서 다룹니다.',
  singular: '추천 설정',
  formDescription: '',
  searchPlaceholder: '',
  titleField: 'algorithm',
  fields: [
    {
      key: 'algorithm',
      label: '추천 방식',
      kind: 'select',
      required: true,
      options: [
        { value: 'weighted', label: '가중합 점수' },
        { value: 'weightedDiverse', label: '가중합 + 다양성 보정' },
        { value: 'pairwise', label: '쌍대비교' },
      ],
      defaultValue: 'weightedDiverse',
      hint: '다양성 보정을 끄면 비슷한 자원이 몰릴 수 있습니다',
    },
    {
      key: 'candidateCount',
      label: '후보 수',
      kind: 'number',
      min: 5,
      unit: '곳',
      defaultValue: 40,
      hint: '점수를 매길 관광지 개수. 늘리면 정확해지고 느려집니다',
    },
    {
      key: 'diversityFactor',
      label: '다양성 계수',
      kind: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.3,
      hint: '같은 유형이 이어질 때 점수를 깎는 정도',
    },
    {
      key: 'trustFloor',
      label: '신뢰도 제외 임계값',
      kind: 'number',
      min: 0,
      max: 100,
      unit: '점',
      defaultValue: 55,
      hint: '이 점수 미만은 추천하지 않습니다 (제안서 8.5)',
    },
    {
      key: 'maxPerRegion',
      label: '한 지역 최대 방문지',
      kind: 'number',
      min: 1,
      unit: '곳',
      defaultValue: 3,
      hint: '한 곳에 몰리면 초광역이라는 이름이 무색해집니다',
    },
    {
      key: 'explainEveryStop',
      label: '방문지마다 근거 제시',
      kind: 'toggle',
      defaultValue: true,
      onLabel: '전부',
      offLabel: '요청 시',
      hint: '끄면 출처 제시율이 떨어집니다',
    },
  ],
  seed: [
    {
      id: 'rec-model_current',
      algorithm: 'weightedDiverse',
      candidateCount: 40,
      diversityFactor: 0.3,
      trustFloor: 55,
      maxPerRegion: 3,
      explainEveryStop: true,
    },
  ],
};

/* ────────────────────────────────────────────────────────────────
   2.3 지역/권역 관리
   ──────────────────────────────────────────────────────────────── */

const ZONE_SCHEMA: ResourceSchema = {
  id: 'poi-region',
  title: '권역',
  description:
    '시군구를 묶어 부르는 단위입니다. 「담양권」처럼 묶어 두면 추천이 지역을 넘나들 때 무엇과 무엇을 이었는지 말로 설명할 수 있습니다.',
  singular: '권역',
  formDescription: '한 시군구가 여러 권역에 들어가도 됩니다 — 실제로 걸쳐 있는 곳이 있습니다.',
  searchPlaceholder: '권역명·시군구 검색',
  titleField: 'name',
  fields: [
    {
      key: 'name',
      label: '권역명',
      kind: 'text',
      required: true,
      placeholder: '예: 담양·장성 죽녹권',
      column: { header: '권역명' },
    },
    {
      key: 'region',
      label: '소속 지역',
      kind: 'select',
      required: true,
      options: [
        { value: 'gwangju', label: '광주' },
        { value: 'jeonnam', label: '전남' },
        { value: 'both', label: '광주·전남 걸침' },
      ],
      column: { header: '지역', width: '9rem' },
    },
    {
      key: 'districts',
      label: '포함 시군구',
      kind: 'text',
      required: true,
      placeholder: '전남 담양군 · 전남 화순군',
      /*
        관광지 자료의 `district` 값과 **글자가 똑같아야** 집계에 잡힌다.
        그 값은 「전남 담양군」처럼 지역 접두어를 포함하므로 접두어까지 적어야 한다.
        「담양군」만 적으면 조용히 0회로 집계된다.
      */
      hint: '관광지 자료와 같은 표기로 적습니다 — 「전남 담양군」처럼 지역까지. 가운뎃점으로 나눕니다',
      column: { header: '포함 시군구' },
    },
    {
      key: 'theme',
      label: '권역 성격',
      kind: 'text',
      placeholder: '예: 대숲과 정원',
      column: { header: '성격', width: '11rem' },
    },
    {
      key: 'note',
      label: '설명',
      kind: 'textarea',
      rows: 3,
      hint: '왜 이 시군구들을 하나로 묶는지',
    },
  ],
  seed: [
    {
      id: 'poi-region_coast',
      name: '남해안 바다권',
      region: 'jeonnam',
      districts: '전남 여수시 · 전남 목포시 · 전남 신안군',
      theme: '바다와 섬',
      note: '이동시간이 길어 1박 이상 일정에서만 묶인다.',
    },
    {
      id: 'poi-region_damyang',
      name: '담양·화순 정원권',
      region: 'jeonnam',
      districts: '전남 담양군 · 전남 화순군',
      theme: '대숲과 정원',
      note: '평지 산책로가 이어져 보행부담이 낮다. 부모님 동행 일정에서 자주 묶인다.',
    },
    {
      id: 'poi-region_gwangju-core',
      name: '광주 도심권',
      region: 'gwangju',
      districts: '광주 동구 · 광주 남구 · 광주 북구',
      theme: '문화·예술과 미식',
      note: '도보와 시내버스로 이어져 당일 일정의 기본 축이 된다.',
    },
  ],
};

/* ────────────────────────────────────────────────────────────────
   6.4 A/B 테스트
   ──────────────────────────────────────────────────────────────── */


/* ────────────────────────────────────────────────────────────────
   9.4 만족도 조사
   ──────────────────────────────────────────────────────────────── */

const SURVEY_SCHEMA: ResourceSchema = {
  id: 'field-survey',
  title: '만족도 응답',
  description:
    '설명가능성이 실제로 신뢰로 이어졌는지 묻는 문항입니다. 현장에서 받은 응답을 그대로 옮겨 적습니다.',
  singular: '응답',
  formDescription: '다섯 문항 모두 1~7점 척도입니다. 개인을 식별할 수 있는 값은 적지 않습니다.',
  searchPlaceholder: '응답 번호·메모 검색',
  titleField: 'respondent',
  fields: [
    {
      key: 'respondent',
      label: '응답 번호',
      kind: 'text',
      required: true,
      placeholder: '예: R-001',
      hint: '이름이 아니라 번호만 적습니다',
      column: { header: '응답 번호', width: '9rem' },
    },
    {
      key: 'companion',
      label: '동행 유형',
      kind: 'select',
      options: toOptions(COMPANIONS, COMPANION_LABELS),
      column: { header: '동행', width: '9rem' },
    },
    /*
      문항 순서는 연구 모형(`researchModel.ts`)이 정한 번호를 따른다 —
      적합성(1) · 설명 이해도(2) · 신뢰도(3) 다음에 만족도와 방문 의도가 온다.
      현장에서 종이 설문을 옮겨 적는 사람이 위에서부터 그대로 읽어 내려갈 수 있어야 한다.
    */
    {
      key: 'fit',
      label: '인지된 적합성',
      kind: 'number',
      required: true,
      min: 1,
      max: 7,
      unit: '점',
      hint: '추천받은 일정이 자기 조건에 맞았다고 느낀 정도',
      column: { header: '적합성', numeric: true, width: '7rem' },
    },
    {
      key: 'clarity',
      label: '설명 이해도',
      kind: 'number',
      required: true,
      min: 1,
      max: 7,
      unit: '점',
      hint: '왜 이 관광지가 뽑혔는지 설명을 이해한 정도',
      column: { header: '이해도', numeric: true, width: '7rem' },
    },
    {
      key: 'trust',
      label: '인지된 신뢰도',
      kind: 'number',
      required: true,
      min: 1,
      max: 7,
      unit: '점',
      hint: '추천 근거를 보고 믿을 만하다고 느꼈는가',
      column: { header: '신뢰도', numeric: true, width: '7rem' },
    },
    {
      key: 'satisfaction',
      label: '만족도',
      kind: 'number',
      required: true,
      min: 1,
      max: 7,
      unit: '점',
      column: { header: '만족도', numeric: true, width: '7rem' },
    },
    {
      key: 'intent',
      label: '방문 의도',
      kind: 'number',
      required: true,
      min: 1,
      max: 7,
      unit: '점',
      hint: '실제로 가 볼 생각이 드는가',
      column: { header: '방문 의도', numeric: true, width: '8rem' },
    },
    {
      key: 'comment',
      label: '자유 응답',
      kind: 'textarea',
      rows: 3,
      hint: '점수로 안 잡히는 것이 여기서 나옵니다',
    },
  ],
  seed: [],
};

export const RESOURCE_SCHEMAS: Record<string, ResourceSchema> = {
  'sys-prompt': PROMPT_SCHEMA,
  'poi-region': ZONE_SCHEMA,
  'field-survey': SURVEY_SCHEMA,
};

/**
 * 값이 한 벌뿐인 설정. 목록·등록·삭제 대신 폼 하나로 다룬다.
 * 여러 벌 중 하나를 고르는 자료가 아닌데 목록을 두면 잘못된 인상을 준다.
 */
export const SETTINGS_SCHEMAS: Record<string, ResourceSchema> = {
  'sys-model': MODEL_SETTINGS,
  'sys-search': SEARCH_SETTINGS,
  'rec-model': RECOMMENDER_SETTINGS,
};

export function findSettingsSchema(viewId: string): ResourceSchema | undefined {
  return SETTINGS_SCHEMAS[viewId];
}

export function findResourceSchema(viewId: string): ResourceSchema | undefined {
  return RESOURCE_SCHEMAS[viewId];
}
