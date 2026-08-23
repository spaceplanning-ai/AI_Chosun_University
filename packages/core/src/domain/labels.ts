/**
 * 열거값의 한글 표기 단일 사전.
 *
 * 화면·로그·CSV·연구자 모드가 모두 여기만 참조한다.
 * 컴포넌트 안에서 문자열을 직접 쓰면 같은 개념이 화면마다 다른 말로 불리게 되므로 금지한다.
 */

import type {
  Attraction,
  DocumentField,
  IssuerType,
  Region,
  Setting,
} from './types/catalog';
import type {
  ExclusionReasonCode,
  ExclusionStage,
  LinkageComponentId,
  ScoreCriterionId,
  TrustFactorId,
  TrustVerdict,
} from './types/evidence';
import type { ItineraryMetrics } from './types/itinerary';
import type { RefinementId } from './types/replan';
import type { Companion, Duration, Interest, SpecialNeed, Transport } from './types/travel';

export const COMPANION_LABELS: Record<Companion, string> = {
  solo: '혼자',
  couple: '연인',
  friends: '친구',
  child: '아이와 함께',
  parents: '부모님과 함께',
  group: '단체여행',
};

/**
 * 일정 제목에서 「… 떠나는」 앞에 붙는 형태.
 *
 * 선택지 라벨을 그대로 이어 붙이면 "연인 떠나는 · 친구 떠나는 · 단체여행 떠나는" 처럼
 * 조사가 빠진 비문이 된다. 라벨은 버튼에 홀로 놓이는 명사이고, 이쪽은 문장 속 부사구라
 * 서로 다른 형태가 필요하다. 그래서 표를 나눠 각각 하나의 출처만 두었다.
 */
export const COMPANION_TITLE_PHRASES: Record<Companion, string> = {
  solo: '혼자',
  couple: '연인과',
  friends: '친구와',
  child: '아이와 함께',
  parents: '부모님과 함께',
  group: '여럿이 함께',
};

export const DURATION_LABELS: Record<Duration, string> = {
  day: '당일',
  oneNight: '1박 2일',
  twoNights: '2박 3일',
  threePlus: '3일 이상',
};

/**
 * 일정 제목에서 「… 떠나는 ___」 자리에 들어가는 형태.
 *
 * 선택지 라벨을 그대로 붙이면 「혼자 떠나는 3일 이상」처럼 말이 끊긴다.
 * 「3일 이상」은 조건을 고르는 자리에서는 완결된 말이지만, 문장 끝에서는 명사가 필요하다.
 * 라벨과 제목용 표현을 나눠 각각 하나의 출처만 둔다 — [[COMPANION_TITLE_PHRASES]] 와 같은 이유다.
 */
export const DURATION_TITLE_PHRASES: Record<Duration, string> = {
  day: '당일 여행',
  oneNight: '1박 2일',
  twoNights: '2박 3일',
  threePlus: '3일 이상의 여정',
};

export const INTEREST_LABELS: Record<Interest, string> = {
  culture: '문화·예술',
  nature: '자연·숲',
  sea: '바다',
  food: '음식',
  photo: '사진',
  history: '역사',
  activity: '체험',
  rest: '휴식',
};

export const TRANSPORT_LABELS: Record<Transport, string> = {
  transit: '대중교통',
  ownCar: '자가용',
  rentalCar: '렌터카',
  undecided: '아직 정하지 않음',
};

export const SPECIAL_NEED_LABELS: Record<SpecialNeed, string> = {
  lessWalking: '걷는 시간을 줄이고 싶어요',
  moreIndoor: '실내 장소를 많이 포함해 주세요',
  shorterDistance: '이동거리를 줄이고 싶어요',
  childFriendly: '아이가 즐길 수 있어야 해요',
  seniorFriendly: '부모님과 편하게 여행하고 싶어요',
  lowerCost: '비용 부담을 줄이고 싶어요',
  none: '특별한 조건이 없어요',
};

export const REGION_LABELS: Record<Region, string> = {
  gwangju: '광주',
  jeonnam: '전남',
};

export const SETTING_LABELS: Record<Setting, string> = {
  indoor: '실내',
  outdoor: '실외',
  mixed: '실내·실외',
};

export const ISSUER_TYPE_LABELS: Record<IssuerType, string> = {
  government: '지방자치단체',
  publicAgency: '공공기관',
  tourismOrg: '관광기관',
  facility: '운영시설',
};

export const DOCUMENT_FIELD_LABELS: Record<DocumentField, string> = {
  openingHours: '운영시간',
  address: '주소',
  contact: '연락처',
  access: '접근성',
  fee: '이용요금',
  closure: '휴무일',
};

export const SCORE_CRITERION_LABELS: Record<ScoreCriterionId, string> = {
  preferenceFit: '취향 적합도',
  travelFeasibility: '이동 실현 가능성',
  regionLinkage: '광주·전남 연계도',
  resourceDiversity: '관광자원 다양성',
  accessibilityFit: '접근성 적합도',
  informationTrust: '정보 신뢰도',
  regionalDispersion: '지역 분산 기여도',
};

