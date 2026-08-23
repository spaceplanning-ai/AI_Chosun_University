/**
 * 특허 후보 제1안 — 처리단계 7) 취향 적합도, 이동부담 및 연계지수를 반영해 여행일정을 생성하는 단계.
 *
 * 탐욕적 선택이되, 매 선택마다 후보 전체를 다시 채점한다.
 * 이미 고른 방문지가 다음 후보의 다양성·지역분산·연계 한계기여를 바꾸기 때문이며,
 * 이 재채점 구조가 "단순 상위 N개 나열"과 본 방식을 구분하는 지점이다.
 */

import { SCHEDULING } from '../../config/scoring';
import { requireAttraction } from '../../data/attractions';
import { formatClock, parseClock } from '../../lib/time';
import {
  dayStartMinutes,
  retimeDays,
  travelMinutesBetween,
  travelMinutesFromGateway,
} from '../shared/scheduling';
import { COMPANION_TITLE_PHRASES, DURATION_TITLE_PHRASES, REGION_LABELS } from '../labels';
import type { Attraction, AttractionMotif, Region } from '../types/catalog';
import type { CandidateScore, ExclusionRecord, TrustAssessment } from '../types/evidence';
import type { ItineraryDay, ItineraryStop, LinkageCorrection } from '../types/itinerary';
import type { ConditionVector, TravelConditions } from '../types/travel';
import { assessLinkage } from './linkageIndex';
import { buildStopRationale } from './rationale';
import { rankCandidates, type ScoringContext } from './scoring';

export interface ComposeInput {
  eligible: readonly Attraction[];
  vector: ConditionVector;
  conditions: TravelConditions;
  trust: ReadonlyMap<string, TrustAssessment>;
}

export interface ComposeResult {
  days: ItineraryDay[];
  /** 마지막 선택 시점의 후보 순위표. 연구자 화면의 "관광지 후보군"이 된다. */
  candidates: CandidateScore[];
  /** 일정 수용량·다양성 때문에 탈락한 기록. */
  exclusions: ExclusionRecord[];
  /** 한 지역에만 몰린 일정을 보정한 경우의 기록. */
  linkageCorrection?: LinkageCorrection;
  title: string;
  subtitle: string;
}

/**
 * 일자별 중심 지역 계획.
 * 첫날은 광주 도착 거점을 활용하고, 이후 전남으로 넘어간 뒤 마지막 날 다시 광주로 복귀한다.
 * 이 계획은 "권장"일 뿐이며 실제 선택은 점수가 결정한다.
 */
function planDayFocus(dayCount: number): Region[] {
  switch (dayCount) {
    case 1:
      return ['gwangju'];
    case 2:
      return ['gwangju', 'jeonnam'];
    case 3:
      return ['gwangju', 'jeonnam', 'jeonnam'];
    default:
      return ['gwangju', 'jeonnam', 'jeonnam', 'gwangju'];
  }
}

/**
 * 제목에서 「{지명}의 ___」 자리에 들어가는 말.
 *
 * 앞에 이미 「…의」가 붙으므로 여기에 다시 「의」를 넣으면
 * "광주의 남도의 맛", "광주의 밤의 풍경" 처럼 조사가 겹친다.
 * 그래서 이 표의 값에는 「의」를 두지 않는다.
 */
const MOTIF_PHRASES: Record<AttractionMotif, string> = {
  city: '거리 풍경',
  art: '예술',
  forest: '숲',
  sea: '바다',
  field: '들과 물',
  heritage: '오래된 이야기',
  food: '맛',
  night: '밤 풍경',
};

/** '전남 담양군' → '담양', '광주 동구' → '광주'. 제목에 쓰는 짧은 지명. */
function shortPlaceName(attraction: Attraction): string {
  if (attraction.region === 'gwangju') return '광주';
  return attraction.district.replace(/^전남\s*/, '').replace(/[시군구]$/, '');
}

function buildTitle(days: readonly ItineraryDay[], conditions: TravelConditions): string {
  const stops = days.flatMap((day) => day.stops);
  const first = stops[0];
  const last = stops.at(-1);
  if (!first || !last) return '남도 여행 일정';

  const opening = requireAttraction(first.attractionId);
  // 제목의 끝은 "다른 지역"이어야 초광역 연계가 제목에서부터 읽힌다.
  const closingStop = [...stops].reverse().find((stop) => {
    const attraction = requireAttraction(stop.attractionId);
    return attraction.region !== opening.region;
  });
  const closing = requireAttraction((closingStop ?? last).attractionId);

  const head = `${shortPlaceName(opening)}의 ${MOTIF_PHRASES[opening.motif]}`;
  const tail = `${shortPlaceName(closing)}의 ${MOTIF_PHRASES[closing.motif]}`;
  const audience = `${COMPANION_TITLE_PHRASES[conditions.companion]} 떠나는`;

  return head === tail
    ? `${head}을 담은, ${audience} ${DURATION_TITLE_PHRASES[conditions.duration]}`
    : `${head}에서 ${tail}까지, ${audience} ${DURATION_TITLE_PHRASES[conditions.duration]}`;
}

