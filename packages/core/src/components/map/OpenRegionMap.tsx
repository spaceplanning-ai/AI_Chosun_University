'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ATTRACTIONS } from '../../data/attractions';
import {
  NAMDO_AREAS,
  NAMDO_PROVINCES,
  SERVICE_AREAS,
  areaAttractions,
  areaIntensity,
  type NamdoArea,
} from '../../data/namdoAreas';
import { cn } from '../../lib/cn';
import { resolveTokenColor } from '../../design/tokens';

/**
 * 열린 지도 위에 남도 행정구역을 얹은 안내도.
 *
 * 그리는 범위는 광주·전남·전북이고, **다루는 범위는 광주·전남**이다.
 * 전북은 전남 위쪽이 회색으로 잘려 보이지 않게 하려고 함께 그릴 뿐이다.
 *
 * ── 왜 카카오맵이 아니라 이것인가 ──────────────────────────────────
 * 카카오맵은 **키**와 **등록한 도메인**이 있어야 뜬다. 둘 중 하나만 어긋나도
 * 화면에서는 똑같이 «안 나옴»으로 보이고, 왜 안 되는지는 브라우저가 알려 주지 않는다.
 * 이 지도는 열린 자료(OpenStreetMap)를 그대로 받아 그리므로 키도 등록도 없다.
 *
 * ── 배율에 따라 무엇을 보여 주는가 ─────────────────────────────────
 * 27개 구역과 22곳의 관광지를 한꺼번에 띄우면 이름표가 서로 겹쳐 아무것도 못 읽는다.
 * 지도 앱들이 그렇듯 **가까이 갈수록 자세히** 보여 준다.
 *
 *   멀리서(－)  자원이 있는 구역만 이름표 — 어디부터 볼지 고르는 단계
 *   중간        모든 구역 이름표 — 시군 단위로 훑는 단계
 *   가까이(＋)  관광지 개별 표식 — 무엇이 있는지 보는 단계
 *
 * ── 오프라인이면 어떻게 되는가 ─────────────────────────────────────
 * 타일을 받아 오지 못하면 바탕이 비고, 그때는 `onUnavailable` 로 알려
 * 화면이 오프라인용 안내도로 되돌아간다. 전시장 사정이 바뀌어도 화면은 남는다.
 *
 * ── 왜 글자를 지도 레이어로 그리지 않는가 ──────────────────────────
 * 지도 안에서 글자를 그리려면 글리프(글자 그림) 서버가 따로 필요하고,
 * 한글은 그 서버에 없는 경우가 많아 네모로 나온다. 이름표는 HTML 로 얹는다 —
 * 우리 폰트를 그대로 쓰고, 색도 토큰을 따른다.
 */

/**
 * 바탕 지도 타일.
 *
 * 기본값은 OpenStreetMap 공식 타일이다. 열쇠가 필요 없고 출처만 밝히면 된다.
 * 다른 곳(자체 서버·유료 서비스)으로 바꾸려면 이 값만 넘기면 된다.
 */
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';

/**
 * 타일을 만드는 일꾼 파일의 주소.
 *
 * 이 파일은 `npm run map:worker` 가 라이브러리에서 정적 폴더로 복사해 둔다(개발·빌드 전에 자동으로 돈다).
 * 주소를 직접 알려 주지 않으면 Next 가 꾸러미를 다시 묶는 과정에서 일꾼을 못 찾고,
 * **바탕 지도는 나오는데 얹은 경계가 하나도 안 그려진다** — 오류도 없이 조용히.
 */
const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

/**
 * 배율 경계.
 *
 * 눈으로 맞춘 값이다. 이 아래에서는 이름표가 서로 붙어 읽히지 않고,
 * 이 위에서는 화면이 헐거워진다.
 */
const ZOOM = {
  /**
   * 이 배율 **아래**에서는 시·도 이름만 보인다.
   *
   * 그만큼 멀어지면 시군 이름표는 서로 밀어내다 몇 개만 남는데, 그 몇 개는
   * «남은 것»일 뿐 «중요한 것»이 아니다. 그 배율에서 알아야 할 것은
   * «여기가 전남, 저기가 전북»이므로 시군은 통째로 접고 시·도만 남긴다.
   */
  provinces: 8.4,
  /** 이 배율부터 자원이 없는 구역의 이름표도 보인다. */
  allAreas: 9.2,
  /**
   * 이 배율부터 이름표에 건수가 붙는다.
   *
   * 멀리서는 «여기가 어디인가»만 알면 된다. 건수까지 붙으면 이름표가 길어져
   * 서로 밀어내고, 정작 지명이 몇 개 안 남는다. 셀 것을 보는 것은 한 발 들어온 뒤다.
   */
  counts: 10,
  /** 이 배율부터 관광지 개별 표식이 보인다. */
  spots: 11,
};

