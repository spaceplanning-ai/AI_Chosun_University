/**
 * 키오스크 → 모바일 승계 (제안서 6.6 / 특허 후보 제3안).
 *
 * 전시장 키오스크는 오프라인으로 동작하므로 "서버에 저장하고 토큰으로 조회"하는 방식을 쓸 수 없다.
 * 그래서 QR에 **일정 자체를 담되, 관광지 id 만 실어 보낸다.**
 * 모바일 앱은 같은 관광지·문서 데이터를 자기 번들 안에 가지고 있으므로
 * id 만 받아도 이름·주소·운영시간·공식 출처를 모두 복원할 수 있다.
 *
 * 그 결과 페이로드는 수백 바이트에 그쳐 QR 한 장에 안전하게 들어가고,
 * 개인정보는 물론 어떤 서버 왕복도 필요하지 않다.
 */

import type { Itinerary } from '../../domain/types/itinerary';
import type { Companion, Duration, Transport, TravelConditions } from '../../domain/types/travel';

/**
 * QR에 실리는 압축 페이로드.
 * 키 이름을 한 글자로 줄인 이유는 QR 용량 때문이며, 이 타입이 그 축약의 유일한 사전이다.
 */
export interface HandoffPayload {
  /** 페이로드 형식 버전. 모바일이 구버전 QR을 만났을 때 판별한다. */
  v: 1;
  /** 비식별 세션 토큰. */
  t: string;
  /** 일정 id. */
  i: string;
  /** 제목 / 부제. */
  ti: string;
  st: string;
  /** 일자별 방문지: [관광지 id, 시작 분]. */
  d: [string, number][][];
  /** 지표: [보행부담, 이동시간, 실내비율, 비용, 신뢰도, 연계지수]. */
  m: [number, number, number, number, number, number];
  /** 조건 요약: [동행자, 기간, 이동수단]. */
  c: [Companion, Duration, Transport];
  /** 출발지. */
  o: string;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
  return new TextDecoder().decode(bytes);
}

export function buildHandoffPayload(
  itinerary: Itinerary,
  conditions: TravelConditions,
  sessionToken: string,
): HandoffPayload {
  return {
    v: 1,
    t: sessionToken,
    i: itinerary.id,
    ti: itinerary.title,
    st: itinerary.subtitle,
    d: itinerary.days.map((day) =>
      day.stops.map((stop) => [stop.attractionId, stop.startMinutes] as [string, number]),
    ),
    m: [
      itinerary.metrics.walkingLoad,
      itinerary.metrics.travelMinutes,
      itinerary.metrics.indoorRatio,
      itinerary.metrics.costLevel,
      itinerary.metrics.averageTrust,
      itinerary.metrics.linkageScore,
    ],
    c: [conditions.companion, conditions.duration, conditions.transport],
    o: conditions.origin,
  };
}

export function encodeHandoff(payload: HandoffPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/** 잘못된 QR을 만나면 예외 대신 undefined 를 돌려준다. 모바일 화면이 오류 안내를 띄우면 된다. */
export function decodeHandoff(encoded: string): HandoffPayload | undefined {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as HandoffPayload).v === 1 &&
      Array.isArray((parsed as HandoffPayload).d)
    ) {
      return parsed as HandoffPayload;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 모바일 결과 페이지 주소.
 * 배포 시 `NEXT_PUBLIC_MOBILE_BASE_URL` 로 실제 도메인을 주입한다.
 * 전시장 로컬 네트워크에서는 미니 PC의 IP를 넣으면 그대로 동작한다.
 */
export function buildHandoffUrl(encoded: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/t/${encoded}`;
}
