/**
 * 화면 캡처 (시각 검수용).
 *
 *     npm run dev:kiosk / dev:mobile / dev:admin   ← 먼저 띄워 두고
 *     npm run shots
 *
 * 주의: `npm run build` 는 dev 서버와 `.next` 를 공유해 서버를 죽인다.
 * 빌드를 돌렸다면 캡처 전에 dev 서버를 다시 띄워야 한다.
 *
 * ── 왜 이 스크립트가 있는가 ────────────────────────────────────────
 * 타입검사·린트·테스트·대비검사가 모두 통과해도 **화면은 무너져 있을 수 있다.**
 * 실제로 이 스크립트로 다음을 잡았다.
 *
 *   · 대기화면 배경 아트가 `-z-10` 때문에 body 배경에 덮여 한 픽셀도 안 그려짐
 *   · `animate-fade-in`(fill-mode: both)의 끝 키프레임이 opacity 지정을 덮어씀
 *   · 한국어가 어절 중간에서 갈라짐 (「이야기」→ "이 / 야기")
 *   · 밝은 테마 보조글자가 아이보리 배경에서 대비 3:1 미달
 *   · 연구자 화면의 하이드레이션 불일치 (서버가 잰 응답시간이 HTML에 박힘)
 *
 * 전부 빌드가 성공하는 종류의 결함이라, 사람이 보거나 픽셀을 재야만 드러난다.
 *
 * 브라우저 자동화 라이브러리를 설치하지 않는다. 설치된 Chrome 을 헤드리스로 띄우고
 * Node 내장 WebSocket 으로 DevTools 프로토콜에 직접 말한다 — 의존성이 늘지 않는다.
 * ──────────────────────────────────────────────────────────────────
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform, env, argv, exit, pid } from 'node:process';

const DEBUG_PORT = 9223;
const OUT_DIR = join(process.cwd(), 'docs', 'screenshots');
const PROFILE_DIR = join(process.cwd(), 'node_modules', '.cache', 'shot-profile');

const CHROME_CANDIDATES =
  platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

/**
 * 앱 주소. 기본값은 각 앱의 `dev` 스크립트 포트지만, 그 포트가 다른 프로그램에
 * 이미 쓰이고 있을 수 있으므로 환경변수로 바꿀 수 있게 둔다.
 *
 *     KIOSK_URL=http://localhost:4300 ADMIN_URL=http://localhost:4302 npm run shots
 */
const APP = {
  kiosk: env.KIOSK_URL ?? 'http://localhost:3000',
  mobile: env.MOBILE_URL ?? 'http://localhost:3001',
  admin: env.ADMIN_URL ?? 'http://localhost:3002',
};

/** 키오스크 마법사는 화면에 보이는 글자로 조작한다. 셀렉터보다 화면과 덜 어긋난다. */
const WIZARD = [
  '여행일정 만들기',
  '부모님과 함께',
  '1박 2일',
  '문화·예술',
  '음식',
  '자연·숲',
  '다음',
  '대중교통',
  '걷는 시간을 줄이고 싶어요',
  'AI 여행일정 만들기',
];

/** 모바일 결과 화면 캡처용 시연 토큰. 자료가 바뀌면 mktoken.cjs 로 다시 뽑는다. */
const MOBILE_DEMO_TOKEN =
  'eyJ2IjoxLCJpIjoiaXRfZGVtb19ydW4iLCJ0aSI6Iuq0keyjvOydmCDrp5vsl5DshJwg64u07JaR7J2YIOyIsuq5jOyngCwg67aA66qo64uY6rO8IO2VqOq7mCDrlqDrgpjripQgMeuwlSAy7J28Iiwic3QiOiLshJzsmrjsl60g7Lac67CcIMK3IOq0keyjvMK37KCE64KoIMK3IOuwqeusuOyngCA26rOzIiwiZCI6W1tbInNvbmdqZW9uZy1tYXJrZXQiLDY4MF0sWyJnd2FuYmFuZ2plcmltIiw4MTRdLFsibWV0YXNlcXVvaWEiLDg3Nl1dLFtbImRhZWluLW1hcmtldCIsNjYwXSxbImFjYyIsNzMyXSxbInlhbmduaW0iLDg2NF1dXSwibSI6WzMzLjMsMTIwLDQxLjcsMjAuMywxMDAsNTkuMV0sImMiOlsicGFyZW50cyIsIm9uZU5pZ2h0IiwidHJhbnNpdCJdLCJvIjoi7ISc7Jq47JetIn0';

