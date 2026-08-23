/**
 * 로그 기반 어드민 화면 점검.
 *
 *     npm test           ← 컴파일 산출물이 필요하다
 *     npm run dev:admin
 *     npm run check:logs
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 로그 4종과 사용자 3종은 «가져온 세션 로그»가 있어야 값이 나온다.
 * 로그가 없는 상태만 확인하면 여덟 화면 모두 «빈 상태»만 보고 지나가게 되고,
 * 정작 자료가 들어왔을 때 깨지는지는 검수 날에야 알게 된다.
 *
 * 그래서 키오스크와 **같은 엔진으로 세션 로그를 만들어** 어드민 저장소에 넣고,
 * 여덟 화면이 실제로 값을 그리는지, 그 과정에서 콘솔 오류가 없는지 본다.
 * ──────────────────────────────────────────────────────────────────
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform, env, exit, pid, cwd } from 'node:process';

const require = createRequire(import.meta.url);

const DEBUG_PORT = 9225;
const ADMIN_URL = env.ADMIN_URL ?? 'http://localhost:3002';
const PROFILE_DIR = join(cwd(), 'node_modules', '.cache', 'logcheck-profile');
const BUILD = join(cwd(), 'packages', 'core', '.build-tests', 'src');

/** 어드민이 세션 로그를 담아 두는 열쇠. `state/logs.ts` 가 정한 이름과 같아야 한다. */
const STORAGE_KEY = 'namdo-prism.admin.logs';

const CHROME_CANDIDATES =
  platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium'];

/**
 * 확인할 화면. 메뉴 경로와 «값이 나왔다면 보여야 할 글자»를 짝지어 둔다.
 *
 * `detail` 이 있으면 목록의 첫 줄을 눌러 상세까지 들어가 본다.
 * 목록만 보고 지나가면 «줄은 그려지는데 눌러도 안 열리는» 상태를 놓친다.
 * 에러 로그에는 두지 않는다 — 점검용 세션이 기준을 다 지키면 줄이 아예 없는 것이 정상이다.
 */
const SCREENS = [
  { menu: ['로그', '세션 로그'], expect: '보관 세션', detail: '재구성 이력' },
  { menu: ['검색 로그'], expect: '검색어 분해', detail: '회수 문서' },
  { menu: ['추천 로그'], expect: '추천점수', detail: '후보 전체' },
  { menu: ['에러 로그'], expect: '걸린 항목' },
  { menu: ['사용자', '이용 패턴'], expect: '세션별 선택', detail: '이용 상세' },
  { menu: ['QR 전환률'], expect: '세션별 전환', detail: '전환 상세' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 화면에 보이는 글자로 누른다. 정확히 같은 것을 먼저 찾는다. */
const CLICK_BY_TEXT = `(text) => {
  const nodes = [...document.querySelectorAll('button, a')];
  const label = (node) => (node.innerText || '').replace(/\\s+/g, ' ').trim();
  const hit = nodes.find((node) => label(node) === text) ?? nodes.find((node) => label(node).includes(text));
  if (!hit) return 'NOT_FOUND';
  hit.click();
  return 'OK';
}`;

const HAS_TEXT = `(text) => document.body.innerText.includes(text) ? 'YES' : 'NO'`;

/** 목록의 첫 줄을 누른다. 줄 자체가 누르는 자리이므로 칸을 눌러 위로 전달한다. */
const CLICK_FIRST_ROW = `() => {
  const cell = document.querySelector('main table tbody tr th, main table tbody tr td');
  if (!cell) return 'NOT_FOUND';
  cell.click();
  return 'OK';
}`;

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method) {
        for (const listener of this.listeners) listener(message);
        return;
      }
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

  onEvent(listener) {
    this.listeners.push(listener);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

/**
 * 키오스크와 같은 경로로 세션 로그를 만든다.
 *
 * `kioskStore.toSessionLog` 가 하는 일을 그대로 옮긴 것이다.
 * 화면을 거치지 않고 만들 수 있어야 «자료가 있을 때»를 반복해서 확인할 수 있다.
 */
function buildSessions() {
  if (!existsSync(BUILD)) {
    console.error('컴파일 산출물이 없습니다. 먼저 `npm test` 를 한 번 돌려 주세요.');
    exit(1);
  }

  const { generateItinerary } = require(join(BUILD, 'domain/linkage-recommendation/index.js'));
  const { replanItinerary } = require(join(BUILD, 'domain/minimal-change-replan/index.js'));
  const { DEMO_SCENARIOS } = require(join(BUILD, 'data/scenarios.js'));
  const { getEnabledRefinements } = require(join(BUILD, 'config/refinements.js'));

  const refinements = getEnabledRefinements('A');
  const snapshot = (itinerary) => ({
    itineraryId: itinerary.id,
    title: itinerary.title,
    stopAttractionIds: itinerary.days.flatMap((day) => day.stops.map((stop) => stop.attractionId)),
    metrics: itinerary.metrics,
  });

  return DEMO_SCENARIOS.map((scenario, index) => {
    const { itinerary, trace } = generateItinerary({
      conditions: scenario.conditions,
      referenceDate: '2026-08-10',
      itineraryId: `log_${scenario.id}`,
    });

    // 절반은 재구성까지 거친 세션으로 만든다 — 재구성 로그가 비면 그 화면을 확인할 수 없다.
    const traces = [];
    let finalItinerary = itinerary;
    if (index % 2 === 0) {
      const outcome = replanItinerary({
        itinerary,
        conditions: scenario.conditions,
        vector: trace.conditionVector,
        refinementId: refinements[0].id,
        referenceDate: '2026-08-10',
      });
      traces.push(outcome.trace);
      finalItinerary = outcome.itinerary;
    }

    return {
      sessionId: `check_${index + 1}`,
      kioskId: 'kiosk-check',
      kioskLocation: '점검용',
      startedAt: `2026-08-10T0${index + 1}:00:00.000Z`,
      endedAt: `2026-08-10T0${index + 1}:05:00.000Z`,
      uiMode: index === 0 ? 'large' : 'normal',
      theme: 'light',
      contrast: 'normal',
      scenarioId: scenario.id,
      conditions: trace.conditions,
      conditionVector: trace.conditionVector,
      retrieval: trace.retrieval,
      trustAssessments: trace.trustAssessments,
      candidates: trace.candidates,
      exclusions: trace.exclusions,
      linkage: trace.linkage,
      linkageCorrection: trace.linkageCorrection,
      initialItinerary: snapshot(itinerary),
      refinements: traces,
      finalItinerary: snapshot(finalItinerary),
      generationMs: trace.elapsedMs,
      totalProcessingMs: trace.elapsedMs + traces.reduce((sum, t) => sum + t.elapsedMs, 0),
      qrGenerated: index % 2 === 0,
      qrOpened: index === 0,
    };
  });
}

const chrome = env.CHROME_PATH ?? CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error('Chrome 또는 Edge 를 찾지 못했습니다.');
  exit(1);
}

const sessions = buildSessions();
console.log(`세션 로그 ${sessions.length}건을 만들어 넣습니다.\n`);

let profileDir = PROFILE_DIR;
try {
  rmSync(PROFILE_DIR, { recursive: true, force: true });
} catch {
  profileDir = `${PROFILE_DIR}-${pid}`;
}
mkdirSync(profileDir, { recursive: true });

const child = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1600,1100',
  ],
  { stdio: 'ignore' },
);

