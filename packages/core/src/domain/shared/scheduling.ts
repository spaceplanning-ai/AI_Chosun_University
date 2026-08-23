/**
 * 일정 배치 공통 로직 (특허 중립 인프라).
 *
 * 이동시간 산정과 시각 재계산은 제1안(생성)과 제2안(재구성)이 모두 필요로 한다.
 * 어느 한쪽에 두면 다른 쪽이 그 모듈을 import 하게 되어 "모듈 분리 납품"(피드백 5.3)이 흐려지므로,
 * 두 특허 어디에도 속하지 않는 공통 계층으로 뺀다.
 */

import { ARRIVAL_GATEWAY, SCHEDULING, TRAVEL_MODEL } from '../../config/scoring';
import { requireAttraction } from '../../data/attractions';
import { parseClock } from '../../lib/time';
import type { Attraction } from '../types/catalog';
import type { ItineraryDay, ItineraryStop } from '../types/itinerary';

interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 두 좌표 사이의 대권거리(km). */
export function haversineKilometers(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 이동수단 조건. 대중교통 의존도가 높을수록 같은 거리라도 오래 걸린다.
 * 조건벡터 전체가 아니라 필요한 한 필드만 받아 이 모듈이 여행조건 도메인에 묶이지 않게 한다.
 */
export interface TravelModel {
  /** 0–100. `ConditionVector.transitDependency` 를 그대로 넘기면 된다. */
  transitDependency: number;
}

function distanceMinutes(
  from: Coordinates,
  to: Coordinates,
  model: TravelModel,
): number {
  const roadKilometers = haversineKilometers(from, to) * TRAVEL_MODEL.detourFactor;
  const base =
    roadKilometers * TRAVEL_MODEL.minutesPerKilometer + TRAVEL_MODEL.boardingOverheadMinutes;
  const transitRatio = Math.min(1, Math.max(0, model.transitDependency / 100));
  const multiplier = 1 + (TRAVEL_MODEL.transitMultiplier - 1) * transitRatio;
  return Math.round(base * multiplier);
}

/** 두 방문지 사이의 이동시간(분). 인접 관계로 명시된 곳은 거리 계산을 건너뛴다. */
export function travelMinutesBetween(
  from: Attraction | undefined,
  to: Attraction,
  model: TravelModel,
): number {
  if (!from) return 0;
  if (from.adjacentIds.includes(to.id) || to.adjacentIds.includes(from.id)) {
    return TRAVEL_MODEL.adjacentMinutes;
  }
  return distanceMinutes(from.coordinates, to.coordinates, model);
}

/** 도착 관문(광주송정역)에서 첫 방문지까지의 이동시간(분). */
export function travelMinutesFromGateway(to: Attraction, model: TravelModel): number {
  return distanceMinutes(ARRIVAL_GATEWAY.coordinates, to.coordinates, model);
}

/** 마지막 방문지에서 관문으로 복귀하는 데 걸리는 시간(분). 상경 열차 시각 안내에 쓴다. */
export function travelMinutesToGateway(from: Attraction, model: TravelModel): number {
  return distanceMinutes(from.coordinates, ARRIVAL_GATEWAY.coordinates, model);
}

/** 그 날의 일정 시작 시각(자정 기준 분). 첫날은 열차 도착을 감안해 늦게 시작한다. */
export function dayStartMinutes(dayIndex: number): number {
  return dayIndex === 0 ? SCHEDULING.dayStartMinutes : SCHEDULING.laterDayStartMinutes;
}

/**
 * 방문 순서가 바뀐 뒤 이동시간과 시각을 다시 계산한다.
 * 재구성으로 방문지 하나만 교체해도 그 뒤 일정의 시각이 전부 밀리므로,
 * 화면에 내보내기 전에 반드시 이 함수를 거쳐야 한다.
 *
 * 첫날 첫 방문지는 관문에서의 이동시간을 적용하고,
 * 둘째 날부터의 첫 방문지는 인근 숙박을 전제로 0으로 둔다.
 */
export function retimeDays(days: readonly ItineraryDay[], model: TravelModel): ItineraryDay[] {
  let previous: Attraction | undefined;

  return days.map((day) => {
    let cursor = dayStartMinutes(day.dayIndex);
    const stops: ItineraryStop[] = day.stops.map((stop, index) => {
      const attraction = requireAttraction(stop.attractionId);
      const travel =
        index > 0
          ? travelMinutesBetween(previous, attraction, model)
          : day.dayIndex === 0
            ? travelMinutesFromGateway(attraction, model)
            : 0;

      // 개장 전 도착이면 개장까지 기다린다. 배치 단계와 같은 규칙을 써야
      // 화면의 시각과 생성 단계의 판정이 어긋나지 않는다.
      const startMinutes = Math.max(cursor + travel, parseClock(attraction.openingHours.open));
      const retimed: ItineraryStop = {
        ...stop,
        dayIndex: day.dayIndex,
        startMinutes,
        stayMinutes: attraction.averageStayMinutes,
        travelFromPreviousMinutes: travel,
      };
      cursor = startMinutes + attraction.averageStayMinutes;
      previous = attraction;
      return retimed;
    });

    return { ...day, stops };
  });
}

/** 그 날 일정이 소비하는 총 시간(이동 + 체류, 분). */
export function dayLoadMinutes(day: ItineraryDay): number {
  return day.stops.reduce(
    (total, stop) => total + stop.travelFromPreviousMinutes + stop.stayMinutes,
    0,
  );
}