export const TRUST_FACTOR_LABELS: Record<TrustFactorId, string> = {
  officialIssuer: '공식기관 자료 여부',
  recentUpdate: '최신 갱신일 여부',
  corroboration: '복수 공식 출처 일치',
  fieldCoverage: '운영·주소·연락처·접근성 확인',
};

export const TRUST_VERDICT_LABELS: Record<TrustVerdict, string> = {
  accepted: '채택',
  demoted: '순위 하향',
  excluded: '제외',
};

export const LINKAGE_COMPONENT_LABELS: Record<LinkageComponentId, string> = {
  regionBalance: '지역 균형',
  resourceComplementarity: '자원 상보성',
  corridorEfficiency: '이동 효율',
  narrativeContinuity: '여정 연속성',
};

export const EXCLUSION_REASON_LABELS: Record<ExclusionReasonCode, string> = {
  lowInformationTrust: '정보 신뢰도 기준 미달',
  noOfficialSource: '공식 출처 없음',
  staleInformation: '갱신일이 오래됨',
  walkingLoadTooHigh: '보행부담 초과',
  outsideInterest: '선택한 관심분야와 불일치',
  weatherUnsuitable: '실내 선호 조건과 불일치',
  closedOnVisitDay: '방문일 휴무',
  outsideOpeningHours: '운영시간 내 관람 불가',
  travelTimeInfeasible: '이동시간 초과',
  diversityCap: '관광유형 편중 방지',
  capacityCap: '일정 수용량 초과',
};

export const EXCLUSION_STAGE_LABELS: Record<ExclusionStage, string> = {
  trustFilter: '신뢰도 필터',
  constraintFilter: '조건 필터',
  scheduleFitting: '일정 배치',
  diversityControl: '다양성 제어',
};

export const REFINEMENT_TARGET_HINTS: Record<RefinementId, string> = {
  reduceWalking: '보행부담이 높은 장소를 우선 교체합니다',
  preferIndoor: '실외 장소를 실내 대안으로 교체합니다',
  addNature: '자연·숲 유형의 비중을 높입니다',
  includeSea: '해안 관광지를 일정에 포함합니다',
  reduceCost: '비용 부담이 큰 장소를 교체합니다',
  moreJeonnam: '전남 관광지의 비중을 높입니다',
};

/** 비교 가능한(수치형) 일정 지표. `stopsByRegion` 처럼 객체인 항목은 제외한다. */
export const COMPARABLE_METRICS = [
  'walkingLoad',
  'travelMinutes',
  'indoorRatio',
  'costLevel',
  'stopCount',
  'averageTrust',
  'linkageScore',
] as const satisfies readonly (keyof ItineraryMetrics)[];

export type ComparableMetric = (typeof COMPARABLE_METRICS)[number];

export interface MetricDisplay {
  label: string;
  unit: string;
  /** 별도 요청이 없을 때 값이 어느 방향으로 움직여야 개선인지. */
  betterWhen: 'lower' | 'higher' | 'neutral';
}

export const METRIC_DISPLAY: Record<ComparableMetric, MetricDisplay> = {
  walkingLoad: { label: '보행부담', unit: '점', betterWhen: 'lower' },
  travelMinutes: { label: '총 이동시간', unit: '분', betterWhen: 'lower' },
  indoorRatio: { label: '실내 일정 비율', unit: '%', betterWhen: 'neutral' },
  costLevel: { label: '비용 수준', unit: '점', betterWhen: 'lower' },
  stopCount: { label: '방문지 수', unit: '곳', betterWhen: 'neutral' },
  averageTrust: { label: '평균 정보 신뢰도', unit: '점', betterWhen: 'higher' },
  linkageScore: { label: '초광역 연계지수', unit: '점', betterWhen: 'higher' },
};

/**
 * 관광지 항목의 이름.
 *
 * ── 왜 한 곳에 모으는가 ────────────────────────────────────────────
 * 같은 값을 어드민 입력칸은 「보행부담」이라 부르고 검증 문구는 `walkingLoad`
 * 라 부르면, 「walkingLoad 를 고치라」는 안내를 받은 사람이 화면에서
 * 그 칸을 못 찾는다. 입력칸과 검증 문구가 같은 이름을 쓰도록 여기서 정한다.
 */
export const ATTRACTION_FIELD_LABELS = {
  id: '식별자',
  name: '관광지명',
  district: '소재지',
  address: '주소',
  region: '지역',
  motif: '성격',
  categories: '관광유형',
  audiences: '추천 대상',
  setting: '실내외',
  walkingLoad: '보행부담',
  familyScore: '가족 적합도',
  seniorScore: '고령자 적합도',
  rainySuitability: '우천 적합도',
  transitAccess: '대중교통 접근성',
  costLevel: '비용 수준',
  averageStayMinutes: '평균 체류시간',
} as const satisfies Partial<Record<keyof Attraction, string>>;

export type LabelledAttractionField = keyof typeof ATTRACTION_FIELD_LABELS;