function buildSubtitle(days: readonly ItineraryDay[], conditions: TravelConditions): string {
  const regions = new Set(
    days.flatMap((day) => day.stops).map((stop) => requireAttraction(stop.attractionId).region),
  );
  const regionText = [...regions].map((region) => REGION_LABELS[region]).join('·');
  return `${conditions.origin} 출발 · ${regionText} · 방문지 ${days.reduce((total, day) => total + day.stops.length, 0)}곳`;
}

function dayTitle(dayIndex: number, stops: readonly ItineraryStop[]): string {
  if (stops.length === 0) return `${dayIndex + 1}일차`;
  const districts = [
    ...new Set(stops.map((stop) => shortPlaceName(requireAttraction(stop.attractionId)))),
  ];
  return `${dayIndex + 1}일차 · ${districts.join(' → ')}`;
}

function dominantRegion(stops: readonly ItineraryStop[], fallback: Region): Region {
  const counts = { gwangju: 0, jeonnam: 0 } satisfies Record<Region, number>;
  for (const stop of stops) {
    counts[requireAttraction(stop.attractionId).region] += 1;
  }
  if (counts.gwangju === counts.jeonnam) return fallback;
  return counts.gwangju > counts.jeonnam ? 'gwangju' : 'jeonnam';
}

/**
 * 초광역 연계 보정.
 *
 * 점수 합만 따르면 접근성이 좋은 광주 도심 자원만으로 일정이 채워지는 경우가 있다.
 * 그때 가장 기여도가 낮은 방문지 하나를 누락된 지역의 최고 후보로 교체한다.
 *
 * 중요한 것은 이것이 "각 지역 한 곳씩" 같은 고정 규칙이 아니라는 점이다(제안서 7.2가 명시적으로 배제).
 * 교체 후 연계지수가 실제로 올라갈 때만 적용하며, 오르지 않으면 원래 일정을 그대로 둔다.
 */
function applyLinkageCorrection(
  days: ItineraryDay[],
  input: ComposeInput,
): { days: ItineraryDay[]; correction?: LinkageCorrection } {
  const { eligible, vector, conditions, trust } = input;
  const stops = days.flatMap((day) => day.stops);
  if (stops.length < 2) return { days };

  const chosen = stops.map((stop) => requireAttraction(stop.attractionId));
  const presentRegions = new Set(chosen.map((attraction) => attraction.region));
  if (presentRegions.size > 1) return { days };

  const missingRegion: Region = presentRegions.has('gwangju') ? 'jeonnam' : 'gwangju';
  const pool = eligible.filter(
    (attraction) =>
      attraction.region === missingRegion && !chosen.some((picked) => picked.id === attraction.id),
  );
  if (pool.length === 0) return { days };

  // 가장 마지막 방문지를 교체 대상으로 삼는다. 앞쪽 일정의 서사를 흔들지 않기 위함이다.
  const targetStop = stops.at(-1);
  const targetDay = days.find((day) => day.stops.some((stop) => stop.id === targetStop?.id));
  if (!targetStop || !targetDay) return { days };
  const retained = chosen.filter((attraction) => attraction.id !== targetStop.attractionId);

  const ranking = rankCandidates(pool, {
    vector,
    conditions,
    selected: retained,
    focusRegion: missingRegion,
    previous: retained.at(-1),
    isDayOpening: retained.length === 0,
    trust,
  });

  const linkageBefore = assessLinkage(chosen).score;
  const isFirstStopOfDay = targetDay.stops[0]?.id === targetStop.id;
  // 교체 후보가 실제로 들어갈 수 있는 시각. 대상 방문지의 이동 전 시점이 곧 가용 시각이다.
  const freeAt = targetStop.startMinutes - targetStop.travelFromPreviousMinutes;

  // 연계지수만 보고 교체하면 운영시간이 끝난 곳을 밀어 넣게 된다. 배치 가능성을 함께 확인한다.
  const accepted = ranking
    .map((candidate) => {
      const replacement = requireAttraction(candidate.attractionId);
      const travel = !isFirstStopOfDay
        ? travelMinutesBetween(retained.at(-1), replacement, vector)
        : targetDay.dayIndex === 0
          ? travelMinutesFromGateway(replacement, vector)
          : 0;
      const startMinutes = Math.max(freeAt + travel, parseClock(replacement.openingHours.open));
      const fitsOpeningHours =
        startMinutes + replacement.averageStayMinutes <=
        parseClock(replacement.openingHours.close);
      return { candidate, replacement, fitsOpeningHours };
    })
    .find(
      (option) =>
        option.fitsOpeningHours &&
        assessLinkage([...retained, option.replacement]).score > linkageBefore,
    );

  if (!accepted) return { days };
  const { candidate: best, replacement } = accepted;
  const linkageAfter = assessLinkage([...retained, replacement]).score;

  const correctedDays = days.map((day) => ({
    ...day,
    stops: day.stops.map((stop) =>
      stop.id === targetStop.id
        ? {
            ...stop,
            id: `stop-${replacement.id}`,
            attractionId: replacement.id,
            stayMinutes: replacement.averageStayMinutes,
            rationale: buildStopRationale({
              attractionId: replacement.id,
              score: best,
              trust: trust.get(replacement.id),
              vector,
              conditions,
            }),
          }
        : stop,
    ),
  }));

  return {
    days: correctedDays,
    correction: {
      removedAttractionId: targetStop.attractionId,
      addedAttractionId: replacement.id,
      linkageBefore,
      linkageAfter,
      reason: `일정이 ${REGION_LABELS[chosen[0]?.region ?? 'gwangju']} 자원으로만 구성되어, 마지막 방문지를 ${REGION_LABELS[missingRegion]} 후보로 교체했습니다. 초광역 연계지수 ${linkageBefore}점 → ${linkageAfter}점.`,
    },
  };
}

