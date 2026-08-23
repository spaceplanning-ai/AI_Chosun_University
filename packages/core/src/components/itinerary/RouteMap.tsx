'use client';

import { useId } from 'react';
import { ARRIVAL_GATEWAY } from '../../config/scoring';
import { requireAttraction } from '../../data/attractions';
import { REGION_LABELS } from '../../domain/labels';
import type { Region } from '../../domain/types/catalog';
import type { ItineraryDay } from '../../domain/types/itinerary';
import { cn } from '../../lib/cn';
import { formatClock } from '../../lib/time';
import { Badge } from '../ui/Badge';

/**
 * 여행경로 지도 (제안서 12.3 "지도 기반 여행경로" / 11.2 "관광경로를 의미하는 곡선").
 *
 * 실제 위경도를 투영해 그린다. 임의 배치가 아니라 좌표 기반이므로,
 * 화면에서 "광주에서 담양까지가 가깝고 목포까지는 멀다"는 것이 눈으로 읽힌다 —
 * 초광역 연계라는 개념이 말이 아니라 그림으로 전달되는 지점이다.
 *
 * 행정경계 도형을 그리지 않는 것은 의도적이다. 부정확한 해안선을 그려 넣으면
 * 전시장에서 오히려 신뢰를 떨어뜨린다. 대신 방문지·경로·지역 구분만 정확히 표현한다.
 *
 * 방문지 이름은 지도 위가 아니라 아래 범례에 둔다. 지도에 직접 얹으면
 * 담양 3곳처럼 가까운 자원끼리 글자가 겹쳐 읽을 수 없게 된다.
 */

const VIEW = { width: 100, height: 100, padding: 9 } as const;

export interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * 등장방형 투영 + 위도 보정.
 * 위도만큼 경도 간격이 좁아지는 것을 반영하지 않으면 남북으로 길쭉한 전남이
 * 실제보다 넓게 그려져 거리감이 왜곡된다.
 */
export interface ProjectedView {
  points: ProjectedPoint[];
  /** 내용에 맞춘 좌표계 크기. 고정 정사각형이면 한쪽에 큰 빈 띠가 생긴다. */
  width: number;
  height: number;
}

