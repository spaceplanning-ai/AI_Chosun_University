/**
 * 배포 환경에서 주입되는 런타임 설정.
 *
 * 키오스크(오프라인 로컬)와 모바일 결과 페이지(공개 웹)는 서로 다른 호스트에 배포된다.
 * 전시장에서는 미니 PC의 로컬 IP를, 상시 운영에서는 실제 도메인을 넣는다.
 * `NEXT_PUBLIC_` 접두사는 이 값이 브라우저 번들에 포함된다는 뜻이며,
 * 비밀값을 여기에 두어서는 안 된다.
 */
export const MOBILE_BASE_URL =
  process.env.NEXT_PUBLIC_MOBILE_BASE_URL ?? 'http://localhost:3001';

/**
 * 카카오맵 JavaScript 키.
 *
 * 값이 없거나 네트워크가 막혀 있으면 지도는 조용히 꺼지고 오프라인용 안내도가 대신 나온다.
 * 전시장은 오프라인 구동이 요구사항이므로, 지도가 없는 상태는 **오류가 아니라 정상 경로**다.
 *
 * `NEXT_PUBLIC_` 이라 브라우저 번들에 그대로 실린다. 카카오 콘솔에서 도메인을 제한해 두어야 하며,
 * 이 값을 소스에 박지 않고 `.env.local` 로 주입하는 이유도 저장소가 공개될 수 있기 때문이다.
 */
export const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

/**
 * 바탕 지도 타일 주소.
 *
 * 기본값은 컴포넌트가 들고 있는 OpenStreetMap 공식 타일이다. 열쇠가 필요 없고 출처만 밝히면 된다.
 * 전시장에서 자체 타일 서버를 쓰거나 다른 서비스로 바꿀 때만 이 값을 넣는다.
 */
export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
