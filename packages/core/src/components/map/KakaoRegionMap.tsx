'use client';

import { useEffect, useRef, useState } from 'react';
import {
  GWANGJU_DISTRICTS,
  districtAttractions,
  districtIntensity,
  type GwangjuDistrict,
} from '../../data/gwangjuDistricts';
import { cn } from '../../lib/cn';
import { resolveTokenColor } from '../../design/tokens';
import {
  loadKakaoMaps,
  type KakaoLoadState,
  type KakaoMap,
  type KakaoOverlay,
  type KakaoPolygon,
} from './kakaoLoader';

/**
 * 카카오맵 위에 광주 자치구를 얹은 지도.
 *
 * ── 실제 지도를 쓰는 이유와 대가 ───────────────────────────────────
 * 실제 지도는 도로·지명·건물이 함께 보여 «내가 아는 그 동네»로 읽힌다.
 * 대신 **타일을 카카오 서버에서 받아 오므로 네트워크가 없으면 아무것도 안 나온다.**
 * 전시장 키오스크는 오프라인 구동이 요구사항이라, 지도를 못 쓰는 상황이
 * 예외가 아니라 정상적으로 일어난다. 그래서 이 컴포넌트는 실패하면
 * `onUnavailable` 로 알리고, 화면은 오프라인용 안내도로 되돌린다.
 *
 * ── 경계는 어디서 오는가 ───────────────────────────────────────────
 * SVG 안내도와 **같은 원본**(통계청 시군구 경계)에서 뽑은 위경도를 쓴다.
 * 두 지도가 다른 자료를 쓰면 한쪽만 갱신됐을 때 경계가 어긋난다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 광주 전역이 화면에 들어오는 초기 중심과 배율. */
const INITIAL_CENTER = { lat: 35.1595, lng: 126.8526 };
const INITIAL_LEVEL = 9;

/** 자원 수 단계별 면 색. 안내도와 같은 토큰을 읽어 두 지도의 색이 갈라지지 않게 한다. */
const INTENSITY_TOKENS = [
  'map-district-0',
  'map-district-1',
  'map-district-2',
  'map-district-3',
] as const;

export interface KakaoRegionMapProps {
  appKey?: string;
  selectedId?: string;
  onSelect: (district: GwangjuDistrict) => void;
  /** 지도를 쓸 수 없을 때 알린다. 화면이 안내도로 되돌릴 수 있도록. */
  onUnavailable?: () => void;
  className?: string;
}