interface PlacementSearch {
  ranking: readonly CandidateScore[];
  dayIndex: number;
  /** 그 날 일정의 현재 시각(자정 기준 분). */
  cursor: number;
  usedMinutes: number;
  isFirstStopOfDay: boolean;
  previous: Attraction | undefined;
  vector: ConditionVector;
  /**
   * 배치 실패 기록을 누적할 사전. 관광지 id로 키를 잡아 같은 곳이 여러 번 기록되지 않게 한다.
   * 배치 시도는 슬롯마다 반복되므로 배열에 쌓으면 같은 제외 사유가 대여섯 번씩 중복된다.
   */
  schedulingFailures: Map<string, ExclusionRecord>;
}

interface Placement {
  candidate: CandidateScore;
  attraction: Attraction;
  travel: number;
  startMinutes: number;
}

/**
 * 순위표를 위에서부터 훑어 실제로 배치 가능한 첫 후보를 찾는다.
 *
 * 운영시간과 잔여 활동시간이라는 두 개의 하드 제약을 여기서 검사하며,
 * 탈락한 후보는 이유와 수치를 붙여 기록한다. 조용히 건너뛰면
 * "왜 저 유명한 곳이 빠졌나"에 답할 수 없게 된다.
 */
function pickPlaceableCandidate(search: PlacementSearch): Placement | undefined {
  const {
    ranking,
    dayIndex,
    cursor,
    usedMinutes,
    isFirstStopOfDay,
    previous,
    vector,
    schedulingFailures,
  } = search;

  for (const candidate of ranking) {
    const attraction = requireAttraction(candidate.attractionId);

    // 첫날 첫 방문지는 도착 관문에서, 둘째 날부터의 첫 방문지는 인근 숙박에서 출발한다.
    const travel = !isFirstStopOfDay
      ? travelMinutesBetween(previous, attraction, vector)
      : dayIndex === 0
        ? travelMinutesFromGateway(attraction, vector)
        : 0;

    const opensAt = parseClock(attraction.openingHours.open);
    const closesAt = parseClock(attraction.openingHours.close);
    // 도착이 개장 전이면 개장 시각까지 기다린다.
    const startMinutes = Math.max(cursor + travel, opensAt);
    const endsAt = startMinutes + attraction.averageStayMinutes;

    if (endsAt > closesAt) {
      schedulingFailures.set(attraction.id, {
        attractionId: attraction.id,
        reason: 'outsideOpeningHours',
        stage: 'scheduleFitting',
        detail: `${dayIndex + 1}일차 ${formatClock(startMinutes)} 도착 기준 관람 종료가 ${formatClock(endsAt)}로 운영 종료 ${attraction.openingHours.close}를 넘깁니다.`,
      });
      continue;
    }

    const waitMinutes = startMinutes - (cursor + travel);
    const cost = travel + waitMinutes + attraction.averageStayMinutes;
    if (usedMinutes + cost > vector.dailyCapacityMinutes) {
      schedulingFailures.set(attraction.id, {
        attractionId: attraction.id,
        reason: 'capacityCap',
        stage: 'scheduleFitting',
        detail: `${dayIndex + 1}일차 잔여 활동시간 ${Math.max(0, vector.dailyCapacityMinutes - usedMinutes)}분으로는 체류 ${attraction.averageStayMinutes}분 + 이동 ${travel}분을 수용할 수 없습니다.`,
      });
      continue;
    }

    return { candidate, attraction, travel, startMinutes };
  }

  return undefined;
}

