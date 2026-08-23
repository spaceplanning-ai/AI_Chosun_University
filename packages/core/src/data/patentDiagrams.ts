/**
 * 특허 도면 정의 (제안서 9.4 도면 1~8 중 A단계 우선 6종).
 *
 * 피드백 5.3 — "제안서의 특허 도면 1~8 중 A단계에서는 전체구성·RAG·여행조건·연계지수·
 * 일정생성·일정재구성 도면에 필요한 실제 구현자료를 우선 제공합니다."
 *
 * 임계값·가중치를 문자열로 적지 않고 설정 상수에서 끌어온다.
 * 코드에서 기준을 바꾸면 도면의 숫자도 함께 바뀌므로, 명세서와 구현이 어긋날 수 없다.
 */

import {
  DOCUMENT_FRESHNESS_DAYS,
  LINKAGE_WEIGHTS,
  SCHEDULING,
  SCORE_WEIGHTS,
  TRUST_THRESHOLDS,
  TRUST_WEIGHTS,
} from '../config/scoring';
import {
  MAX_REPLACEMENTS_PER_REQUEST,
} from '../domain/minimal-change-replan/minimalChange';
import { MINIMUM_SIMILARITY } from '../domain/minimal-change-replan/replacementSearch';
import type { Diagram } from '../design/diagram';

