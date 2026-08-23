/**
 * 기준 평가질문 32개.
 *
 * 제안서 17.2 검수기준("기준 평가질문 30개 이상", "출처 제시율 90% 이상",
 * "답변과 근거 일치율 85% 이상")과 피드백 4장 검수 게이트를 자동 판정하기 위한 데이터셋이다.
 *
 * 어드민의 검수 화면이 이 목록을 그대로 실행해 검색 결과와 `expectedDocumentIds` 를 대조하고,
 * 출처 제시율·근거 일치율을 실측치로 계산한다. 즉 이 파일은 문서가 아니라 실행되는 검수 대상이다.
 */

export const BENCHMARK_CATEGORIES = [
  'openingHours',
  'fee',
  'access',
  'accessibility',
  'closure',
  'linkage',
] as const;
export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

export const BENCHMARK_CATEGORY_LABELS: Record<BenchmarkCategory, string> = {
  openingHours: '운영시간',
  fee: '이용요금',
  access: '교통·접근',
  accessibility: '무장애·접근성',
  closure: '휴무일',
  linkage: '광주·전남 연계',
};

export interface BenchmarkQuestion {
  id: string;
  question: string;
  category: BenchmarkCategory;
  /** 이 질문에 답하려면 반드시 검색되어야 하는 공식문서. 근거 일치율의 정답지다. */
  expectedDocumentIds: string[];
  /** 질문이 대상으로 하는 관광지. */
  targetAttractionIds: string[];
}

