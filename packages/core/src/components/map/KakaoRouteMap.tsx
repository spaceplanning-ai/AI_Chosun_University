'use client';

import { useEffect, useRef, useState } from 'react';
import { ARRIVAL_GATEWAY } from '../../config/scoring';
import { requireAttraction } from '../../data/attractions';
import type { ItineraryDay } from '../../domain/types/itinerary';
import { resolveTokenColor } from '../../design/tokens';
import { cn } from '../../lib/cn';
import {
  loadKakaoMaps,
  type KakaoLoadState,
  type KakaoMapWithBounds,
  type KakaoOverlay,
  type KakaoShape,
} from './kakaoLoader';

/**
 * 카카오맵 위에 여행경로를 얹은 지도 (제안서 12.3 "지도 기반 여행경로").
 *
 * 실제 지도를 쓰면 «담양이 광주 바로 위»라는 감각이 도로와 지명으로 함께 전달된다.
 * 다만 타일을 카카오 서버에서 받으므로 오프라인에서는 아무것도 나오지 않는다.
 * 그래서 실패를 `onUnavailable` 로 알리고, 화면은 좌표 기반 SVG 지도로 되돌린다.
 *
 * 방문지 번호를 마커 대신 **커스텀 오버레이**로 그리는 이유는,
 * 카카오 기본 마커에는 순번을 넣을 수 없어 «몇 번째로 가는 곳인가»가 사라지기 때문이다.
 * 그 순번이 이 지도의 핵심 정보다.
 */

export interface KakaoRouteMapProps {
  days: readonly ItineraryDay[];
  appKey?: string;
  /** 도착 관문(광주송정역)을 출발점으로 표시할지. */
  showGateway?: boolean;
  onUnavailable?: () => void;
  className?: string;
}

export function KakaoRouteMap({
  days,
  appKey,
  showGateway = true,
  onUnavailable,
  className,
}: KakaoRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<KakaoLoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    const drawn: (KakaoShape | KakaoOverlay)[] = [];

    void loadKakaoMaps(appKey).then((ok) => {
      if (cancelled) return;
      const kakao = window.kakao;
      if (!ok || !kakao || !containerRef.current) {
        setState('unavailable');
        onUnavailable?.();
        return;
      }

      const stops = days.flatMap((day) =>
        day.stops.map((stop) => ({ stop, dayIndex: day.dayIndex })),
      );
      if (stops.length === 0) {
        setState('unavailable');
        onUnavailable?.();
        return;
      }

      const attractions = stops.map((entry) => requireAttraction(entry.stop.attractionId));
      const map = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(
          attractions[0]!.coordinates.lat,
          attractions[0]!.coordinates.lng,
        ),
        level: 9,
      }) as KakaoMapWithBounds;

      const bounds = new kakao.maps.LatLngBounds();
      const gwangju = resolveTokenColor('gwangju', '#245f93');
      const jeonnam = resolveTokenColor('jeonnam', '#14624a');

      const toLatLng = (point: { lat: number; lng: number }) =>
        new kakao.maps.LatLng(point.lat, point.lng);

      if (showGateway) {
        const gateway = toLatLng(ARRIVAL_GATEWAY.coordinates);
        bounds.extend(gateway);

        const line = new kakao.maps.Polyline({
          path: [gateway, toLatLng(attractions[0]!.coordinates)],
          strokeWeight: 4,
          strokeColor: resolveTokenColor('content-subtle', '#8b95a1'),
          strokeOpacity: 0.9,
          // 관문에서 첫 방문지까지는 «여정 밖의 이동»이라 점선으로 끊는다.
          strokeStyle: 'shortdash',
        });
        line.setMap(map);
        drawn.push(line);

        const marker = new kakao.maps.CustomOverlay({
          position: gateway,
          content: gatewayMarkup(ARRIVAL_GATEWAY.name),
          yAnchor: 0.5,
        });
        marker.setMap(map);
        drawn.push(marker);
      }

      // 날이 바뀌는 구간은 숙박 이동이므로 끊어 그린다. 이어 그리면 그 날 안에 이동한 것처럼 읽힌다.
      for (let index = 1; index < attractions.length; index += 1) {
        const crossesDay = stops[index - 1]!.dayIndex !== stops[index]!.dayIndex;
        const line = new kakao.maps.Polyline({
          path: [
            toLatLng(attractions[index - 1]!.coordinates),
            toLatLng(attractions[index]!.coordinates),
          ],
          strokeWeight: crossesDay ? 4 : 6,
          strokeColor: resolveTokenColor('brand', '#3182f6'),
          strokeOpacity: crossesDay ? 0.55 : 0.9,
          strokeStyle: crossesDay ? 'shortdash' : 'solid',
        });
        line.setMap(map);
        drawn.push(line);
      }

      attractions.forEach((attraction, index) => {
        const position = toLatLng(attraction.coordinates);
        bounds.extend(position);

        const overlay = new kakao.maps.CustomOverlay({
          position,
          content: stopMarkup(
            index + 1,
            attraction.name,
            attraction.region === 'gwangju' ? gwangju : jeonnam,
          ),
          yAnchor: 0.5,
        });
        overlay.setMap(map);
        drawn.push(overlay);
      });

      // 모든 지점이 한 화면에 들어오게 맞춘다. 사람이 끌어서 찾게 하면 안 된다.
      map.setBounds(bounds, 40);
      setState('ready');
    });

    return () => {
      cancelled = true;
      for (const shape of drawn) shape.setMap(null);
    };
  }, [appKey, days, showGateway, onUnavailable]);

  if (state === 'unavailable') return null;

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full overflow-hidden rounded-card', className)}
      role="application"
      aria-label={`여행경로 지도 — 방문지 ${days.reduce((sum, day) => sum + day.stops.length, 0)}곳`}
    />
  );
}

/** 방문지 표식 — 순번 원과 이름표. 카카오 오버레이는 문자열 HTML 만 받는다. */
function stopMarkup(order: number, name: string, color: string): string {
  const surface = resolveTokenColor('surface-card', '#ffffff');
  const ink = resolveTokenColor('content', '#191f28');

  return [
    '<div style="transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;pointer-events:none">',
    `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:999px;`,
    `background:${color};color:#fff;font-weight:700;font-size:14px;border:2px solid ${surface};`,
    `box-shadow:0 2px 8px rgba(0,0,0,.25)">${order}</span>`,
    `<span style="background:${surface};color:${ink};border-radius:8px;padding:3px 8px;`,
    'font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.18)">',
    `${name}</span>`,
    '</div>',
  ].join('');
}

/** 관문 표식 — 방문지가 아니므로 순번을 주지 않고 네모로 구분한다. */
function gatewayMarkup(name: string): string {
  const ink = resolveTokenColor('content-muted', '#4e5968');
  const surface = resolveTokenColor('surface-card', '#ffffff');

  return [
    '<div style="transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;pointer-events:none">',
    `<span style="width:18px;height:18px;border-radius:5px;background:${ink};border:2px solid ${surface}"></span>`,
    `<span style="background:${surface};color:${ink};border-radius:8px;padding:3px 8px;`,
    'font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.15)">',
    `${name}</span>`,
    '</div>',
  ].join('');
}