export const PATENT_DIAGRAMS: readonly Diagram[] = [
  {
    number: 1,
    id: 'system-overview',
    title: '전체 시스템 구성도',
    caption: '키오스크 입력에서 모바일 승계까지의 전 과정. 굵은 흐름이 주 처리 경로.',
    nodes: [
      { id: 'input', kind: 'terminal', label: '여행조건 입력', detail: '동행자·기간·관심·이동수단·특별조건 5단계' },
      { id: 'vector', kind: 'process', label: '조건벡터 변환', detail: 'conditionVector.ts — 평가요소 10축' },
      { id: 'rag', kind: 'process', label: '공식 관광문서 검색', detail: 'retrieval.ts — 문서별 0–1 유사도' },
      {
        id: 'trust',
        kind: 'decision',
        label: `정보 신뢰도 판정 (기준 ${TRUST_THRESHOLDS.exclude}점)`,
        detail: 'trust.ts + eligibility.ts',
        branch: {
          label: '미달',
          node: { id: 'excluded', kind: 'reject', label: '추천 대상에서 제외', detail: '사유·단계·수치를 로그에 기록' },
        },
      },
      { id: 'linkage', kind: 'process', label: '초광역 관광연계지수 산출', detail: 'linkageIndex.ts — 구성요소 4종' },
      { id: 'score', kind: 'process', label: '다목적 추천점수 산출', detail: 'scoring.ts — 평가항목 7종' },
      { id: 'compose', kind: 'process', label: '여행일정 생성', detail: 'composer.ts — 운영시간·활동시간 검증 포함' },
      { id: 'rationale', kind: 'data', label: '추천 이유·근거문서 출력', detail: 'rationale.ts' },
      { id: 'replan', kind: 'process', label: '최소변경 재구성 (요청 시)', detail: 'minimal-change-replan/ — 제2안' },
      { id: 'handoff', kind: 'terminal', label: 'QR 모바일 승계', detail: '비식별 세션 토큰 + 관광지 id 만 전송' },
    ],
  },
  {
    number: 2,
    id: 'rag-pipeline',
    title: '관광정보 수집 및 검색 구축과정',
    caption: '공식문서 색인 구성과 질의 처리. 파생 키워드가 문서 단위 지역 질의를 회수한다.',
    nodes: [
      { id: 'collect', kind: 'terminal', label: '공식 관광문서 수집', detail: '지자체·공공기관·관광기관·운영시설' },
      { id: 'meta', kind: 'data', label: '메타데이터 기재', detail: '출처기관 · 기관유형 · 최종 갱신일 · 확인 정보항목' },
      { id: 'derive', kind: 'process', label: '파생 키워드 결합', detail: '대상 관광지의 이름·소재지·지역명을 색인에 추가' },
      { id: 'index', kind: 'data', label: '검색 색인 구성', detail: '앱 시작 시 원본에서 재생성 — 별도 갱신 명령 불필요' },
      { id: 'query', kind: 'process', label: '질의 생성 및 정규화', detail: '조사·의문형 어미 제거 후 검색어 추출' },
      {
        id: 'match',
        kind: 'decision',
        label: '어휘 일치 강도 판정',
        detail: '길이 비율 기반 — 짧고 일반적인 키워드는 약한 신호',
        branch: {
          label: '기준 미만',
          node: { id: 'drop', kind: 'reject', label: '잡음으로 폐기', detail: '부분일치 과다 회수 방지' },
        },
      },
      { id: 'rank', kind: 'data', label: '문서별 검색점수 산출', detail: '0–1 유사도 · 일치 검색어 목록' },
    ],
  },
  {
    number: 3,
    id: 'condition-vector',
    title: '사용자 여행조건 처리과정',
    caption: '선택형 입력을 연속값 벡터로 구조화. 이후 모든 점수 계산의 유일한 입력이 된다.',
    nodes: [
      { id: 'select', kind: 'terminal', label: '5단계 선택 입력', detail: '동행자 · 기간 · 관심분야 · 이동수단 · 특별조건' },
      { id: 'interest', kind: 'process', label: '관심유형 가중치 산출', detail: '명시 선택 + 동행유형 사전분포, 합계 1.0으로 정규화' },
      { id: 'constraint', kind: 'process', label: '제약 축 산출', detail: '보행 감내 한계 · 하루 활동시간 · 이동거리 축소 요구' },
      { id: 'care', kind: 'process', label: '배려 축 산출', detail: '고령자·아동 배려 필요도 · 비용 민감도 · 대중교통 의존도' },
      {
        id: 'merge',
        kind: 'decision',
        label: '동행자별 입력이 복수인가',
        detail: 'C단계 확장 — 다중 사용자 선호 입력',
        branch: {
          label: '복수',
          node: {
            id: 'group',
            kind: 'data',
            label: '조건벡터 병합',
            detail: '취향은 합산 정규화 · 제약은 가장 제약이 큰 참여자 기준',
          },
        },
      },
      { id: 'vector', kind: 'data', label: '조건벡터 확정', detail: '평가요소 10축 — 로그에 그대로 저장' },
    ],
  },
  {
    number: 4,
    id: 'linkage-index',
    title: '초광역 관광연계지수 산출과정',
    caption: '두 지역이 섞였다는 사실이 아니라 "어떻게 섞였는가"를 네 구성요소로 분해해 계산한다.',
    nodes: [
      { id: 'stops', kind: 'terminal', label: '방문 순서가 유지된 관광지 목록', detail: '순서가 이동 효율·연속성 계산에 쓰인다' },
      {
        id: 'balance',
        kind: 'process',
        label: `지역 균형 (가중치 ${LINKAGE_WEIGHTS.regionBalance})`,
        detail: '2 × min(광주 수, 전남 수) ÷ 전체 수 × 100',
      },
      {
        id: 'complement',
        kind: 'process',
        label: `자원 상보성 (가중치 ${LINKAGE_WEIGHTS.resourceComplementarity})`,
        detail: '(1 − 두 지역 관광유형 교집합 ÷ 합집합) × 100',
      },
      {
        id: 'corridor',
        kind: 'process',
        label: `이동 효율 (가중치 ${LINKAGE_WEIGHTS.corridorEfficiency})`,
        detail: '최소 경계횡단 수 ÷ 실제 경계횡단 수 × 100',
      },
      {
        id: 'narrative',
        kind: 'process',
        label: `여정 연속성 (가중치 ${LINKAGE_WEIGHTS.narrativeContinuity})`,
        detail: '인접·동일 시군으로 이어진 구간 수 ÷ 전체 구간 수 × 100',
      },
      {
        id: 'single',
        kind: 'decision',
        label: '한 지역만으로 구성되었는가',
        detail: '단일 지역이면 균형·상보성·이동 효율이 모두 0',
        branch: {
          label: '단일 지역',
          node: {
            id: 'correct',
            kind: 'data',
            label: '연계 보정 검토',
            detail: '연계지수가 실제로 상승할 때만 마지막 방문지를 교체',
          },
        },
      },
      { id: 'index', kind: 'data', label: '연계지수 확정 (0–100)', detail: '구성요소별 값과 산출 근거를 함께 저장' },
    ],
  },
  {
    number: 5,
    id: 'itinerary-generation',
    title: '여행일정 생성과정',
    caption: `후보를 고를 때마다 전체를 다시 채점한다. 하루 최대 ${SCHEDULING.maxStopsPerDay}곳.`,
    nodes: [
      { id: 'pool', kind: 'terminal', label: '조건을 통과한 후보 관광지', detail: '신뢰도·보행·접근성·관심분야 필터 통과' },
      {
        id: 'score',
        kind: 'process',
        label: '다목적 추천점수 산출',
        detail: `취향 ${SCORE_WEIGHTS.preferenceFit} · 이동 ${SCORE_WEIGHTS.travelFeasibility} · 연계 ${SCORE_WEIGHTS.regionLinkage} · 다양성 ${SCORE_WEIGHTS.resourceDiversity} · 접근성 ${SCORE_WEIGHTS.accessibilityFit} · 신뢰도 ${SCORE_WEIGHTS.informationTrust} · 분산 ${SCORE_WEIGHTS.regionalDispersion}`,
      },
      { id: 'pick', kind: 'process', label: '최상위 후보 선택', detail: '연계지수 한계기여를 포함한 가중합 1위' },
      {
        id: 'fit',
        kind: 'decision',
        label: '운영시간·활동시간 안에 배치 가능한가',
        detail: '도착 예정시각 + 체류시간 ≤ 운영 종료시각',
        branch: {
          label: '불가',
          node: {
            id: 'next',
            kind: 'reject',
            label: '사유 기록 후 차순위 후보로',
            detail: '운영시간 초과 · 활동시간 초과를 구분해 저장',
          },
        },
      },
      { id: 'place', kind: 'process', label: '일정에 배치하고 재채점', detail: '다양성·지역분산·연계 기여가 다음 선택에 반영된다' },
      { id: 'rationale', kind: 'data', label: '방문지별 추천 근거 생성', detail: '수치를 포함한 이유 문장 + 근거 문서 id' },
      { id: 'done', kind: 'terminal', label: '여행일정 확정', detail: '지표·연계지수·후보/제외 기록과 함께 반환' },
    ],
  },
  {
    number: 6,
    id: 'minimal-change-replan',
    title: '일정 변경 및 재구성과정',
    caption: `추가 제약조건을 최소 변경으로 반영한다. 한 요청당 최대 ${MAX_REPLACEMENTS_PER_REQUEST}곳만 교체.`,
    nodes: [
      { id: 'request', kind: 'terminal', label: '추가 제약조건 입력', detail: '「걷는 시간을 줄여줘」 등 6종' },
      { id: 'delta', kind: 'process', label: '조건벡터 변화량 적용', detail: 'constraintChange.ts — 증감량은 선언적 데이터' },
      { id: 'impact', kind: 'process', label: '방문지별 영향도 산정', detail: 'impact.ts — 목표 지표 기여도 내림차순' },
      { id: 'search', kind: 'process', label: '대체 후보 탐색', detail: 'replacementSearch.ts — 교체본을 실제로 재계산해 개선폭 확정' },
      {
        id: 'accept',
        kind: 'decision',
        label: `채택 조건 판정 (유사도 ${MINIMUM_SIMILARITY}점 이상)`,
        detail: '지표 개선 · 관광가치 유사 · 운영시간과 활동시간 성립',
        branch: {
          label: '미충족',
          node: {
            id: 'reject',
            kind: 'reject',
            label: '기각 사유 기록',
            detail: '개선 없음 · 성격 상이 · 일정 성립 불가 · 차순위',
          },
        },
      },
      {
        id: 'stop',
        kind: 'decision',
        label: '목표가 달성되었는가',
        detail: '달성 시 남은 영향도 순위를 보지 않고 즉시 중단',
        branch: {
          label: '미달성',
          node: {
            id: 'continue',
            kind: 'data',
            label: '다음 영향도 순위로 반복',
            detail: `상한 ${MAX_REPLACEMENTS_PER_REQUEST}곳에 도달하면 미달성으로 종료`,
          },
        },
      },
      {
        id: 'diff',
        kind: 'data',
        label: '변경 전/후 차이 산출',
        detail: '유지 장소 · 변경 장소 · 변화량(%) · 지표별 증감',
      },
    ],
  },
];

/** 신뢰도 판정 기준을 도면 캡션 등에 재사용하기 위한 요약. */
export const DIAGRAM_TRUST_NOTE = `정보 신뢰도는 공식기관 여부(${TRUST_WEIGHTS.officialIssuer}) · 최신 갱신일(${TRUST_WEIGHTS.recentUpdate}) · 복수 출처 일치(${TRUST_WEIGHTS.corroboration}) · 정보항목 확인(${TRUST_WEIGHTS.fieldCoverage})을 합산하며, 갱신 후 ${DOCUMENT_FRESHNESS_DAYS.stale}일을 넘기면 최신성 점수가 0이 된다.`;
