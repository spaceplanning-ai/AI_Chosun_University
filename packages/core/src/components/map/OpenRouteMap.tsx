'use client';

import { useEffect, useRef } from 'react';
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ARRIVAL_GATEWAY } from '../../config/scoring';
import { requireAttraction } from '../../data/attractions';
import type { ItineraryDay } from '../../domain/types/itinerary';
import { resolveTokenColor } from '../../design/tokens';
import { cn } from '../../lib/cn';

/**
 * 열린 지도 위에 여행경로를 얹은 지도.
 *
 * ── 왜 이것이 필요한가 ─────────────────────────────────────────────
 * 결과화면의 지도는 원래 카카오맵으로 그리도록 되어 있었다. 그런데 카카오맵은
 * **키**와 **등록한 도메인**이 있어야 뜨고, 지금 전달받은 값은 브라우저용이 아닌
 * REST 키다. 그래서 실제로는 늘 좌표만 찍은 도형 지도로 되돌아가고 있었고,
 * 「담양이 광주 바로 위」 같은 감각은 전달되지 않았다.
 *
 * 대기화면이 쓰는 열린 지도는 키도 도메인 등록도 없이 곧바로 뜬다.
 * 같은 지도를 결과화면에도 쓰면 열쇠를 기다리지 않고 실제 지도를 보여 줄 수 있다.
 * 카카오 열쇠가 준비되면 그때는 카카오맵이 먼저 쓰이고, 이 지도가 그 다음이 된다.
 *
 * ── 무엇을 그리는가 ────────────────────────────────────────────────
 * 방문 순서를 잇는 선 하나와, 순번이 적힌 표식이다. 순번이 이 지도의 핵심이다 —
 * 어디에 있는지보다 «어떤 차례로 도는지»가 일정에서 알아야 할 것이기 때문이다.
 *
 * 하루씩 색을 달리한다. 여러 날 일정을 한 장에 얹으면 선이 서로 겹치는데,
 * 색이 같으면 «둘째 날에 되돌아온 것»과 «첫날에 그렇게 돌았던 것»이 구분되지 않는다.
 */

/** 바탕 지도 타일. 대기화면과 같은 값을 쓴다 — 두 화면의 지도가 달라 보이면 안 된다. */
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';

/** 타일 일꾼. `npm run map:worker` 가 정적 폴더로 복사해 둔다. */
const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

const ROUTE_SOURCE = 'route';

/** 하루치 경로선 하나. 색은 선 자체가 들고 있어 레이어가 날짜를 알 필요가 없다. */
type RouteLine = {
  type: 'Feature';
  properties: { color: string };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
};

/** 표식이 가장자리에 붙지 않도록 두는 여백(px). 순번 표식이 잘리면 순서를 못 읽는다. */
const FIT_PADDING = { top: 48, right: 48, bottom: 36, left: 48 };

/**
 * 날짜별 선 색.
 *
 * 지역 색(광주·전남)을 쓰지 않는다 — 그 색은 «어느 지역인가»를 뜻하는 자리에 이미
 * 쓰이고 있어, 같은 색을 날짜에 쓰면 화면 안에서 뜻이 둘이 된다.
 */
const DAY_COLOR_TOKENS = ['accent', 'brand', 'positive', 'caution'] as const;

export interface OpenRouteMapProps {
  days: readonly ItineraryDay[];
  /** 도착 관문(광주송정역)을 출발점으로 표시할지. */
  showGateway?: boolean;
  /** 타일을 받아 오지 못했을 때. 화면은 오프라인용 도형 지도로 되돌린다. */
  onUnavailable?: () => void;
  /** 바탕 타일 주소. 자체 타일 서버로 바꿀 때만 넘긴다. */
  tileUrl?: string;
  className?: string;
}

