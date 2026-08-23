/**
 * 지도 일꾼(worker) 파일을 키오스크의 정적 폴더로 복사한다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * MapLibre 는 타일을 만드는 일을 **별도 일꾼**에게 맡긴다. 그 일꾼은 라이브러리 안의
 * 다른 파일(`maplibre-gl-worker.mjs`)로, 브라우저가 따로 내려받아야 한다.
 *
 * 그런데 이 프로젝트는 지도 컴포넌트를 공용 꾸러미(`@namdo-prism/core`)에 두고
 * Next 가 그것을 통째로 다시 묶는다. 그 과정에서 일꾼 파일 주소가 함께 옮겨지지 않아
 * 브라우저가 404 를 받는다 — 그러면 **바탕 지도는 나오는데 얹은 도형이 하나도 안 그려진다.**
 * 도형은 일꾼이 만들기 때문이다. 오류도 안 나서 «지도는 되는데 경계만 없는» 모습이 된다.
 *
 * 그래서 일꾼 파일을 정적 폴더에 그대로 두고 주소를 직접 알려 준다.
 * 라이브러리를 올릴 때 이 스크립트가 다시 돌아 같은 판본을 복사한다.
 */

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit } from 'node:process';

const require = createRequire(import.meta.url);

/** 일꾼과 일꾼이 부르는 공용 파일. 둘은 나란히 있어야 서로를 찾는다. */
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

/*
  키오스크의 `predev`·`prebuild` 는 `apps/kiosk` 에서 실행되고, 루트의 `npm run map:worker`
  는 저장소 루트에서 실행된다. 실행 위치를 기준으로 잡으면 앞의 경우 파일이
  `apps/kiosk/apps/kiosk/...` 에 떨어져, 화면은 여전히 워커를 못 찾는다.
  그래서 이 파일의 위치에서 잰다 — 어디서 실행하든 같은 자리를 가리킨다.
*/
const TARGET = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'kiosk', 'public', 'maplibre');

let dist;
try {
  dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
} catch {
  console.error('maplibre-gl 을 찾지 못했습니다. `npm install` 을 먼저 돌려 주세요.');
  exit(1);
}

mkdirSync(TARGET, { recursive: true });

for (const name of FILES) {
  const from = join(dist, name);
  if (!existsSync(from)) {
    console.error(`${name} 이 라이브러리 안에 없습니다. 판본이 바뀌었는지 확인해 주세요.`);
    exit(1);
  }
  copyFileSync(from, join(TARGET, name));
  console.log(`복사: ${name}`);
}

console.log(`\n${TARGET} 에 넣었습니다.`);
