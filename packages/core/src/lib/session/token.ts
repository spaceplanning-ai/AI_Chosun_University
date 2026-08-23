/**
 * 비식별 세션 토큰.
 *
 * 특허 후보 제3안(「비식별 세션 토큰을 이용한 키오스크와 모바일 간 여행정보 연속 제공 시스템」)의
 * 기반이며, 동시에 개인정보를 수집하지 않는다는 원칙의 구현이기도 하다(제안서 5.4 / 7.7).
 *
 * 토큰은 어떤 개인 식별자에서도 유도되지 않는다. 기기 정보·IP·시각을 섞지 않으므로
 * 토큰만으로는 같은 사람의 두 세션을 이어 붙일 수 없다. 이는 의도된 성질이다.
 */

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 난수 바이트. 브라우저·Node 모두 표준 Web Crypto 를 제공한다. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * 사람이 눈으로 옮겨 적을 수도 있는 짧은 토큰.
 * 혼동하기 쉬운 문자(0·O·1·I)를 알파벳에서 뺐다.
 */
export function createSessionToken(length = 10): string {
  const bytes = randomBytes(length);
  let token = '';
  for (const byte of bytes) {
    token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  }
  return token;
}

/** 로그 조인 키로 쓰는 세션 식별자. */
export function createSessionId(): string {
  return `s_${createSessionToken(12)}`;
}

/** 일정 식별자. 한 세션 안에서 재구성이 일어나도 일정 id 는 유지된다. */
export function createItineraryId(): string {
  return `it_${createSessionToken(10)}`;
}