export function composeItinerary(input: ComposeInput): ComposeResult {
  const { eligible, vector, conditions, trust } = input;
  const dayFocus = planDayFocus(vector.dayCount);

  const selected: Attraction[] = [];
  const days: ItineraryDay[] = [];
  const schedulingFailures = new Map<string, ExclusionRecord>();
  let latestRanking: CandidateScore[] = [];

  for (const [dayIndex, focusRegion] of dayFocus.entries()) {
    const stops: ItineraryStop[] = [];
    let cursor = dayStartMinutes(dayIndex);
    let usedMinutes = 0;

    while (stops.length < SCHEDULING.maxStopsPerDay) {
      const pool = eligible.filter(
        (attraction) => !selected.some((chosen) => chosen.id === attraction.id),
      );
      if (pool.length === 0) break;

      const context: ScoringContext = {
        vector,
        conditions,
        selected,
        focusRegion,
        // 하루의 첫 방문지도 '전날 마지막 방문지'를 기준으로 거리를 잰다.
        // 숙박 이동을 공짜로 두면 전날 신안에서 자고 다음 날 광주에서 시작하는 일정이
        // 점수상 아무 대가 없이 통과한다. 타임라인상의 이동시간(0분)과는 별개의 문제다.
        previous: selected.at(-1),
        isDayOpening: stops.length === 0,
        trust,
      };
      const ranking = rankCandidates(pool, context);
      latestRanking = ranking;

      // 최고점 후보가 시간에 안 맞으면 그 자리를 비우는 게 아니라 다음 후보로 내려간다.
      // 1순위 하나만 보고 break 하면, 뒤에 충분히 들어갈 수 있는 후보가 있는데도
      // 하루가 두 곳에서 끝나 버린다.
      const placement = pickPlaceableCandidate({
        ranking,
        dayIndex,
        cursor,
        usedMinutes,
        isFirstStopOfDay: stops.length === 0,
        previous: selected.at(-1),
        vector,
        schedulingFailures,
      });
      if (!placement) break;

      const { candidate, attraction, travel, startMinutes } = placement;
      stops.push({
        id: `stop-${attraction.id}`,
        attractionId: attraction.id,
        dayIndex,
        startMinutes,
        stayMinutes: attraction.averageStayMinutes,
        travelFromPreviousMinutes: travel,
        rationale: buildStopRationale({
          attractionId: attraction.id,
          score: candidate,
          trust: trust.get(attraction.id),
          vector,
          conditions,
        }),
      });

      cursor = startMinutes + attraction.averageStayMinutes;
      usedMinutes += travel + attraction.averageStayMinutes;
      selected.push(attraction);
    }

    days.push({
      dayIndex,
      title: dayTitle(dayIndex, stops),
      focusRegion: dominantRegion(stops, focusRegion),
      stops,
    });
  }

  // 후보가 일찍 소진되면 빈 날이 남는다. 빈 날을 그대로 두면 결과화면에 "2일차 · 없음"이 노출되므로
  // 여기서 걷어 내고 일자 번호를 다시 매긴다.
  const populatedDays = days
    .filter((day) => day.stops.length > 0)
    .map((day, index) => ({ ...day, dayIndex: index }));

  const { days: correctedDays, correction } = applyLinkageCorrection(populatedDays, input);
  const finalDays = retimeDays(correctedDays, vector).map((day) => ({
    ...day,
    title: dayTitle(day.dayIndex, day.stops),
    focusRegion: dominantRegion(day.stops, day.focusRegion),
  }));

  // 어느 슬롯에서 한 번 밀렸더라도 결국 일정에 들어간 곳은 '제외'가 아니다.
  const placedIds = new Set(
    finalDays.flatMap((day) => day.stops).map((stop) => stop.attractionId),
  );
  const exclusions = [...schedulingFailures.values()].filter(
    (record) => !placedIds.has(record.attractionId),
  );

  return {
    days: finalDays,
    candidates: latestRanking,
    exclusions,
    linkageCorrection: correction,
    title: buildTitle(finalDays, conditions),
    subtitle: buildSubtitle(finalDays, conditions),
  };
}