const SCENARIOS = [
  {
    label: '키오스크 · 대기화면',
    url: `${APP.kiosk}/`,
    width: 1920,
    height: 1080,
    shots: [{ name: '01-키오스크-대기화면' }],
  },
  {
    label: '키오스크 · 여행조건 5단계',
    url: `${APP.kiosk}/`,
    width: 1920,
    height: 1080,
    shots: [
      { clicks: WIZARD.slice(0, 1), name: '02-키오스크-1단계-동행' },
      { clicks: WIZARD.slice(1, 3), name: '03-키오스크-3단계-관심' },
      { clicks: WIZARD.slice(3, 8), name: '04-키오스크-5단계-조건' },
      /*
        분석화면은 4.6초 뒤 스스로 결과로 넘어간다. 클릭 직후 잠깐만 머무는 화면이라
        따로 찍지 않으면 «처리 과정을 보여 준다»는 것을 그림으로 남길 수 없다.
      */
      { clicks: WIZARD.slice(8), wait: 1200, name: '08-키오스크-분석화면' },
      { wait: 8000, name: '05-키오스크-결과', fullPage: true },
      // 결과 다음의 두 종착 화면. 여기까지 와야 관람객 흐름이 끝난다.
      { clicks: ['QR로 내 휴대폰에 저장하기'], wait: 1500, name: '06-키오스크-QR전달' },
      // QR 화면에서는 여행카드 버튼이 없다. 일정으로 되돌아간 뒤 눌러야 한다.
      { clicks: ['일정으로 돌아가기', '이미지 여행카드'], wait: 2500, name: '07-키오스크-여행카드' },
    ],
  },
  {
    label: '어드민 · 화면별',
    url: `${APP.admin}/`,
    width: 1600,
    height: 1100,
    /*
      화면마다 주소가 있으므로 메뉴를 누르지 않고 곧장 연다.
      메뉴 이름이 바뀌어도 캡처가 조용히 어긋나지 않는다.
    */
    shots: [
      { path: '/dashboard', name: '20-어드민-대시보드', fullPage: true },
      { path: '/poi-manage', name: '54-어드민-관광지등록', fullPage: true },
      {
        path: '/poi-manage',
        clicks: ['관광지 등록'],
        name: '69-어드민-새관광지상세',
        fullPage: true,
      },
      {
        path: '/poi-manage',
        // 목록 → 새 관광지 상세 → 등록 확인창. 취소·등록이 곧바로 반영되지 않고
        // 확인 창을 거치는지 눈으로 본다.
        clicks: ['관광지 등록', '등록'],
        name: '70-어드민-등록확인창',
      },
      { path: '/poi-meta', name: '27-어드민-관광지관리', fullPage: true },
      {
        path: '/poi-meta',
        clickCells: ['담양군'],
        wait: 800,
        name: '72-어드민-구역상세',
        fullPage: true,
      },
      { path: '/poi-region', name: '66-어드민-권역관리', fullPage: true },
      { path: '/doc-manage', name: '25-어드민-문서관리', fullPage: true },
      { path: '/doc-config', name: '64-어드민-검색설정', fullPage: true },
      { path: '/doc-config', clicks: ['키워드 분석'], wait: 900, name: '24-어드민-키워드분석', fullPage: true },
      { path: '/rec-model', name: '44-어드민-추천설정', fullPage: true },
      { path: '/rec-weight', name: '45-어드민-배점관리', fullPage: true },
      { path: '/link-stats', wait: 2500, name: '58-어드민-연계통계', fullPage: true },
      { path: '/log-session', name: '29-어드민-세션로그', fullPage: true },
      { path: '/log-rag', name: '61-어드민-로그빈상태', fullPage: true },
      { path: '/log-error', name: '67-어드민-에러로그', fullPage: true },
      { path: '/field-pattern', name: '29-어드민-이용패턴', fullPage: true },
      { path: '/log-rec', name: '63-어드민-추천로그', fullPage: true },
      { path: '/field-qr', name: '62-어드민-QR전환률', fullPage: true },
      { path: '/field-survey', name: '65-어드민-만족도조사', fullPage: true },
      { path: '/sys-model', name: '42-어드민-AI모델설정', fullPage: true },
      {
        path: '/sys-model',
        // 「설정」 창 안에서 모델 목록을 펼친 모습. 창 안에서도 드롭다운이 제대로 뜨는지 본다.
        clicks: ['설정', '사용 모델'],
        wait: 700,
        name: '43-어드민-모델선택창',
      },
      { path: '/sys-prompt', name: '40-어드민-프롬프트', fullPage: true },
      {
        // 「템플릿 등록」은 목록 위에 창으로 뜬다. 상세로 넘어가지 않는지 본다.
        path: '/sys-prompt',
        clicks: ['템플릿 등록'],
        wait: 700,
        name: '41-어드민-템플릿등록창',
      },
      {
        path: '/sys-prompt',
        clickCells: ['추천 근거 설명 기본'],
        // 조회 → 수정. 본문 편집칸의 «변수 넣기» 줄이 여기서만 보인다.
        clicks: ['수정'],
        wait: 800,
        name: '49-어드민-프롬프트상세',
        fullPage: true,
      },
      // 목록에서 상세로, 그리고 정렬 메뉴를 펼친 모습
      { path: '/poi-manage', clicks: ['1913 송정역시장 수정'], wait: 900, name: '67-어드민-관광지상세', fullPage: true },
      { path: '/poi-manage', clicks: ['정렬'], wait: 500, name: '68-어드민-정렬메뉴' },
      {
        path: '/poi-manage',
        // 삭제 → 확인 → 완료 알림. 화면 아래 가운데에 토스트가 뜨는지 본다.
        clicks: ['1913 송정역시장 삭제', '삭제'],
        wait: 800,
        name: '71-어드민-완료알림',
      },
    ],
  },
  {
    /*
      좁은 화면. 어드민은 노트북에서도 열리므로 1280 에서 표가 넘치지 않아야 한다.
      사이드바 폭이 고정이라 본문에 남는 자리가 얼마인지 여기서만 드러난다.
    */
    label: '어드민 · 좁은 화면',
    url: `${APP.admin}/`,
    width: 1280,
    height: 900,
    shots: [
      { clicks: ['문서', '관리'], wait: 900, name: '60-어드민-좁은화면-표', fullPage: true },
    ],
  },
  {
    /*
      진행자 패널. 로고를 2초 안에 다섯 번 눌러야 열린다.
      보통의 클릭은 사이에 0.7초를 두므로 그 방식으로는 창이 열리지 않는다 —
      한 번의 실행 안에서 연속으로 누른다.
    */
    label: '키오스크 · 진행자 패널',
    url: `${APP.kiosk}/`,
    width: 1920,
    height: 1080,
    shots: [{ tap: { text: 'AI 남도 프리즘', times: 5 }, wait: 900, name: '09-키오스크-진행자패널' }],
  },
  {
    label: '모바일 · QR 결과',
    url: `${APP.mobile}/`,
    width: 420,
    height: 900,
    shots: [{ name: '30-모바일-안내', fullPage: true }],
  },
  {
    /*
      관람객이 QR 을 찍고 실제로 보는 화면.
      토큰은 `packages/core/.build-tests/mktoken.cjs` 가 키오스크와 같은 경로로 만든다
      (`npm test` 가 그 산출물을 만든다). 주소 자체에 일정이 담기므로 서버 조회가 없다.
    */
    label: '모바일 · 일정 상세',
    url: `${APP.mobile}/t/${MOBILE_DEMO_TOKEN}`,
    width: 420,
    height: 900,
    shots: [{ name: '31-모바일-일정', fullPage: true }],
  },
];