let browser;
for (let attempt = 0; attempt < 40 && !browser; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    browser = await Cdp.connect((await response.json()).webSocketDebuggerUrl);
  } catch {
    await sleep(250);
  }
}
if (!browser) {
  console.error('Chrome 디버깅 포트에 연결하지 못했습니다.');
  child.kill();
  exit(1);
}

const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
const send = (method, params) => browser.send(method, params, sessionId);

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const problems = [];
browser.onEvent((message) => {
  if (message.method === 'Runtime.exceptionThrown') {
    problems.push(message.params.exceptionDetails.text ?? '예외');
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    const entry = message.params.entry;
    problems.push(entry.url ? `${entry.text} — ${entry.url}` : entry.text);
  }
});

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result.value;
};

// 저장소에 넣으려면 먼저 그 오리진에 있어야 한다.
await send('Page.navigate', { url: ADMIN_URL });
await sleep(3500);

/*
  zustand persist 는 `{ state, version }` 모양으로 저장한다.
  화면을 거치지 않고 값을 넣으려면 그 모양을 그대로 맞춰야 한다.
*/
const payload = JSON.stringify({ state: { sessions }, version: 0 });
await evaluate(
  `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(payload)}), 'OK'`,
);
await send('Page.reload');
await sleep(3500);

let failures = 0;

for (const screen of SCREENS) {
  for (const step of screen.menu) {
    const result = await evaluate(`(${CLICK_BY_TEXT})(${JSON.stringify(step)})`);
    if (result !== 'OK') console.log(`  ! 메뉴 «${step}» 못 찾음`);
    await sleep(500);
  }
  await sleep(500);

  const label = screen.menu[screen.menu.length - 1];
  const empty = await evaluate(`(${HAS_TEXT})('불러오면 채워집니다')`);
  const filled = await evaluate(`(${HAS_TEXT})(${JSON.stringify(screen.expect)})`);

  if (empty === 'YES') {
    console.log(`  ✗ ${label} — 로그를 넣었는데도 빈 상태입니다`);
    failures += 1;
  } else if (filled !== 'YES') {
    console.log(`  ✗ ${label} — «${screen.expect}» 가 보이지 않습니다`);
    failures += 1;
  } else {
    console.log(`  ✓ ${label}`);
  }

  // 목록에서 상세로 들어가는 길. 들어가서 세션 원본이 보이는지까지 본다.
  if (screen.detail) {
    const clicked = await evaluate(`(${CLICK_FIRST_ROW})()`);
    await sleep(700);
    const opened = await evaluate(`(${HAS_TEXT})(${JSON.stringify(screen.detail)})`);
    const back = await evaluate(`(${HAS_TEXT})('목록으로')`);
    if (clicked !== 'OK' || opened !== 'YES' || back !== 'YES') {
      console.log(`  ✗ ${label} — 줄을 눌러도 상세가 열리지 않습니다`);
      failures += 1;
    } else {
      console.log(`  ✓ ${label} 상세`);
    }
  }

  // 눈으로도 확인할 수 있게 한 장씩 남긴다.
  if (env.SHOTS === '1') {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(cwd(), 'docs', 'screenshots', `70-로그-${label}.png`), Buffer.from(shot.data, 'base64'));
  }
}

console.log('');
if (problems.length > 0) {
  console.log(`콘솔 오류 ${problems.length}건:`);
  for (const problem of problems.slice(0, 10)) console.log(`  · ${problem}`);
  failures += problems.length;
} else {
  console.log('콘솔 오류 없음');
}

await browser.send('Browser.close').catch(() => {});
child.kill();

if (failures > 0) {
  console.log(`\n실패 ${failures}건`);
  exit(1);
}
console.log('\n모두 통과');
