/**
 * 여행조건 도메인 타입.
 * 제안서 6.2(여행조건 선택 5단계) 및 8.2(사용자 여행조건 벡터)에 대응한다.
 */

export const COMPANIONS = ['solo', 'couple', 'friends', 'child', 'parents', 'group'] as const;
export const DURATIONS = ['day', 'oneNight', 'twoNights', 'threePlus'] as const;
export const INTERESTS = [
  'culture',
  'nature',
  'sea',
  'food',
  'photo',
  'history',
  'activity',
  'rest',
] as const;
export const TRANSPORTS = ['transit', 'ownCar', 'rentalCar', 'undecided'] as const;
export const SPECIAL_NEEDS = [
  'lessWalking',
  'moreIndoor',
  'shorterDistance',
  'childFriendly',
  'seniorFriendly',
  'lowerCost',
  'none',
] as const;

export type Companion = (typeof COMPANIONS)[number];
export type Duration = (typeof DURATIONS)[number];
export type Interest = (typeof INTERESTS)[number];
export type Transport = (typeof TRANSPORTS)[number];
export type SpecialNeed = (typeof SPECIAL_NEEDS)[number];

/** 키오스크가 수집하는 원본 선택값. 화면 입력과 1:1로 대응한다. */
export interface TravelConditions {
  companion: Companion;
  duration: Duration;
  interests: Interest[];
  transport: Transport;
  specialNeeds: SpecialNeed[];
  /** 출발지. 설치 위치에 따라 달라지며 로그에 함께 남는다. */
  origin: string;
}

/**
 * 특허 후보 제1안 처리단계 3) "여행조건을 복수의 평가요소로 변환하는 단계"의 산출물.
 * 선택형 입력을 연속값 벡터로 구조화하여 이후 모든 점수 계산의 입력으로 쓴다.
 */
export interface ConditionVector {
  /** 관심유형별 가중치 (합 1.0으로 정규화). */
  interestWeights: Record<Interest, number>;
  /** 감내 가능한 보행부담 0(매우 낮음)–100(높음). */
  walkingTolerance: number;
  /** 실내 선호도 0(실외 선호)–100(실내 선호). */
  indoorPreference: number;
  /** 비용 민감도 0(둔감)–100(민감). */
  costSensitivity: number;
  /** 하루 소화 가능한 총 활동시간(분). */
  dailyCapacityMinutes: number;
  /** 대중교통 의존도 0(자차)–100(전적으로 대중교통). */
  transitDependency: number;
  /** 고령자 배려 필요도 0–100. */
  seniorConsideration: number;
  /** 아동 배려 필요도 0–100. */
  childConsideration: number;
  /** 이동거리 축소 요구 0–100. */
  compactnessDemand: number;
  dayCount: number;
  origin: string;
}