export function OpenRouteMap({
  days,
  showGateway = true,
  onUnavailable,
  tileUrl = DEFAULT_TILE_URL,
  className,
}: OpenRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>(null);
  const markersRef = useRef<Marker[]>([]);

  /*
    지도는 한 번만 만든다.

    일정이 바뀔 때마다 지도를 새로 만들면 타일을 처음부터 다시 받는다. 재구성을
    누를 때마다 바탕이 하얗게 비었다 채워지므로, 지도는 두고 얹은 것만 갈아 끼운다.
  */
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    setWorkerUrl(WORKER_URL);

    const map = new MapLibreMap({
      container,
      style: {
        version: 8,
        sources: {
          base: { type: 'raster', tiles: [tileUrl], tileSize: 256, maxzoom: 19, attribution: ATTRIBUTION },
        },
        layers: [
          {
            id: 'base',
            type: 'raster',
            source: 'base',
            // 바탕에서 색을 뺀다. 그래야 얹은 경로선이 «또 하나의 색»으로 묻히지 않는다.
            paint: { 'raster-saturation': -0.85, 'raster-contrast': -0.1 },
          },
        ],
      },
      // 전시용이라 회전·기울임은 막는다. 지도를 뒤집어 놓고 헤매는 일이 없어야 한다.
      pitchWithRotate: false,
      dragRotate: false,
      doubleClickZoom: false,
      attributionControl: false,
      center: [ARRIVAL_GATEWAY.coordinates.lng, ARRIVAL_GATEWAY.coordinates.lat],
      zoom: 8.5,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right');

    /*
      칸의 크기가 바뀌면 지도에게 알린다.

      지도는 만들어질 때 잰 크기를 그대로 들고 있다. 결과화면은 위에서부터 차례로
      쌓이며 폭이 정해지므로, 지도를 만든 순간의 폭이 최종 폭이 아니다. 알려 주지
      않으면 **칸의 일부만 지도가 그려지고 나머지는 흰 자리로 남는다.**
    */
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    let told = false;
    map.on('error', (event) => {
      const source = (event as { sourceId?: string }).sourceId;
      if (source !== 'base') {
        // 바탕이 아닌 데서 난 오류는 우리가 잘못 넘긴 것이다. 전시 중에는 조용히 둔다.
        if (process.env.NODE_ENV !== 'production') console.warn('[route-map]', event.error ?? event);
        return;
      }
      if (told) return;
      told = true;
      onUnavailable?.();
    });

    map.on('load', () => {
      map.addSource(ROUTE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
    });

    return () => {
      observer.disconnect();
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [tileUrl, onUnavailable]);

  /*
    일정이 바뀌면 선과 표식만 다시 얹는다.

    지도가 아직 style 을 다 읽지 않았을 수 있으므로 `load` 이후를 기다린다 —
    그 전에 source 를 만지면 «없는 source» 오류가 난다.
  */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const paint = () => {
      /*
        타입만으로는 어떤 종류의 source 인지 좁혀지지 않는다.
        우리가 만든 것이 GeoJSON source 임을 여기서 확인하고 쓴다.
      */
      const source = map.getSource(ROUTE_SOURCE);
      if (!(source instanceof GeoJSONSource)) return;

      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];

      const bounds = new LngLatBounds();
      const lines: RouteLine[] = [];

      if (showGateway) {
        const gateway: [number, number] = [
          ARRIVAL_GATEWAY.coordinates.lng,
          ARRIVAL_GATEWAY.coordinates.lat,
        ];
        bounds.extend(gateway);

        const element = document.createElement('div');
        element.className = 'route-pin route-pin--gateway';
        element.innerHTML = `<span class="route-pin__mark">출발</span><span class="route-pin__name">${ARRIVAL_GATEWAY.name}</span>`;
        markersRef.current.push(new Marker({ element }).setLngLat(gateway).addTo(map));
      }

      /*
        순번은 날짜를 가로질러 이어 붙인다.

        날짜마다 1부터 다시 매기면 한 지도 위에 「1」이 둘 생겨, 어느 것이 먼저인지
        지도만 보고는 알 수 없다. 도형 지도(RouteMap)도 같은 규칙으로 매긴다.
      */
      let stopNumber = 0;

      days.forEach((day, dayOrder) => {
        const token = DAY_COLOR_TOKENS[dayOrder % DAY_COLOR_TOKENS.length]!;
        const color = resolveTokenColor(token, '#3182f6');
        const path: [number, number][] = [];

        /*
          첫날 선은 도착 관문에서 시작한다.
          «역에서 내려 어디로 가는가»가 첫날 동선의 절반이라, 그 구간이 빠지면
          첫 방문지가 어디서 튀어나온 것처럼 보인다.
        */
        if (dayOrder === 0 && showGateway) {
          path.push([ARRIVAL_GATEWAY.coordinates.lng, ARRIVAL_GATEWAY.coordinates.lat]);
        }

        day.stops.forEach((stop) => {
          stopNumber += 1;
          const attraction = requireAttraction(stop.attractionId);
          const point: [number, number] = [attraction.coordinates.lng, attraction.coordinates.lat];
          path.push(point);
          bounds.extend(point);

          const element = document.createElement('div');
          element.className = 'route-pin';
          element.style.setProperty('--route-pin-color', color);
          element.innerHTML = `<span class="route-pin__mark" data-numeric>${stopNumber}</span><span class="route-pin__name">${attraction.name}</span>`;
          markersRef.current.push(new Marker({ element }).setLngLat(point).addTo(map));
        });

        if (path.length > 1) {
          lines.push({
            type: 'Feature',
            properties: { color },
            geometry: { type: 'LineString', coordinates: path },
          });
        }
      });

      source.setData({ type: 'FeatureCollection', features: lines });

      // 방문지가 하나뿐이면 경계가 점 하나라 확대가 끝까지 들어간다. 그때는 배율을 못 박는다.
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 12, duration: 600 });
      }
    };

    if (map.isStyleLoaded()) paint();
    else map.once('load', paint);
  }, [days, showGateway]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <div ref={containerRef} className="h-full w-full" />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-card/80 px-xs py-[0.15rem] text-center text-micro text-content-subtle">
        {ATTRIBUTION}
      </p>
    </div>
  );
}