export const BENCHMARK_QUESTIONS: readonly BenchmarkQuestion[] = [
  {
    id: 'bq-01',
    question: '국립아시아문화전당 관람시간과 휴관일이 어떻게 되나요?',
    category: 'openingHours',
    expectedDocumentIds: ['doc-acc-01'],
    targetAttractionIds: ['acc'],
  },
  {
    id: 'bq-02',
    question: '국립광주박물관 관람료가 있나요?',
    category: 'fee',
    expectedDocumentIds: ['doc-museum-01'],
    targetAttractionIds: ['gwangju-museum'],
  },
  {
    id: 'bq-03',
    question: '광주송정역에서 1913송정역시장까지 어떻게 가나요?',
    category: 'access',
    expectedDocumentIds: ['doc-songjeong-01', 'doc-songjeong-02'],
    targetAttractionIds: ['songjeong-market'],
  },
  {
    id: 'bq-04',
    question: '담양 죽녹원 입장료는 얼마인가요?',
    category: 'fee',
    expectedDocumentIds: ['doc-juknokwon-01'],
    targetAttractionIds: ['juknokwon'],
  },
  {
    id: 'bq-05',
    question: '관방제림은 휠체어로 다닐 수 있나요?',
    category: 'accessibility',
    expectedDocumentIds: ['doc-gwanbang-01', 'doc-gwanbang-02'],
    targetAttractionIds: ['gwanbangjerim'],
  },
  {
    id: 'bq-06',
    question: '광주시립미술관은 언제 휴관하나요?',
    category: 'closure',
    expectedDocumentIds: ['doc-artmuseum-01'],
    targetAttractionIds: ['gwangju-art-museum'],
  },
  {
    id: 'bq-07',
    question: '광주에서 담양 관방제림까지 대중교통으로 얼마나 걸리나요?',
    category: 'linkage',
    expectedDocumentIds: ['doc-gwangjuho-02'],
    targetAttractionIds: ['gwangjuho', 'gwanbangjerim'],
  },
  {
    id: 'bq-08',
    question: '순천만국가정원 입장료와 운영시간을 알려주세요.',
    category: 'openingHours',
    expectedDocumentIds: ['doc-scgarden-01'],
    targetAttractionIds: ['suncheonbay-garden'],
  },
  {
    id: 'bq-09',
    question: '순천만국가정원에서 유모차를 빌릴 수 있나요?',
    category: 'accessibility',
    expectedDocumentIds: ['doc-scgarden-02'],
    targetAttractionIds: ['suncheonbay-garden'],
  },
  {
    id: 'bq-10',
    question: '순천만습지 용산전망대까지 얼마나 걸어야 하나요?',
    category: 'access',
    expectedDocumentIds: ['doc-scwetland-01'],
    targetAttractionIds: ['suncheonbay-wetland'],
  },
  {
    id: 'bq-11',
    question: '여수해상케이블카 요금이 얼마인가요?',
    category: 'fee',
    expectedDocumentIds: ['doc-yeosucc-01'],
    targetAttractionIds: ['yeosu-cablecar'],
  },
  {
    id: 'bq-12',
    question: '오동도는 입장료가 있나요?',
    category: 'fee',
    expectedDocumentIds: ['doc-odongdo-01'],
    targetAttractionIds: ['odongdo'],
  },
  {
    id: 'bq-13',
    question: '오동도 입구에서 섬까지 걸어가야 하나요?',
    category: 'access',
    expectedDocumentIds: ['doc-odongdo-01'],
    targetAttractionIds: ['odongdo'],
  },
  {
    id: 'bq-14',
    question: '목포 근대역사관 통합관람권 가격을 알려주세요.',
    category: 'fee',
    expectedDocumentIds: ['doc-mokpomodern-01'],
    targetAttractionIds: ['mokpo-modern'],
  },
  {
    id: 'bq-15',
    question: '목포해상케이블카 운행시간이 어떻게 되나요?',
    category: 'openingHours',
    expectedDocumentIds: ['doc-mokpocc-01'],
    targetAttractionIds: ['mokpo-cablecar'],
  },
  {
    id: 'bq-16',
    question: '목포역에서 근대역사문화공간까지 얼마나 걸리나요?',
    category: 'access',
    expectedDocumentIds: ['doc-mokpomodern-01', 'doc-mokpocc-02'],
    targetAttractionIds: ['mokpo-modern'],
  },
  {
    id: 'bq-17',
    question: '보성 녹차밭 전망대까지 계단이 많은가요?',
    category: 'accessibility',
    expectedDocumentIds: ['doc-boseong-01', 'doc-boseong-02'],
    targetAttractionIds: ['boseong-tea'],
  },
  {
    id: 'bq-18',
    question: '무등산 증심사까지 등산이 힘든가요?',
    category: 'access',
    expectedDocumentIds: ['doc-mudeungsan-01'],
    targetAttractionIds: ['mudeungsan'],
  },
  {
    id: 'bq-19',
    question: '무등산 증심사입구까지 가는 시내버스가 있나요?',
    category: 'access',
    expectedDocumentIds: ['doc-mudeungsan-02'],
    targetAttractionIds: ['mudeungsan'],
  },
  {
    id: 'bq-20',
    question: '광주호 호수생태원은 입장료가 있나요?',
    category: 'fee',
    expectedDocumentIds: ['doc-gwangjuho-01'],
    targetAttractionIds: ['gwangjuho'],
  },
  {
    id: 'bq-21',
    question: '메타세쿼이아길 개장시간을 알려주세요.',
    category: 'openingHours',
    expectedDocumentIds: ['doc-metasequoia-01'],
    targetAttractionIds: ['metasequoia'],
  },
  {
    id: 'bq-22',
    question: '퍼플섬 입장료가 면제되는 조건이 있나요?',
    category: 'fee',
    expectedDocumentIds: ['doc-purple-01'],
    targetAttractionIds: ['purple-island'],
  },
  {
    id: 'bq-23',
    question: '목포에서 퍼플섬까지 대중교통으로 갈 수 있나요?',
    category: 'access',
    expectedDocumentIds: ['doc-purple-02'],
    targetAttractionIds: ['purple-island'],
  },
  {
    id: 'bq-24',
    question: '화순 운주사는 광주에서 얼마나 걸리나요?',
    category: 'linkage',
    expectedDocumentIds: ['doc-unjusa-01'],
    targetAttractionIds: ['unjusa'],
  },
  {
    id: 'bq-25',
    question: '운주사 관람료를 알려주세요.',
    category: 'fee',
    expectedDocumentIds: ['doc-unjusa-01'],
    targetAttractionIds: ['unjusa'],
  },
  {
    id: 'bq-26',
    question: '양림동 근대역사문화마을은 관람료가 있나요?',
    category: 'fee',
    expectedDocumentIds: ['doc-yangnim-02'],
    targetAttractionIds: ['yangnim'],
  },
  {
    id: 'bq-27',
    question: '양림동 골목은 경사가 심한가요?',
    category: 'accessibility',
    expectedDocumentIds: ['doc-yangnim-01'],
    targetAttractionIds: ['yangnim'],
  },
  {
    id: 'bq-28',
    question: '국립광주박물관에 휠체어 대여가 되나요?',
    category: 'accessibility',
    expectedDocumentIds: ['doc-museum-01', 'doc-museum-02'],
    targetAttractionIds: ['gwangju-museum'],
  },
  {
    id: 'bq-29',
    question: '대인예술시장 야시장은 언제 열리나요?',
    category: 'openingHours',
    expectedDocumentIds: ['doc-daein-01'],
    targetAttractionIds: ['daein-market'],
  },
  {
    id: 'bq-30',
    question: '가우도 출렁다리는 몇 시까지 건널 수 있나요?',
    category: 'openingHours',
    expectedDocumentIds: ['doc-gaudo-01'],
    targetAttractionIds: ['gaudo'],
  },
  {
    id: 'bq-31',
    question: '담양 3대 관광지는 서로 얼마나 가까운가요?',
    category: 'linkage',
    expectedDocumentIds: ['doc-juknokwon-02'],
    targetAttractionIds: ['juknokwon', 'metasequoia', 'gwanbangjerim'],
  },
  {
    id: 'bq-32',
    question: '문화전당에서 대인예술시장까지 걸어갈 수 있나요?',
    category: 'access',
    expectedDocumentIds: ['doc-acc-02'],
    targetAttractionIds: ['acc', 'daein-market'],
  },
];
