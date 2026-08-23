/**
 * 카카오맵 키 점검.
 *
 *     npm run check:kakao
 *
 * ── 왜 따로 두는가 ─────────────────────────────────────────────────
 * 지도가 안 뜨는 까닭은 셋인데 화면에서는 셋 다 똑같이 보인다 — 안내도로 되돌아갈 뿐이다.
 * 전시장은 오프라인이 정상 경로라 화면이 시끄럽게 굴면 안 되고, 그렇다고 조용히 두면
 * 준비하는 사람은 «키를 넣었는데 왜 안 되지»에서 멈춘다.
 *
 * 그래서 원인은 화면이 아니라 여기서 말한다. 브라우저는 카카오가 CORS 를 열어 두지 않아
 * 거절 사유를 읽을 수 없지만, 여기서는 응답 본문을 그대로 볼 수 있다.
 * ──────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, env, exit } from 'node:process';

/** 키가 담긴 곳. 배포에서는 환경변수, 개발에서는 이 파일이다. */
const ENV_FILE = join(cwd(), 'apps', 'kiosk', '.env.local');
const KEY_NAME = 'NEXT_PUBLIC_KAKAO_MAP_KEY';

function readKey() {
  if (env[KEY_NAME]) return { key: env[KEY_NAME], from: '환경변수' };
  if (!existsSync(ENV_FILE)) return { key: undefined, from: ENV_FILE };

  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [name, ...rest] = trimmed.split('=');
    if (name.trim() === KEY_NAME) return { key: rest.join('=').trim(), from: ENV_FILE };
  }
  return { key: undefined, from: ENV_FILE };
}

const { key, from } = readKey();

if (!key) {
  console.log(`키가 없습니다 (${from}).`);
  console.log('지도는 꺼진 채로 오프라인 안내도가 나옵니다 — 전시장에서는 이것이 정상 경로입니다.');
  console.log('\n지도를 쓰려면:');
  console.log('  1. 카카오 개발자 콘솔 → 내 애플리케이션 → 앱 키 → «JavaScript 키»');
  console.log(`  2. ${ENV_FILE} 에 ${KEY_NAME}=<키> 를 넣습니다`);
  exit(1);
}

console.log(`키를 ${from} 에서 읽었습니다 (${key.slice(0, 4)}… ${key.length}자).\n`);

const url = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;

let response;
try {
  response = await fetch(url);
} catch (cause) {
  console.log('카카오 서버에 닿지 못했습니다 —', cause instanceof Error ? cause.message : cause);
  console.log('인터넷이 막혀 있으면 지도 대신 오프라인 안내도가 나옵니다. 전시장에서는 정상입니다.');
  exit(1);
}

const body = await response.text();

if (response.ok) {
  console.log('✓ 키가 통과했습니다. 남은 것은 도메인 등록뿐입니다.');
  console.log('  콘솔 → 앱 설정 → 플랫폼 → Web 에 지도를 띄울 주소가 모두 있어야 합니다:');
  console.log('    · http://localhost:3000        (개발)');
  console.log('    · 전시장 미니 PC 의 주소       (예: http://192.168.0.10:3000)');
  console.log('  등록하지 않은 주소에서는 키가 맞아도 지도가 뜨지 않습니다.');
  exit(0);
}

// 카카오는 거절 사유를 본문에 적어 준다. 그대로 옮긴다 — 우리가 지어내지 않는다.
let reason = body.trim();
try {
  const parsed = JSON.parse(body);
  reason = parsed.message ?? reason;
} catch {
  // 본문이 JSON 이 아니면 그대로 보여 준다.
}

console.log(`✗ 카카오가 거절했습니다 (HTTP ${response.status})`);
console.log(`  ${reason}\n`);

if (reason.includes('REST_API_KEY')) {
  console.log('REST API 키를 넣으셨습니다. 지도 SDK 는 «JavaScript 키»만 받습니다.');
  console.log('  콘솔 → 내 애플리케이션 → 앱 키 → JavaScript 키 를 복사해 넣어 주세요.');
  console.log('  두 키는 생김새가 같아(32자) 눈으로는 구별되지 않습니다.');
}

exit(1);
