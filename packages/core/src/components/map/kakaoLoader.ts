'use client';

/**
 * 카카오맵 SDK 로더.
 *
 * ── 왜 이런 형태인가 ───────────────────────────────────────────────
 * 카카오맵은 **타일을 카카오 서버에서 받아 온다.** 전시장 키오스크는 오프라인으로 돌아가야 하므로
 * (피드백 [기타]) 지도가 없는 상황이 «예외»가 아니라 **정상적으로 일어나는 상태**다.
 *
 * 그래서 이 로더는 실패를 숨기지 않고 상태로 돌려준다. 화면은 그 상태를 보고
 * 지도를 쓸지, 오프라인용 안내도로 되돌릴지 스스로 정한다.
 * 실패를 조용히 삼키면 전시장에서 회색 상자만 남는다.
 *
 * SDK 는 한 번만 내려받아 여러 화면이 함께 쓴다. 화면마다 스크립트를 넣으면
 * 같은 파일을 여러 번 받고 전역 객체가 뒤엉킨다.
 * ──────────────────────────────────────────────────────────────────
 */

export type KakaoLoadState = 'idle' | 'loading' | 'ready' | 'unavailable';

/** 지도 로딩이 이 시간을 넘기면 «없는 것»으로 본다. 오프라인에서는 응답 자체가 오지 않는다. */
const LOAD_TIMEOUT_MS = 6000;

const SCRIPT_ID = 'kakao-maps-sdk';

/** 이미 시작한 로딩을 다시 시작하지 않도록 약속을 재사용한다. */
let pending: Promise<boolean> | undefined;

function sdkUrl(appKey: string): string {
  // `autoload=false` 로 받아야 우리가 원하는 시점에 초기화할 수 있다.
  // `services` 는 좌표↔주소 변환에 필요하다.
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
}

/*
  SDK 전체가 아니라 **이 프로젝트가 실제로 쓰는 부분만** 타입으로 적는다.
  전체를 흉내 내면 카카오가 API 를 바꿀 때마다 우리 타입이 먼저 틀어지고,
  타입이 있다는 이유로 잘못된 호출을 놓치게 된다.
*/
export interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

export interface KakaoShape {
  setMap: (map: KakaoMap | null) => void;
}

export interface KakaoPolygon extends KakaoShape {
  setOptions: (options: {
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWeight?: number;
  }) => void;
}

export interface KakaoOverlay extends KakaoShape {
  setContent: (content: string) => void;
}

export type KakaoMap = object;

export interface KakaoMarker extends KakaoShape {
  setZIndex: (zIndex: number) => void;
}

export interface KakaoBounds {
  extend: (latLng: KakaoLatLng) => void;
}

export interface KakaoMapsApi {
  load: (callback: () => void) => void;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Polygon: new (options: {
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => KakaoPolygon;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: string;
    yAnchor?: number;
    clickable?: boolean;
  }) => KakaoOverlay;
  Polyline: new (options: {
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: 'solid' | 'shortdash';
  }) => KakaoShape;
  LatLngBounds: new () => KakaoBounds;
  event: {
    addListener: (target: object, type: string, handler: () => void) => void;
  };
}

/** 지도가 모든 지점을 담도록 화면을 맞춘다. 카카오 Map 에 있는 메서드지만 타입이 없어 여기서 좁힌다. */
export interface KakaoMapWithBounds extends KakaoMap {
  setBounds: (bounds: KakaoBounds, paddingTop?: number) => void;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

/**
 * SDK 를 한 번만 내려받는다.
 * 성공하면 `true`, 키가 없거나 네트워크가 막혀 있으면 `false` 를 돌려준다 — 예외를 던지지 않는다.
 */
export function loadKakaoMaps(appKey: string | undefined): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!appKey) return Promise.resolve(false);
  if (window.kakao?.maps) return Promise.resolve(true);
  if (pending) return pending;

  pending = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    // 오프라인에서는 error 이벤트조차 늦게 오거나 오지 않는다. 시간으로도 끊는다.
    const timer = window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    /*
      준비하는 사람에게만 까닭을 알린다.

      전시장에서는 지도가 없는 것이 정상이라 화면이 시끄러우면 안 된다. 그런데 조용히 두면
      키를 넣어 보는 사람은 «넣었는데 왜 안 되지»에서 멈춘다. 카카오가 CORS 를 열어 두지
      않아 브라우저에서는 거절 사유를 읽을 수 없으므로, 사유를 볼 수 있는 곳을 알려 준다.
    */
    const hint = () => {
      if (process.env.NODE_ENV === 'production') return;
      console.warn('[kakao] 지도를 불러오지 못했습니다. `npm run check:kakao` 로 까닭을 볼 수 있습니다.');
    };

    const existing = document.getElementById(SCRIPT_ID);
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script');

    script.addEventListener('load', () => {
      window.clearTimeout(timer);
      const maps = window.kakao?.maps;
      if (!maps) {
        hint();
        finish(false);
        return;
      }
      // `load` 는 지도 모듈이 실제로 쓸 수 있게 된 시점을 알려 준다.
      maps.load(() => finish(true));
    });

    script.addEventListener('error', () => {
      window.clearTimeout(timer);
      hint();
      /*
        실패한 스크립트를 남겨 두면 다음 시도가 «이미 있다»고 보고 그 위에 귀만 붙인다.
        그 스크립트는 두 번 다시 load 도 error 도 내지 않으므로 시간만 흘려보내게 된다.
      */
      script.remove();
      finish(false);
    });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = sdkUrl(appKey);
      document.head.append(script);
    }
  });

  return pending;
}