/*
  부분 일치만 쓰면 «검수 실행» 이 사이드바의 «검수 실행 기록» 에 먼저 걸린다.
  그래서 글자가 정확히 같은 것을 먼저 찾고, 없을 때만 포함하는 것을 찾는다.
*/
const CLICK_BY_TEXT = `(text) => {
  const SELECTOR = 'button, a, [role="radio"], [role="checkbox"], label';
  /*
    이름이 둘일 수 있다 — 보이는 글자와 스크린리더용 이름.
    「여는 시각」 버튼은 보이는 글자가 「10:00」이고 이름이 「여는 시각」이다.
    아이콘만 있는 버튼은 반대로 보이는 글자가 없다. 둘 다 후보로 두어야
    사람이 부르는 이름으로 짚을 수 있다.
  */
  const names = (node) =>
    [(node.innerText || '').trim(), node.getAttribute('aria-label') || '']
      .map((name) => name.replace(/\\s+/g, ' ').trim())
      .filter((name) => name.length > 0);
  /*
    본문을 먼저 뒤진다.
    「등록」처럼 사이드바 메뉴와 본문 버튼이 같은 이름을 쓰는 경우가 있는데,
    문서 순서대로 찾으면 늘 사이드바가 먼저 걸려 엉뚱한 화면을 찍는다.
  */
  const scopes = [document.querySelector('main'), document.body].filter(Boolean);
  let hit;
  for (const scope of scopes) {
    const nodes = [...scope.querySelectorAll(SELECTOR)];
    hit =
      nodes.find((node) => names(node).some((name) => name === text)) ??
      nodes.find((node) => names(node).some((name) => name.includes(text)));
    if (hit) break;
  }
  if (!hit) return 'NOT_FOUND';
  hit.scrollIntoView({ block: 'center' });
  hit.click();
  return 'OK';
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const explicit = env.CHROME_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

async function waitForEndpoint(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      // 아직 안 떴다. 잠깐 뒤 다시 본다.
    }
    await sleep(250);
  }
  throw new Error('Chrome 디버깅 포트에 연결하지 못했습니다.');
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

async function capture(browser, scenario) {
  console.log(`  ${scenario.label}`);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: scenario.width,
    height: scenario.height,
    deviceScaleFactor: 1,
    mobile: scenario.width < 600,
  });
  await send('Page.navigate', { url: scenario.url });
  await sleep(2500);

  for (const shot of scenario.shots) {
    /*
      화면마다 주소가 있으면 메뉴를 눌러 찾아갈 이유가 없다.
      클릭으로 찾아가는 방식은 메뉴 이름이나 접힘 상태가 바뀔 때마다 조용히 어긋났다 —
      실패해도 그림은 저장되므로 옛 화면을 찍고도 모르고 지나간다.
    */
    if (shot.path) {
      await send('Page.navigate', { url: `${scenario.url.replace(/\/$/, '')}${shot.path}` });
      await sleep(1800);
    }

    /*
      표의 «줄»을 누르는 경우.

      줄 안에는 삭제 버튼이 있어 이름으로 찾으면 그쪽이 먼저 걸린다
      (「전남 담양군 삭제」가 「담양군」을 품고 있다). 칸의 글자로 곧장 짚는다.
    */
    for (const cellText of shot.clickCells ?? []) {
      const result = await send('Runtime.evaluate', {
        expression: `(() => {
          const cell = [...document.querySelectorAll('main tbody th, main tbody td')]
            .find((node) => (node.innerText || '').trim() === ${JSON.stringify('__CELL__')});
          if (!cell) return 'NOT_FOUND';
          cell.click();
          return 'OK';
        })()`.replace('"__CELL__"', JSON.stringify(cellText)),
        returnByValue: true,
      });
      if (result.result.value !== 'OK') console.log(`      ! 칸 못 찾음: ${cellText}`);
      await sleep(700);
    }

    /*
      연속 터치. 숨은 제스처는 «짧은 시간 안에 몇 번»이 조건이므로,
      한 번의 실행 안에서 눌러야 한다. 클릭 사이에 왕복 지연을 두면 조건을 못 채운다.
    */
    if (shot.tap) {
      const result = await send('Runtime.evaluate', {
        expression: `(() => {
          const click = ${CLICK_BY_TEXT};
          for (let index = 0; index < ${shot.tap.times}; index += 1) {
            const outcome = click(${JSON.stringify(shot.tap.text)});
            if (outcome !== 'OK') return outcome;
          }
          return 'OK';
        })()`,
        returnByValue: true,
      });
      if (result.result.value !== 'OK') console.log(`      ! 못 찾음: ${shot.tap.text}`);
    }

    for (const text of shot.clicks ?? []) {
      const result = await send('Runtime.evaluate', {
        expression: `(${CLICK_BY_TEXT})(${JSON.stringify(text)})`,
        returnByValue: true,
      });
      if (result.result.value !== 'OK') console.log(`      ! 못 찾음: ${text}`);
      await sleep(700);
    }
    await sleep(shot.wait ?? 600);

    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: shot.fullPage === true,
    });
    writeFileSync(join(OUT_DIR, `${shot.name}.png`), Buffer.from(data, 'base64'));
    console.log(`      → ${shot.name}.png`);
  }

  await browser.send('Target.closeTarget', { targetId });
}

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome 또는 Edge 를 찾지 못했습니다. CHROME_PATH 환경변수로 경로를 지정하세요.');
  exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

/*
  앞선 실행의 크롬이 아직 살아 있으면 프로필 폴더가 잠겨 지워지지 않는다(EPERM).
  거기서 멈춰 버리면 «캡처가 안 된다» 로 보이고, 더 나쁘게는 남아 있던 브라우저가
  **예전 화면을 그대로 찍어** 고친 것이 반영되지 않은 것처럼 보인다.
  그래서 지우지 못하면 옆에 새 폴더를 만들어 쓴다 — 멈추지 않고, 헌 화면도 찍지 않는다.
*/
let profileDir = PROFILE_DIR;
try {
  rmSync(PROFILE_DIR, { recursive: true, force: true });
} catch {
  profileDir = `${PROFILE_DIR}-${pid}`;
  console.log('이전 실행의 브라우저가 남아 있어 새 프로필로 시작합니다.');
}

const child = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
);

try {
  const browser = await Cdp.connect(await waitForEndpoint());
  const only = argv[2];
  for (const scenario of SCENARIOS) {
    if (only && !scenario.label.includes(only)) continue;
    await capture(browser, scenario);
  }
  browser.socket.close();
  console.log(`\n완료 — ${OUT_DIR}`);
} finally {
  child.kill();
}