/** 경계와 화면 가장자리 사이 여백(픽셀). 이름표가 잘리지 않을 최소한만 둔다. */
const FIT_PADDING = 12;

/** 자원 수 단계별 면 색. 손으로 그린 안내도와 같은 토큰을 읽어 두 지도의 색이 갈라지지 않게 한다. */
const INTENSITY_TOKENS = [
  'map-district-0',
  'map-district-1',
  'map-district-2',
  'map-district-3',
] as const;

/**
 * 이름표끼리 두는 최소 간격(픽셀).
 *
 * 딱 붙어 있으면 겹치지 않아도 한 덩어리로 보여 어느 글자가 어느 구역 것인지 흐려진다.
 */
const LABEL_GAP = 6;

/** 화면 위 사각형. 이름표가 서로 부딪히는지 볼 때만 쓴다. */
interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(
    a.right + LABEL_GAP < b.left ||
    b.right + LABEL_GAP < a.left ||
    a.bottom + LABEL_GAP < b.top ||
    b.bottom + LABEL_GAP < a.top
  );
}

/** 지도에 얹은 이름표 하나. 겹침을 볼 때 필요한 것만 들고 있다. */
interface Label {
  element: HTMLElement;
  lngLat: [number, number];
  /** 클수록 먼저 자리를 얻는다. 자원이 많은 구역이 먼저 남는다. */
  priority: number;
  /** 건수까지 붙은 모습의 크기. */
  size: { width: number; height: number };
  /**
   * 이름만 남은 모습의 크기.
   *
   * 두 모습을 미리 재 두는 까닭은, 건수가 빠지면 이름표가 짧아져 겹침 판정이 달라지기 때문이다.
   * 그때 다시 재면 지도를 움직일 때마다 브라우저가 배치를 다시 돌려 끊긴다.
   */
  nameSize?: { width: number; height: number };
}

/**
 * 관광유형별 아이콘.
 *
 * ── 왜 글자 대신 그림인가 ──────────────────────────────────────────
 * 표식이 점 하나면 «뭔가 있다»까지만 전해진다. 지도를 훑는 사람은 그 앞에서
 * 하나하나 이름을 읽어야 무엇인지 안다. 그림이 붙으면 훑는 동안 걸러진다 —
 * 숲을 찾는 사람은 나무 표식만 눈에 들어온다.
 *
 * 그림은 화면 어디서나 같은 뜻이어야 하므로 관광지의 **첫 관심유형**을 따른다.
 * 마커는 React 가 아니라 DOM 이라 SVG 를 글자로 적어 넣는다.
 */
const CATEGORY_ICON: Record<string, string> = {
  culture: '<path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" />',
  nature: '<path d="M12 3 5 13h4l-3 5h12l-3-5h4L12 3ZM12 18v3" />',
  sea: '<path d="M3 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2M3 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />',
  food: '<path d="M7 3v9a3 3 0 0 0 3 3v6M7 3v5M11 3v5M17 3c-1.5 2-2 4-2 6a2 2 0 0 0 2 2v10" />',
  photo: '<path d="M4 8h3l2-2h6l2 2h3v11H4V8Z" /><circle cx="12" cy="13" r="3" />',
  history: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />',
  activity: '<path d="m13 3-6 9h5l-1 9 6-9h-5l1-9Z" />',
  rest: '<path d="M4 18h16M6 18v-5a4 4 0 0 1 4-4h8v9M9 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />',
};

/** 아이콘 하나를 SVG 로. 선 굵기와 색은 CSS 가 정한다. */
function spotIcon(category: string): string {
  const path = CATEGORY_ICON[category] ?? CATEGORY_ICON.culture;
  return [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    path,
    '</svg>',
  ].join('');
}

const SOURCE_ID = 'areas';
const FILL_LAYER = 'area-fill';
const LINE_LAYER = 'area-line';

