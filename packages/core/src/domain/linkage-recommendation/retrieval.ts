/**
 * 특허 후보 제1안 — 처리단계 4) 공식 관광문서에서 후보 관광지를 검색하는 단계.
 *
 * ── 구현 범위에 대한 명시 ──────────────────────────────────────────
 * 본 파일은 프런트엔드 오프라인 시연모드용 **어휘 기반(lexical) 검색기**다.
 * 운영 시스템의 임베딩 + Vector DB 검색을 대체하지 않으며, 대체하려는 것도 아니다.
 * 다만 반환 타입(`RetrievalResult`)과 점수 의미(0–1 유사도), 로그 필드는
 * 백엔드 검색기와 동일하게 맞추어 두었다. 따라서 백엔드가 붙을 때
 * 이 모듈만 교체하면 화면·로그·검수 지표는 그대로 유지된다.
 * ──────────────────────────────────────────────────────────────────
 */

import { getAttraction } from '../../data/attractions';
import { OFFICIAL_DOCUMENTS } from '../../data/officialDocuments';
import { clamp } from '../../lib/number';
import {
  COMPANION_LABELS,
  DURATION_LABELS,
  INTEREST_LABELS,
  SPECIAL_NEED_LABELS,
  TRANSPORT_LABELS,
} from '../labels';
import type { OfficialDocument } from '../types/catalog';
import type { RetrievalQuery, RetrievalResult, RetrievedDocument } from '../types/evidence';
import type { TravelConditions } from '../types/travel';

/** 필드별 매칭 가중치. 키워드 일치가 본문 일치보다 강한 신호다. */
const FIELD_MATCH_WEIGHT = {
  keyword: 1,
  title: 0.7,
  excerpt: 0.4,
} as const;

/** 결과로 돌려줄 최대 문서 수. 연구자 화면 표에 한 화면으로 들어가는 분량. */
const MAX_RESULTS = 12;

/** 한국어 조사·어미. 어휘 매칭 전에 잘라 낸다. */
const TRAILING_PARTICLES = [
  '에서까지',
  '으로는',
  '에서는',
  '까지',
  '부터',
  '에서',
  '으로',
  '이나',
  '와는',
  '과는',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '도',
  '로',
  '와',
  '과',
];

/** 검색에 기여하지 않는 의문형 어휘. */
const STOP_WORDS = new Set([
  '어떻게',
  '어떤',
  '얼마나',
  '얼마',
  '무엇',
  '언제',
  '있나요',
  '되나요',
  '인가요',
  '있어요',
  '알려주세요',
  '가나요',
  '하나요',
  '많은가요',
  '힘든가요',
  '건널',
  '수',
  '있는',
  '가는',
  '까지',
  '정도',
]);

