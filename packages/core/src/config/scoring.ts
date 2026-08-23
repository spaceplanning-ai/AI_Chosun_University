/**
 * 추천·신뢰도·연계지수의 배점과 임계값.
 *
 * 제안서 8.4/8.5의 가중치를 그대로 옮긴 값이며, "실제 가중치는 개발 및 실증과정에서 조정"
 * 이라는 단서에 따라 코드가 아니라 이 파일 한 곳에서만 바뀌도록 한다.
 * 연구자 화면은 이 상수를 그대로 읽어 표시하므로, 값을 고치면 화면 설명도 함께 따라온다.
 */

import type { LinkageComponentId, ScoreCriterionId, TrustFactorId } from '../domain/types/evidence';

/** 다목적 추천점수 배점 (제안서 8.4). 합계 100. */
export const SCORE_WEIGHTS: Record<ScoreCriterionId, number> = {
  preferenceFit: 30,
  travelFeasibility: 20,
  regionLinkage: 15,
  resourceDiversity: 10,
  accessibilityFit: 10,
  informationTrust: 10,
  regionalDispersion: 5,
};

/** 정보 신뢰도 배점 (제안서 8.5). 합계 100. */
export const TRUST_WEIGHTS: Record<TrustFactorId, number> = {
  officialIssuer: 35,
  recentUpdate: 25,
  corroboration: 20,
  fieldCoverage: 20,
};

/** 초광역 관광연계지수 구성요소 배점. 합계 100. */
export const LINKAGE_WEIGHTS: Record<LinkageComponentId, number> = {
  regionBalance: 35,
  resourceComplementarity: 25,
  corridorEfficiency: 25,
  narrativeContinuity: 15,
};

export const TRUST_THRESHOLDS = {
  /** 이 점수 미만은 추천 대상에서 제외한다 (제안서 8.5). */
  exclude: 55,
  /** 이 점수 미만은 순위를 낮춘다. */
  demote: 70,
} as const;

export const DOCUMENT_FRESHNESS_DAYS = {
  /** 이 기간 이내 갱신이면 최신 자료로 만점 처리. */
  fresh: 180,
  /** 이 기간을 넘기면 "오래된 정보"로 표시하고 감점한다. */
  stale: 540,
} as const;

/** 복수 공식 출처가 일치할 때 만점을 주는 기준 문서 수. */
export const CORROBORATION_TARGET_DOCUMENTS = 2;

/** 신뢰도 만점을 받기 위해 확인되어야 하는 정보 항목 수. */
export const FIELD_COVERAGE_TARGET = 4;

export const SCHEDULING = {
  /** 하루 기본 활동 가능 시간(분). */
  baseDailyMinutes: 480,
  /** 첫 일정 시작 시각(자정 기준 분). 11:00 */
  dayStartMinutes: 11 * 60,
  /** 둘째 날 이후 시작 시각. 10:00 */
  laterDayStartMinutes: 10 * 60,
  /** 하루 최대 방문지 수. 전시 시연에서 화면 밖으로 넘치지 않게 하는 상한. */
  maxStopsPerDay: 5,
} as const;

/**
 * 이동시간 모델.
 *
 * 지역을 "광주/전남" 두 덩어리로 보고 고정 이동시간을 쓰면 목포–여수(약 130km)와
 * 담양–화순(약 30km)이 같은 비용으로 취급되어 지리적으로 불가능한 일정이 만들어진다.
 * 따라서 좌표 기반 직선거리에 우회계수를 곱해 추정한다.
 * 실시간 길찾기는 본 MVP 범위 밖이며(제안서 12.4), 여기서는 일정 실현 가능성 판단에
 * 필요한 수준의 추정치만 사용한다.
 */
export const TRAVEL_MODEL = {
  /** 직선거리 → 실제 도로거리 보정계수. */
  detourFactor: 1.22,
  /** 도로거리 1km당 소요시간(분). 고속도로 구간을 포함한 유효속도 약 63km/h. */
  minutesPerKilometer: 0.95,
  /** 승하차·주차·환승에 걸리는 고정 비용(분). */
  boardingOverheadMinutes: 14,
  /** 대중교통 전면 의존 시 배율. 환승 대기와 배차간격을 반영한다. */
  transitMultiplier: 1.45,
  /** 인접 관광지로 명시된 곳 사이의 이동시간(분). 거리 계산을 건너뛴다. */
  adjacentMinutes: 12,
} as const;

/**
 * 역외 관광객의 도착 관문.
 * 제안서 6.4의 예시 일정이 "11:00 광주송정역 도착"으로 시작하는 것과 같은 전제다.
 * 첫날 첫 방문지까지의 이동시간은 이 지점에서부터 계산한다.
 */
export const ARRIVAL_GATEWAY = {
  name: '광주송정역',
  coordinates: { lat: 35.14, lng: 126.793 },
} as const;

/** 같은 관광유형이 한 일정에 반복될 수 있는 최대 횟수. 자원 다양성 확보용. */
export const MAX_STOPS_PER_CATEGORY = 2;

/** 여행기간별 일수. */
export const DAY_COUNT_BY_DURATION = {
  day: 1,
  oneNight: 2,
  twoNights: 3,
  threePlus: 4,
} as const;