/**
 * 지물 번호.
 *
 * MapLibre 는 «고른 것»을 지물 번호로 표시하는데, 이 번호는 **숫자여야 한다.**
 * 글자로 주면 타일을 만드는 일꾼이 조용히 멈춰 도형이 하나도 안 그려진다 —
 * 화면에는 «지도만 나오고 경계가 없는» 모습으로 보인다.
 * 통계청 시군구 코드가 숫자 문자열(24010)이라 그대로 숫자로 바꿔 쓴다.
 */
const featureId = (area: NamdoArea) => Number(area.code);

/** 구역 하나를 GeoJSON 으로. 저장된 경계는 [위도, 경도] 순이라 뒤집어 넘긴다. */
function toFeature(area: NamdoArea) {
  return {
    type: 'Feature' as const,
    id: featureId(area),
    properties: {
      code: area.code,
      fill: resolveTokenColor(
        INTENSITY_TOKENS[areaIntensity(areaAttractions(area).length)]!,
        '#e5e8eb',
      ),
    },
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: area.boundary.map((ring) => [ring.map(([lat, lng]) => [lng, lat])]),
    },
  };
}

/** 구역들을 담는 사각형. [[서, 남], [동, 북]] */
function areaBounds(
  areas: readonly NamdoArea[] = NAMDO_AREAS,
): [[number, number], [number, number]] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const area of areas) {
    for (const ring of area.boundary) {
      for (const [lat, lng] of ring) {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }
  return [
    [west, south],
    [east, north],
  ];
}

export interface OpenRegionMapProps {
  selectedId?: string;
  /**
   * 왼쪽에서 지도를 가리는 판의 폭(픽셀).
   *
   * 고른 구역을 화면 가운데로 옮길 때 이만큼을 빼고 계산한다.
   * 안 빼면 방금 고른 구역이 판 뒤에 숨어, 무엇을 눌렀는지 알 수 없게 된다.
   */
  leftInset?: number;
  onSelect: (area: NamdoArea) => void;
  /** 지도를 쓸 수 없을 때 알린다. 화면이 오프라인 안내도로 되돌릴 수 있도록. */
  onUnavailable?: () => void;
  /** 바탕 지도 타일 주소. 안 주면 OpenStreetMap 을 쓴다. */
  tileUrl?: string;
  className?: string;
}

export function OpenRegionMap({
  selectedId,
  leftInset = 0,
  onSelect,
  onUnavailable,
  tileUrl = DEFAULT_TILE_URL,
  className,
}: OpenRegionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /*
    지도와 이름표는 React 가 아니라 MapLibre 가 소유한다.
    상태로 두면 렌더마다 지도를 다시 만들게 되므로 ref 로 수명을 직접 관리한다.
  */
  const mapRef = useRef<MapLibreMap | null>(null);
  const areaMarkers = useRef<Map<string, Marker>>(new Map());
  const spotMarkers = useRef<Marker[]>([]);
  const provinceMarkers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);

  /*
    지금 고른 구역과, 표시를 다시 계산하는 함수.

    지도는 한 번만 만들고 그 안의 처리기는 계속 살아 있다. 그 처리기가 최신 선택을 보려면
    통로가 필요하다 — 지도를 다시 만들면 화면이 깜빡이고 배율도 처음으로 돌아간다.
  */
  const selectedRef = useRef<string | undefined>(selectedId);
  const visibilityRef = useRef<() => void>(undefined);

  /* 최신 처리기를 지도 재생성 없이 쓰기 위한 통로. 렌더 도중이 아니라 effect 에서만 넣는다. */
  const selectHandler = useRef(onSelect);
  useEffect(() => {
    selectHandler.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    // 지도를 만들기 전에 일꾼 주소를 못 박는다. 한 번만 정하면 이후 모든 지도가 함께 쓴다.
    setWorkerUrl(WORKER_URL);

    const map = new MapLibreMap({
      container,
      style: {
        version: 8,
        sources: {
          base: {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            maxzoom: 19,
            attribution: ATTRIBUTION,
          },
        },
        layers: [
          {
            id: 'base',
            type: 'raster',
            source: 'base',
            paint: {
              /*
                바탕에서 색을 뺀다.
                지도 원본은 초록·노랑이 강해, 그 위에 얹은 구역 색이 «또 하나의 색»으로 묻힌다.
                바탕을 무채색으로 낮추면 얹은 것만 색을 갖는다.
              */
              'raster-saturation': -0.85,
              'raster-contrast': -0.1,
            },
          },
        ],
      },
      /*
        첫 시점은 **다루는 지역**(광주·전남)에 맞춘다.
        전북까지 넣어 잡으면 정작 대상인 전남이 작아지고, 처음 보이는 범위가
        «이 서비스가 무엇을 다루는가»를 잘못 말하게 된다.
      */
      bounds: areaBounds(SERVICE_AREAS),
      fitBoundsOptions: { padding: FIT_PADDING },
      // 전시용이라 회전·기울임은 막는다. 관람객이 지도를 뒤집어 놓고 헤매는 일이 없어야 한다.
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: true,
      /*
        두 번 눌러 확대하는 동작을 막는다.

        지도 위의 구역은 «누르면 고르는 것»이다. 그런데 고르려고 두 번 누르거나,
        반응이 없는 줄 알고 한 번 더 누르면 지도가 확대되어 방금 고른 것이 화면 밖으로 나간다.
        확대는 오른쪽 아래 단추와 두 손가락 동작으로 충분하다.
      */
      doubleClickZoom: false,
      /*
        기본 출처 위젯을 끈다.

        끄는 것이 출처를 안 밝히는 것은 아니다 — OpenStreetMap 자료는 출처 표기가
        **의무**이므로, 대신 아래에 우리 글자체·색으로 같은 문구를 적어 둔다.
      */
      attributionControl: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();

    /*
      확대·축소 단추.

      두 손가락으로 벌리는 동작을 모르는 관람객이 있고, 장갑을 낀 손이나 젖은 손은
      멀티터치가 잘 안 잡힌다. 단추가 있으면 한 손가락으로도 지도를 볼 수 있다.
      나침반은 빼둔다 — 회전을 막아 두었으므로 눌러도 아무 일이 없는 단추가 된다.
    */
    map.addControl(new NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right');
    /*
      지금 배율.

      확대·축소를 눌렀을 때 «얼마나 움직였는지»가 숫자로 남아야 사람이 감을 잡는다.
      단추만 있으면 몇 번을 눌렀는지 세고 있어야 한다.
      단추 **위**에 붙이려고 나중에 더한다 — 아래쪽 모서리에서는 나중에 더한 것이 위로 쌓인다.
    */
    const zoomBadge = document.createElement('div');
    zoomBadge.className = 'maplibregl-ctrl map-zoom-level';
    const paintZoom = () => {
      zoomBadge.innerHTML = `<span class="map-zoom-level__label">레벨</span><span class="map-zoom-level__value" data-numeric>${Math.round(map.getZoom())}</span>`;
    };
    map.addControl({
      onAdd: () => {
        paintZoom();
        map.on('zoom', paintZoom);
        return zoomBadge;
      },
      onRemove: () => {
        map.off('zoom', paintZoom);
        zoomBadge.remove();
      },
    }, 'bottom-right');


    let told = false;
    map.on('error', (event) => {
      const source = (event as { sourceId?: string }).sourceId;
      /*
        바탕이 아닌 데서 난 오류는 «우리가 잘못 넘긴 것»이다. 그것까지 삼키면
        도형이 안 그려지는데 화면은 멀쩡해 보여, 무엇이 잘못됐는지 알 길이 없어진다.
        전시장에서는 조용해야 하므로 개발 중에만 알린다.
      */
      if (source !== 'base') {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[map]', event.error ?? event);
        }
        return;
      }
      if (told) return;
      told = true;
      onUnavailable?.();
    });

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: NAMDO_AREAS.map(toFeature),
        },
      });

      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          // 고른 구역만 강조색으로 바꾼다. 나머지는 자원 수 단계색을 그대로 쓴다.
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            resolveTokenColor('map-selected-surface', '#3182f6'),
            ['get', 'fill'],
          ],
          /*
            바탕이 실제 지도라 도로·지명이 비쳐 보여야 한다. 그래서 면은 옅게 깔고
            «어디까지가 이 구역인가»는 아래 선이 맡는다. 고른 구역만 진하게 덮는다.
          */
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.62, 0.45],
        },
      });

      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        /*
          이음새를 둥글게.

          경계는 자료를 줄여 그린 선이라 꺾이는 자리가 많다. 기본값(뾰족한 이음)으로 두면
          그 자리마다 바늘처럼 삐죽 튀어나와 «대충 그린 선»으로 보인다.
          둥글게 이으면 같은 좌표로도 손으로 다듬은 선처럼 읽힌다.
        */
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            resolveTokenColor('map-selected-surface', '#3182f6'),
            // 옅은 회색. 진한 색은 실제 지도의 도로·지명과 싸운다.
            resolveTokenColor('content-subtle', '#6b7684'),
          ],
          /*
            굵기는 배율을 따라간다.

            멀리서 볼 때 굵은 선은 27개가 한꺼번에 그물처럼 깔려 지도를 덮는다.
            가까이 갈수록 도로가 촘촘해지므로 그때는 경계가 도로보다 굵어야 경계로 읽힌다.
          */
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            ['interpolate', ['linear'], ['zoom'], 8, 2.5, 12, 5],
            ['interpolate', ['linear'], ['zoom'], 8, 0.8, 10, 1.4, 13, 2.4],
          ],
          /*
            선은 반투명하게 두지 않는다.

            이웃한 두 시군은 같은 경계를 각자 한 번씩 그린다. 반투명이면 그 자리만
            두 겹이 겹쳐 진해져서, 맞닿은 선만 굵고 검게 도드라진다.
            불투명하게 두면 두 번 그려도 한 번 그린 것과 같아 보인다 — 대신 색을 옅게 잡는다.
          */
          'line-opacity': 1,
        },
      });

      // 면 전체가 누르는 자리다. 이름표만 누르게 하면 손가락으로는 맞히기 어렵다.
      map.on('click', FILL_LAYER, (event) => {
        const id = (event as { features?: { id?: string | number }[] }).features?.[0]?.id;
        const area = NAMDO_AREAS.find((entry) => featureId(entry) === Number(id));
        if (area) selectHandler.current(area);
      });
      map.on('mouseenter', FILL_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', FILL_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      // 이름표는 HTML 로 얹는다 — 우리 폰트와 색을 그대로 쓰기 위함이다.
      const labels: Label[] = [];

      for (const area of NAMDO_AREAS) {
        const count = areaAttractions(area).length;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'district-pin';
        element.dataset.districtId = area.code;
        element.dataset.hasSpots = count > 0 ? 'true' : 'false';
        element.innerHTML = areaPin(area.name, count);
        element.addEventListener('click', () => selectHandler.current(area));

        areaMarkers.current.set(
          area.code,
          new Marker({ element }).setLngLat([area.labelLatLng[1], area.labelLatLng[0]]).addTo(map),
        );
        labels.push({
          element,
          lngLat: [area.labelLatLng[1], area.labelLatLng[0]],
          // 자원이 많은 구역이 먼저 자리를 얻는다. 같으면 광주가 앞선다(목록 순서를 따른다).
          priority: 1000 + count,
          size: { width: 0, height: 0 },
        });
      }

      /*
        시·도 이름표.

        누르면 그 도 전체가 화면에 들어오도록 옮겨 간다 — 멀리서 본 사람이
        다음으로 하고 싶은 일이 «저기를 자세히 보기»이기 때문이다.
      */
      for (const province of NAMDO_PROVINCES) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'province-pin';
        element.dataset.visible = 'false';
        element.textContent = province.name;
        element.addEventListener('click', () => {
          map.fitBounds(areaBounds(province.areas), { padding: FIT_PADDING, duration: 700 });
        });

        provinceMarkers.current.push(
          new Marker({ element })
            .setLngLat([province.labelLatLng[1], province.labelLatLng[0]])
            .addTo(map),
        );
        labels.push({
          element,
          lngLat: [province.labelLatLng[1], province.labelLatLng[0]],
          // 시·도는 가장 먼저 자리를 얻는다. 이 배율에서는 이것만 보이면 된다.
          priority: 2000,
          size: { width: 0, height: 0 },
        });
      }

      /*
        관광지 표식. 가까이 갔을 때만 보인다.
        구역 이름표와 함께 늘 띄우면 이름표가 서로 겹쳐 둘 다 못 읽는다.
      */
      /** 소재지 이름 → 구역 코드. 표식이 «어느 구역 것»인지 알아야 걸러 낼 수 있다. */
      const areaCodeByDistrict = new Map(
        NAMDO_AREAS.map((area) => [area.datasetDistrict, area.code]),
      );

      for (const attraction of ATTRACTIONS) {
        const element = document.createElement('div');
        element.className = 'spot-pin';
        element.dataset.visible = 'false';
        element.dataset.areaCode = areaCodeByDistrict.get(attraction.district) ?? '';
        element.innerHTML =
          `<span class="spot-pin__icon">${spotIcon(attraction.categories[0] ?? 'culture')}</span>` +
          `<span class="spot-pin__name">${attraction.name}</span>`;
        spotMarkers.current.push(
          new Marker({ element })
            .setLngLat([attraction.coordinates.lng, attraction.coordinates.lat])
            .addTo(map),
        );
        // 관광지 표식은 구역 이름표에 밀린다 — 어디인지가 먼저고, 무엇이 있는지가 그다음이다.
        labels.push({
          element,
          lngLat: [attraction.coordinates.lng, attraction.coordinates.lat],
          priority: 0,
          size: { width: 0, height: 0 },
        });
      }

      /*
        이름표 크기를 한 번만 잰다.

        글자가 바뀌지 않으므로 크기도 변하지 않는다. 움직일 때마다 재면 브라우저가
        매번 배치를 다시 계산해 지도가 끊긴다. 자리는 좌표에서 계산하고, 크기는 이 값을 쓴다.
      */
      const measure = () => {
        for (const label of labels) {
          const wasHidden = label.element.dataset.visible === 'false';
          if (wasHidden) label.element.dataset.visible = 'true';

          label.element.dataset.detail = 'full';
          label.size = { width: label.element.offsetWidth, height: label.element.offsetHeight };

          // 구역 이름표만 두 모습을 갖는다. 관광지 표식은 늘 이름 하나뿐이다.
          if (label.element.classList.contains('district-pin')) {
            label.element.dataset.detail = 'name';
            label.nameSize = {
              width: label.element.offsetWidth,
              height: label.element.offsetHeight,
            };
          }

          if (wasHidden) label.element.dataset.visible = 'false';
        }
      };

      /**
       * 지금 무엇을 보일지 정한다. 지도를 다시 그리지 않고 표시만 바꾼다.
       *
       * 배율과 «지금 고른 구역» 두 가지가 함께 정한다 — 두 곳에서 따로 손대면
       * 확대했을 때와 골랐을 때가 서로 다른 답을 내놓는다.
       */
      const applyVisibility = () => {
        const zoom = map.getZoom();
        const selected = selectedRef.current;

        // 아주 멀리서는 시·도만. 그 위로는 시·도를 접고 시군에 자리를 내준다.
        const wide = zoom < ZOOM.provinces;
        for (const marker of provinceMarkers.current) {
          marker.getElement().dataset.visible = wide ? 'true' : 'false';
        }

        for (const marker of areaMarkers.current.values()) {
          const element = marker.getElement();
          // 멀리서는 볼 곳이 있는 구역만 이름을 남긴다. 나머지는 경계로만 존재한다.
          const keep = !wide && (zoom >= ZOOM.allAreas || element.dataset.hasSpots === 'true');
          element.dataset.visible = keep ? 'true' : 'false';
          // 멀리서는 이름만. 건수는 한 발 들어온 뒤에 붙는다.
          element.dataset.detail = zoom >= ZOOM.counts ? 'full' : 'name';
        }

        for (const marker of spotMarkers.current) {
          const element = marker.getElement();
          /*
            구역을 고른 동안에는 그 구역의 관광지만 남긴다.

            고르지 않았다면 배율만 본다. 고른 뒤에도 옆 구역 표식이 남아 있으면
            왼쪽 목록은 «3곳»인데 지도에는 예닐곱 개가 찍혀, 목록과 지도가 다른 말을 한다.
          */
          const mine = selected === undefined || element.dataset.areaCode === selected;
          element.dataset.visible = zoom >= ZOOM.spots && mine ? 'true' : 'false';
        }

        /*
          여기까지 살아남은 이름표들 중 **겹치는 것을 숨긴다.**

          광주 다섯 구처럼 작고 붙어 있는 곳은 이름표가 서로 올라타 어느 것이 어느 구역
          이름인지 알 수 없게 된다. 지도 앱이 하는 방식대로, 자리를 먼저 얻은 쪽만 남긴다.
          자리는 좌표를 화면으로 옮겨 계산한다 — 화면에서 직접 재면 움직일 때마다 배치가 다시 돌아 끊긴다.
        */
        const kept: Rect[] = [];
        for (const label of [...labels].sort((a, b) => b.priority - a.priority)) {
          if (label.element.dataset.visible === 'false') continue;

          const point = map.project(label.lngLat);
          // 지금 보이는 모습의 크기로 잰다. 건수가 빠졌는데 붙은 크기로 재면 헛되이 밀어낸다.
          const size =
            label.element.dataset.detail === 'name' && label.nameSize !== undefined
              ? label.nameSize
              : label.size;
          const rect: Rect = {
            left: point.x - size.width / 2,
            top: point.y - size.height / 2,
            right: point.x + size.width / 2,
            bottom: point.y + size.height / 2,
          };

          if (kept.some((other) => overlaps(rect, other))) {
            label.element.dataset.visible = 'false';
            continue;
          }
          kept.push(rect);
        }
      };

      /*
        움직이는 동안 계속 다시 계산한다 — 지도를 끌면 이름표 사이 간격이 달라진다.
        한 프레임에 한 번으로 묶어 두지 않으면 같은 계산이 수십 번 돈다.
      */
      let frame = 0;
      const schedule = () => {
        if (frame !== 0) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          applyVisibility();
        });
      };

      measure();
      visibilityRef.current = applyVisibility;
      applyVisibility();
      map.on('move', schedule);
      map.on('zoom', schedule);

      setReady(true);
    });

    const areas = areaMarkers.current;
    const spots = spotMarkers.current;
    const provinces = provinceMarkers.current;
    return () => {
      for (const marker of areas.values()) marker.remove();
      areas.clear();
      for (const marker of spots) marker.remove();
      spots.length = 0;
      for (const marker of provinces) marker.remove();
      provinces.length = 0;
      map.remove();
      mapRef.current = null;
    };
  }, [tileUrl, onUnavailable]);

  /* 고른 구역만 상태를 바꾼다. 지도를 다시 만들지 않고 도형 상태만 손댄다. */
  useEffect(() => {
    const map = mapRef.current;
    selectedRef.current = selectedId;
    if (!ready || map === null) return;

    visibilityRef.current?.();

    for (const area of NAMDO_AREAS) {
      const isSelected = area.code === selectedId;
      map.setFeatureState({ source: SOURCE_ID, id: featureId(area) }, { selected: isSelected });

      const element = areaMarkers.current.get(area.code)?.getElement();
      if (element) element.dataset.selected = isSelected ? 'true' : 'false';
    }

    /*
      고른 구역을 화면 가운데로 데려온다.

      지도 앱에서 목록을 열면 그 대상이 보이는 자리로 옮겨 가는 것이 관례다.
      옮기지 않으면 «목록에 있는 곳»과 «지도에 보이는 곳»이 어긋나 두 개를 따로 읽게 된다.
      고른 것을 놓으면 다시 전체로 돌아온다.
    */
    const selected = NAMDO_AREAS.find((area) => area.code === selectedId);
    map.fitBounds(areaBounds(selected ? [selected] : SERVICE_AREAS), {
      padding: {
        top: FIT_PADDING,
        bottom: FIT_PADDING,
        right: FIT_PADDING,
        // 판에 가려지는 만큼 왼쪽을 더 비운다.
        left: FIT_PADDING + leftInset,
      },
      duration: 600,
    });
  }, [selectedId, ready, leftInset]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-card', className)}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="광주·전남 행정구역 지도"
      />

      {/* 출처 표기. OpenStreetMap 자료를 쓰는 조건이므로 지우지 않는다. */}
      <p className="pointer-events-none absolute bottom-2xs start-xs text-micro text-content-subtle">
        {ATTRIBUTION}
      </p>
    </div>
  );
}

/**
 * 구역 이름표 마크업.
 *
 * MapLibre 마커는 React 가 아니라 DOM 요소를 받는다. 그래서 여기서만 마크업을 직접 만든다.
 * 자원이 없는 구역에는 «0곳»을 달지 않는다 — 숫자가 붙으면 셀 것이 있는 줄 안다.
 */
function areaPin(name: string, count: number): string {
  const badge = count > 0 ? `<span class="district-pin__count">${count}곳</span>` : '';
  return `<span class="district-pin__name">${name}</span>${badge}`;
}