function stripParticle(token: string): string {
  if (token.length <= 2) return token;
  for (const particle of TRAILING_PARTICLES) {
    if (token.length > particle.length + 1 && token.endsWith(particle)) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

/** 자연어 문장을 검색어 목록으로 바꾼다. 결과는 연구자 화면에 그대로 노출된다. */
export function tokenize(text: string): string[] {
  const rawTokens = text
    .replaceAll(/[?!.,·()[\]「」'"—–]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const terms: string[] = [];
  for (const raw of rawTokens) {
    if (STOP_WORDS.has(raw)) continue;
    const stripped = stripParticle(raw);
    if (stripped.length < 2 || STOP_WORDS.has(stripped)) continue;
    if (!terms.includes(stripped)) terms.push(stripped);
  }
  return terms;
}

/**
 * 두 어휘의 일치 강도 (0–1).
 *
 * 단순히 "서로를 포함하면 일치"로 처리하면 '국립광주박물관'이라는 질의어가
 * 지역 키워드 '광주' 와 만점으로 맞아떨어져, 광주에 있는 아무 문서나 1위로 올라온다.
 * 그래서 포함 관계일 때는 길이 비율만큼만 인정한다 — 짧고 일반적인 키워드일수록 약한 신호다.
 */
function matchStrength(term: string, candidate: string): number {
  if (term === candidate) return 1;
  if (!candidate.includes(term) && !term.includes(candidate)) return 0;
  return Math.min(term.length, candidate.length) / Math.max(term.length, candidate.length);
}

/** 이 강도에 못 미치는 부분일치는 잡음으로 보고 버린다. */
const MINIMUM_MATCH_STRENGTH = 0.34;

/**
 * 색인 엔트리. 문서가 직접 적어 둔 키워드에 더해,
 * 그 문서가 다루는 관광지의 이름·소재지·지역명을 파생 키워드로 붙인다.
 * 문서마다 지역명을 일일이 중복 기재하지 않아도 지역 단위 질의가 회수되게 하기 위함이며,
 * 관광지 데이터를 교체하면 색인도 함께 갱신된다.
 */
export interface IndexedDocument {
  document: OfficialDocument;
  keywords: string[];
}

const REGION_TERMS = { gwangju: ['광주'], jeonnam: ['전남', '전라남도'] } as const;

/**
 * 검색 색인을 만든다.
 *
 * 문서에 적힌 키워드에 더해, 그 문서가 근거로 삼는 관광지의 이름·시군구·지역어까지
 * 넣는다 — «담양 죽녹원 입장료» 같은 질의가 문서 제목에 그 낱말이 없어도 걸리게 하기 위함이다.
 *
 * 밖으로 내보내는 이유는 어드민이 «지금 색인에 무엇이 들어 있는가»를 보여 주기 위해서다.
 * 화면이 같은 계산을 베껴 쓰면 엔진과 조용히 어긋나므로 여기 것을 그대로 쓴다.
 */
export function buildDocumentIndex(corpus: readonly OfficialDocument[]): IndexedDocument[] {
  return corpus.map((document) => {
    const derived = new Set(document.keywords);
    for (const attractionId of document.coversAttractionIds) {
      const attraction = getAttraction(attractionId);
      if (!attraction) continue;
      derived.add(attraction.name);
      derived.add(attraction.district);
      for (const term of REGION_TERMS[attraction.region]) derived.add(term);
    }
    return { document, keywords: [...derived] };
  });
}

const DEFAULT_INDEX = buildDocumentIndex(OFFICIAL_DOCUMENTS);

function scoreEntry(
  entry: IndexedDocument,
  terms: string[],
): { similarity: number; matchedTerms: string[] } {
  if (terms.length === 0) return { similarity: 0, matchedTerms: [] };

  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of terms) {
    const keywordStrength = Math.max(
      0,
      ...entry.keywords.map((keyword) => matchStrength(term, keyword)),
    );

    // 제목·본문은 문장이므로 길이 비율이 무의미하다. 포함 여부만 보고 낮은 가중치를 준다.
    const best = Math.max(
      keywordStrength >= MINIMUM_MATCH_STRENGTH ? FIELD_MATCH_WEIGHT.keyword * keywordStrength : 0,
      entry.document.title.includes(term) ? FIELD_MATCH_WEIGHT.title : 0,
      entry.document.excerpt.includes(term) ? FIELD_MATCH_WEIGHT.excerpt : 0,
    );

    if (best > 0) {
      score += best;
      matchedTerms.push(term);
    }
  }

  return { similarity: clamp(score / terms.length, 0, 1), matchedTerms };
}

/**
 * 검색 판정 기준.
 *
 * 어드민의 「검색 설정」에서 고치는 값이 그대로 들어온다.
 * 기본값을 함수 쪽에 두는 이유 — 설정을 안 넘기는 곳(키오스크·모바일)도
 * 같은 기준으로 돌아야 한다. 어드민에서만 다르게 돌면 검수 결과를 믿을 수 없다.
 */
export interface RetrievalSettings {
  /** 이 점수 아래는 아예 회수하지 않는다. */
  minSimilarity?: number;
  /** 회수 개수. 몇 건까지 후보로 둘지. */
  limit?: number;
}

/** 검색어 목록으로 공식문서 색인을 조회한다. */
export function searchDocuments(
  terms: string[],
  corpus?: readonly OfficialDocument[],
  settings?: RetrievalSettings,
): RetrievedDocument[] {
  const index = corpus ? buildDocumentIndex(corpus) : DEFAULT_INDEX;
  const limit = settings?.limit ?? MAX_RESULTS;
  // 0 을 넘겨도 «걸러 내지 않음»이 되도록 0 초과만 남기는 기본 규칙은 유지한다.
  const floor = Math.max(settings?.minSimilarity ?? 0, 0);
  return index
    .map((entry) => ({ entry, ...scoreEntry(entry, terms) }))
    .filter((result) => result.similarity > 0 && result.similarity >= floor)
    .sort(
      (a, b) =>
        b.similarity - a.similarity || a.entry.document.id.localeCompare(b.entry.document.id),
    )
    .slice(0, limit)
    .map((result, position) => ({
      documentId: result.entry.document.id,
      similarity: result.similarity,
      matchedTerms: result.matchedTerms,
      rank: position + 1,
    }));
}

/** 여행조건을 사람이 읽을 수 있는 검색질의 문장으로 조립한다. */
export function buildQuery(conditions: TravelConditions): RetrievalQuery {
  const interestPart =
    conditions.interests.length > 0
      ? conditions.interests.map((interest) => INTEREST_LABELS[interest]).join(' ')
      : '광주 전남 대표 관광지';
  const needsPart = conditions.specialNeeds
    .filter((need) => need !== 'none')
    .map((need) => SPECIAL_NEED_LABELS[need])
    .join(' ');

  const text = [
    '광주 전남',
    interestPart,
    COMPANION_LABELS[conditions.companion],
    DURATION_LABELS[conditions.duration],
    TRANSPORT_LABELS[conditions.transport],
    needsPart,
    '운영시간 요금 접근성',
  ]
    .filter(Boolean)
    .join(' ');

  return { text, terms: tokenize(text) };
}

/** 여행조건 기반 검색을 수행한다. 소요시간은 로그의 응답시간 산정에 합산된다. */
export function retrieveForConditions(
  conditions: TravelConditions,
  corpus?: readonly OfficialDocument[],
  settings?: RetrievalSettings,
): RetrievalResult {
  const startedAt = performance.now();
  const query = buildQuery(conditions);
  const documents = searchDocuments(query.terms, corpus, settings);
  return {
    query,
    documents,
    corpusSize: (corpus ?? OFFICIAL_DOCUMENTS).length,
    elapsedMs: performance.now() - startedAt,
  };
}

/** 기준 평가질문 검수용 단건 검색. 어드민의 검수 화면이 사용한다. */
export function retrieveForQuestion(
  question: string,
  corpus?: readonly OfficialDocument[],
  settings?: RetrievalSettings,
): RetrievalResult {
  const startedAt = performance.now();
  const terms = tokenize(question);
  const documents = searchDocuments(terms, corpus, settings);
  return {
    query: { text: question, terms },
    documents,
    corpusSize: (corpus ?? OFFICIAL_DOCUMENTS).length,
    elapsedMs: performance.now() - startedAt,
  };
}