function projectAll(coordinates: readonly { lat: number; lng: number }[]): ProjectedView {
  if (coordinates.length === 0) return { points: [], width: VIEW.width, height: VIEW.height };

  const latitudes = coordinates.map((coordinate) => coordinate.lat);
  const midLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const longitudeScale = Math.cos((midLatitude * Math.PI) / 180);

  const raw = coordinates.map((coordinate) => ({
    x: coordinate.lng * longitudeScale,
    y: -coordinate.lat,
  }));

  const minX = Math.min(...raw.map((point) => point.x));
  const maxX = Math.max(...raw.map((point) => point.x));
  const minY = Math.min(...raw.map((point) => point.y));
  const maxY = Math.max(...raw.map((point) => point.y));

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  /*
    좌표계를 내용에 맞춘다.

    정사각형으로 고정하면, 남북으로 긴 경로(광주→화순)에서는 좌우에,
    동서로 긴 경로에서는 위아래에 큰 빈 띠가 남는다. 지도가 실제보다 작게 앉아
    번호가 작아지고 화면은 비어 보인다.

    긴 쪽을 기준 폭에 맞추고 짧은 쪽 길이를 비율에서 계산한다.
    다만 비율을 자료에 그대로 맡기면 남북으로 긴 경로(광주→화순)에서 지도가 세로로 길어져
    결과화면 한 화면을 통째로 차지한다. 지도는 일정의 한 조각이지 주인공이 아니므로
    위아래로 상한과 하한을 둔다. 자료의 실제 비율은 안쪽에서 유지되고 남는 쪽만 여백이 된다.
  */
  const usable = VIEW.width - VIEW.padding * 2;
  const ratio = Math.min(Math.max(spanY / spanX, 0.6), 1.15);
  const width = VIEW.width;
  const height = Number((usable * ratio + VIEW.padding * 2).toFixed(2));

  const scale = Math.min(usable / spanX, (height - VIEW.padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return {
    points: separateOverlaps(
      raw.map((point) => ({
        x: (point.x - minX) * scale + offsetX,
        y: (point.y - minY) * scale + offsetY,
      })),
      { width, height },
    ),
    width,
    height,
  };
}

/**
 * 노드 반지름 2.9 + 테두리 0.6 → 두 노드가 닿지 않으려면 중심이 최소 이만큼 떨어져야 한다.
 * 여유 0.4 를 더해 사이에 배경이 비치게 한다.
 */
export const MIN_NODE_SEPARATION = 7.4;

/**
 * 겹친 방문지 노드를 서로 밀어낸다.
 *
 * 담양 관방제림과 메타세쿼이아 가로수길은 실제로 1km 남짓 떨어져 있어
 * 투영하면 두 원이 거의 포개진다. 그러면 순번 숫자가 가려져
 * "몇 번째로 가는 곳인지"를 읽을 수 없다 — 지도의 핵심 정보가 사라지는 셈이다.
 *
 * 좌표를 다시 계산하지 않고 **필요한 만큼만** 밀어내므로 지리적 배치는 그대로 읽힌다.
 * 난수를 쓰지 않아 같은 일정은 언제나 같은 그림이 된다(재현성).
 */
export function separateOverlaps(
  points: readonly ProjectedPoint[],
  bounds: { width: number; height: number } = { width: VIEW.width, height: VIEW.height },
): ProjectedPoint[] {
  const result = points.map((point) => ({ ...point }));
  /*
    가로와 세로의 한계를 따로 받는다.
    좌표계가 내용에 맞춰 늘어나므로, 한쪽 길이로 양쪽을 자르면
    세로로 긴 경로에서 아래쪽 방문지들이 한 줄에 몰려 붙는다.
  */
  const limitX = { min: VIEW.padding, max: bounds.width - VIEW.padding };
  const limitY = { min: VIEW.padding, max: bounds.height - VIEW.padding };

  /*
    한 번에 절반씩만 밀면 목표 간격에 점근할 뿐 도달하지 못한다(6곳이 몰리면 7.3999 에서 멈춘다).
    목표를 아주 조금 넘겨 잡고 밀어내는 양도 조금 키워, 반복이 끝났을 때
    `MIN_NODE_SEPARATION` 을 확실히 만족하게 한다.
  */
  const target = MIN_NODE_SEPARATION * 1.002;
  const relaxation = 0.55;

  for (let pass = 0; pass < 120; pass += 1) {
    let moved = false;

    for (let a = 0; a < result.length; a += 1) {
      for (let b = a + 1; b < result.length; b += 1) {
        const first = result[a];
        const second = result[b];
        if (!first || !second) continue;

        let deltaX = second.x - first.x;
        let deltaY = second.y - first.y;
        let distance = Math.hypot(deltaX, deltaY);

        if (distance >= target) continue;

        if (distance < 1e-6) {
          // 완전히 같은 자리다. 방향을 난수로 정하면 매번 그림이 달라지므로 순번에서 정한다.
          const angle = ((a * 7 + b * 3) % 12) * (Math.PI / 6);
          deltaX = Math.cos(angle);
          deltaY = Math.sin(angle);
          distance = 1;
        }

        const push = (target - distance) * relaxation;
        const unitX = (deltaX / distance) * push;
        const unitY = (deltaY / distance) * push;

        first.x -= unitX;
        first.y -= unitY;
        second.x += unitX;
        second.y += unitY;
        moved = true;
      }
    }

    // 밀어낸 결과가 화면 밖으로 나가지 않게 매 회 되돌린다.
    for (const point of result) {
      point.x = Math.min(Math.max(point.x, limitX.min), limitX.max);
      point.y = Math.min(Math.max(point.y, limitY.min), limitY.max);
    }

    if (!moved) break;
  }

  return result;
}

/** 관문 이름을 마커 위/아래 중 어디에 둘지. 아래면 +1, 위면 -1. */
export const GATEWAY_LABEL_OFFSET = { below: 5.2, above: -3.6 } as const;

/**
 * 관문 이름표를 놓을 쪽을 고른다.
 *
 * 광주송정역과 1913 송정역시장처럼 관문 바로 옆에 있는 자원은 겹침 해소로 밀려나면서
 * 하필 이름표 자리에 내려앉는다. 그러면 글자 위에 원이 얹혀 역 이름을 읽을 수 없다.
 * 그래서 이름표를 고정된 아래쪽이 아니라 **방문지 노드에서 더 먼 쪽**에 둔다.
 * 화면 밖으로 나갈 상황이면 그쪽은 후보에서 뺀다.
 */
export function pickGatewayLabelSide(
  gateway: ProjectedPoint,
  others: readonly ProjectedPoint[],
): 'above' | 'below' {
  const belowY = gateway.y + GATEWAY_LABEL_OFFSET.below;
  const aboveY = gateway.y + GATEWAY_LABEL_OFFSET.above;

  const fitsBelow = belowY <= VIEW.height - 2;
  const fitsAbove = aboveY >= 3;
  if (!fitsBelow) return 'above';
  if (!fitsAbove) return 'below';

  const clearance = (labelY: number) =>
    others.length === 0
      ? Infinity
      : Math.min(...others.map((point) => Math.hypot(point.x - gateway.x, point.y - labelY)));

  return clearance(aboveY) > clearance(belowY) ? 'above' : 'below';
}

/** 두 점을 잇는 완만한 곡선. 제안서 11.2가 말하는 "관광경로를 의미하는 곡선"에 해당한다. */
function curveBetween(from: ProjectedPoint, to: ProjectedPoint): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  // 선분에 수직인 방향으로 살짝 부풀린다. 길이에 비례하므로 짧은 구간은 거의 직선이 된다.
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const bulge = 0.16;
  return `M ${from.x} ${from.y} Q ${midX - deltaY * bulge} ${midY + deltaX * bulge} ${to.x} ${to.y}`;
}

/**
 * 지도 노드에는 지역명이 적히지 않는다. 색이 유일한 단서이므로,
 * 글자용이 아니라 구분 거리가 검증된 마크색을 쓴다.
 */
const REGION_NODE_CLASS: Record<Region, string> = {
  gwangju: 'fill-gwangju-mark',
  jeonnam: 'fill-jeonnam-mark',
};

export interface RouteMapProps {
  days: readonly ItineraryDay[];
  /** 도착 관문(광주송정역)을 출발점으로 표시할지. */
  showGateway?: boolean;
  /** 재구성으로 새로 들어온 방문지 id. 강조 링을 두른다. */
  changedStopIds?: readonly string[];
  className?: string;
}

export function RouteMap({
  days,
  showGateway = true,
  changedStopIds = [],
  className,
}: RouteMapProps) {
  const gradientId = useId();
  const changed = new Set(changedStopIds);

  const stops = days.flatMap((day) =>
    day.stops.map((stop) => ({ stop, dayIndex: day.dayIndex })),
  );
  if (stops.length === 0) return null;

  const attractions = stops.map((entry) => requireAttraction(entry.stop.attractionId));
  const coordinates = [
    ...(showGateway ? [ARRIVAL_GATEWAY.coordinates] : []),
    ...attractions.map((attraction) => attraction.coordinates),
  ];
  const { points, width: viewWidth, height: viewHeight } = projectAll(coordinates);
  const gatewayPoint = showGateway ? points[0] : undefined;
  const stopPoints = showGateway ? points.slice(1) : points;

  return (
    <figure className={cn('flex flex-col gap-md', className)}>
      <div
        className="relative overflow-hidden rounded-card surface-outline"
        style={{ backgroundColor: 'var(--route-plate)' }}
      >
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`여행경로 지도 — 방문지 ${stops.length}곳`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--region-gwangju-mark)" />
              <stop offset="100%" stopColor="var(--region-jeonnam-mark)" />
            </linearGradient>
          </defs>

          {/*
            배경 눈금.

            촘촘한 격자는 «모눈종이» 인상을 줘 경로보다 눈에 먼저 들어온다.
            거리 감각을 잡아 줄 최소한만 남기고, 색도 한 단계 물려 뒤로 보낸다.
          */}
          <g stroke="var(--route-plate-line)" strokeWidth="0.12" aria-hidden>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={`h${fraction}`}
                x1="0"
                y1={viewHeight * fraction}
                x2={viewWidth}
                y2={viewHeight * fraction}
              />
            ))}
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={`v${fraction}`}
                x1={viewWidth * fraction}
                y1="0"
                x2={viewWidth * fraction}
                y2={viewHeight}
              />
            ))}
          </g>

          {/* 관문 → 첫 방문지 */}
          {gatewayPoint && stopPoints[0] ? (
            <path
              d={curveBetween(gatewayPoint, stopPoints[0])}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth="0.7"
              strokeDasharray="2 1.8"
              strokeLinecap="round"
            />
          ) : null}

          {/* 방문지 사이 경로. 날이 바뀌는 구간은 숙박 이동이므로 점선으로 끊는다. */}
          {stopPoints.slice(1).map((point, index) => {
            const from = stopPoints[index];
            if (!from) return null;
            const crossesDay = stops[index]?.dayIndex !== stops[index + 1]?.dayIndex;
            return (
              <path
                key={`leg-${index}`}
                d={curveBetween(from, point)}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={crossesDay ? 0.7 : 1.1}
                strokeDasharray={crossesDay ? '2 1.8' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-fade-in"
              />
            );
          })}

          {/* 도착 관문 */}
          {gatewayPoint ? (
            <g>
              <rect
                x={gatewayPoint.x - 1.8}
                y={gatewayPoint.y - 1.8}
                width="3.6"
                height="3.6"
                rx="1"
                className="fill-content-muted"
                stroke="var(--route-plate)"
                strokeWidth="0.7"
              />
              <text
                x={gatewayPoint.x}
                y={gatewayPoint.y + GATEWAY_LABEL_OFFSET[pickGatewayLabelSide(gatewayPoint, stopPoints)]}
                textAnchor="middle"
                className="fill-content-muted"
                style={{ fontSize: '3px' }}
              >
                {ARRIVAL_GATEWAY.name}
              </text>
            </g>
          ) : null}

          {/* 방문지 노드 */}
          {stopPoints.map((point, index) => {
            const entry = stops[index];
            const attraction = attractions[index];
            if (!entry || !attraction) return null;
            const isChanged = changed.has(entry.stop.id);

            return (
              <g key={entry.stop.id} className="animate-rise-in">
                {/* 재구성으로 새로 들어온 방문지에는 강조 링을 두른다. */}
                {isChanged ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4.6"
                    fill="none"
                    className="stroke-accent"
                    strokeWidth="0.9"
                  />
                ) : null}
                {/*
                  테두리는 바닥판 색으로 두른다.
                  노드가 겹쳐도 서로 파고들지 않고 «위에 놓인 것»으로 읽힌다.
                */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.1"
                  className={REGION_NODE_CLASS[attraction.region]}
                  stroke="var(--route-plate)"
                  strokeWidth="0.8"
                />
                <text
                  x={point.x}
                  y={point.y + 1.15}
                  textAnchor="middle"
                  className="fill-surface-page font-bold"
                  style={{ fontSize: '3.2px' }}
                >
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute top-sm right-sm flex gap-2xs">
          <Badge size="sm" tone="gwangju">
            {REGION_LABELS.gwangju}
          </Badge>
          <Badge size="sm" tone="jeonnam">
            {REGION_LABELS.jeonnam}
          </Badge>
        </div>
      </div>

      <figcaption className="flex flex-col gap-sm">
        {days.map((day) => {
          const firstIndex = stops.findIndex((entry) => entry.dayIndex === day.dayIndex);
          return (
            <div key={day.dayIndex}>
              <p className="text-caption font-semibold text-content-muted">{day.title}</p>
              <ol className="mt-2xs flex flex-wrap gap-x-md gap-y-2xs">
                {day.stops.map((stop, offset) => {
                  const attraction = requireAttraction(stop.attractionId);
                  return (
                    <li
                      key={stop.id}
                      className="flex items-center gap-2xs text-caption text-content-secondary"
                    >
                      <span
                        className={cn(
                          'grid size-[1.5em] shrink-0 place-items-center rounded-pill text-micro font-bold text-surface-page',
                          attraction.region === 'gwangju' ? 'bg-gwangju-mark' : 'bg-jeonnam-mark',
                        )}
                        data-numeric=""
                      >
                        {firstIndex + offset + 1}
                      </span>
                      <span className="text-content">{attraction.name}</span>
                      <span className="text-content-subtle" data-numeric="">
                        {formatClock(stop.startMinutes)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </figcaption>
    </figure>
  );
}