export function KakaoRegionMap({
  appKey,
  selectedId,
  onSelect,
  onUnavailable,
  className,
}: KakaoRegionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /*
    처음부터 «불러오는 중»으로 시작한다.
    effect 안에서 곧바로 상태를 바꾸면 렌더가 한 번 더 도는데, 얻는 것 없이 깜빡임만 는다.
  */
  const [state, setState] = useState<KakaoLoadState>('loading');

  /*
    지도 객체와 도형은 React 가 아니라 카카오 SDK 가 소유한다.
    상태로 두면 렌더마다 지도를 다시 만들게 되므로 ref 에 담아 수명을 직접 관리한다.
  */
  const mapRef = useRef<KakaoMap | null>(null);
  const shapesRef = useRef<Map<string, { polygons: KakaoPolygon[]; overlay: KakaoOverlay }>>(
    new Map(),
  );

  /*
    최신 선택 처리기를 지도 재생성 없이 쓰기 위한 통로.
    렌더 도중에 ref 를 건드리면 동시성 렌더에서 버려질 값을 쓸 수 있으므로 effect 에서만 넣는다.
  */
  const selectHandler = useRef(onSelect);
  useEffect(() => {
    selectHandler.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    // 정리 시점에 ref 가 이미 바뀌어 있을 수 있으므로 지금 값을 붙잡아 둔다.
    const shapes = shapesRef.current;

    void loadKakaoMaps(appKey).then((ok) => {
      if (cancelled) return;
      if (!ok || !containerRef.current) {
        setState('unavailable');
        onUnavailable?.();
        return;
      }

      const kakao = window.kakao;
      if (!kakao) {
        setState('unavailable');
        onUnavailable?.();
        return;
      }
      const map = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(INITIAL_CENTER.lat, INITIAL_CENTER.lng),
        level: INITIAL_LEVEL,
      });
      mapRef.current = map;

      for (const district of GWANGJU_DISTRICTS) {
        const count = districtAttractions(district).length;
        const fill = resolveTokenColor(INTENSITY_TOKENS[districtIntensity(count)]!, '#e5e8eb');

        const polygons = district.boundary.map((ring) => {
          const polygon = new kakao.maps.Polygon({
            path: ring.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng)),
            strokeWeight: 2,
            strokeColor: resolveTokenColor('map-outline', '#b0b8c1'),
            strokeOpacity: 0.9,
            fillColor: fill,
            fillOpacity: 0.65,
          });
          polygon.setMap(map);

          // 면 전체가 터치 대상이다. 라벨만 누르게 하면 손가락으로는 맞히기 어렵다.
          kakao.maps.event.addListener(polygon, 'click', () => selectHandler.current(district));
          return polygon;
        });

        /*
          이름표는 지도의 지명 위에 얹히므로, 배경 없이 글자만 두면 읽히지 않는다.
          작은 판을 깔고 그 위에 이름과 자원 수를 적는다.
        */
        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(district.labelLatLng[0], district.labelLatLng[1]),
          content: labelMarkup(district.name, count),
          yAnchor: 0.5,
          clickable: true,
        });
        overlay.setMap(map);

        shapes.set(district.id, { polygons, overlay });
      }

      setState('ready');
    });

    return () => {
      cancelled = true;
      for (const { polygons, overlay } of shapes.values()) {
        for (const polygon of polygons) polygon.setMap(null);
        overlay.setMap(null);
      }
      shapes.clear();
      mapRef.current = null;
    };
  }, [appKey, onUnavailable]);

  /* 고른 구만 색과 테두리를 바꾼다. 지도를 다시 만들지 않고 도형 속성만 손댄다. */
  useEffect(() => {
    if (state !== 'ready') return;
    const selectedFill = resolveTokenColor('map-selected-surface', '#3182f6');

    for (const district of GWANGJU_DISTRICTS) {
      const shape = shapesRef.current.get(district.id);
      if (!shape) continue;

      const isSelected = district.id === selectedId;
      const count = districtAttractions(district).length;
      const restFill = resolveTokenColor(INTENSITY_TOKENS[districtIntensity(count)]!, '#e5e8eb');

      for (const polygon of shape.polygons) {
        polygon.setOptions({
          fillColor: isSelected ? selectedFill : restFill,
          fillOpacity: isSelected ? 0.75 : 0.65,
          strokeWeight: isSelected ? 4 : 2,
          strokeColor: isSelected
            ? resolveTokenColor('map-selected-surface', '#3182f6')
            : resolveTokenColor('map-outline', '#b0b8c1'),
        });
      }
      shape.overlay.setContent(labelMarkup(district.name, count, isSelected));
    }
  }, [selectedId, state]);

  if (state === 'unavailable') return null;

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full overflow-hidden rounded-card', className)}
      role="application"
      aria-label="광주광역시 자치구 지도"
    />
  );
}

/**
 * 이름표 마크업.
 *
 * 카카오 오버레이는 React 가 아니라 문자열 HTML 을 받는다. 그래서 여기서만 예외적으로
 * 마크업을 직접 만든다. 색은 토큰에서 읽어 오므로 테마를 바꾸면 함께 따라온다.
 */
function labelMarkup(name: string, count: number, isSelected = false): string {
  const surface = isSelected
    ? resolveTokenColor('map-selected-surface', '#3182f6')
    : resolveTokenColor('surface-card', '#ffffff');
  const ink = isSelected
    ? resolveTokenColor('map-selected-on', '#ffffff')
    : resolveTokenColor('content', '#191f28');
  const sub = isSelected
    ? resolveTokenColor('map-selected-on', '#ffffff')
    : resolveTokenColor('content-muted', '#4e5968');

  return [
    `<div style="transform:translate(-50%,-50%);background:${surface};color:${ink};`,
    'border-radius:10px;padding:6px 12px;box-shadow:0 2px 10px rgba(0,0,0,.18);',
    'font-weight:700;line-height:1.25;text-align:center;white-space:nowrap;pointer-events:none;">',
    `<div style="font-size:15px">${name}</div>`,
    `<div style="font-size:12px;font-weight:600;opacity:.85;color:${sub}">관광자원 ${count}곳</div>`,
    '</div>',
  ].join('');
}
