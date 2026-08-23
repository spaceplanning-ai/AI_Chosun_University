/**
 * 문서에 실을 화면 그림 만들기.
 *
 *     npm run shots        ← 먼저 원본을 찍어 두고
 *     npm run docs:shots
 *
 * ── 왜 원본을 그대로 쓰지 않는가 ───────────────────────────────────
 * 캡처 원본은 한 장에 100∼300KB 인 PNG 다. 요구사항 정의서는 파일 하나로
 * 열리고 인쇄돼야 하므로 그림을 문서 안에 넣어야 하는데, 원본을 그대로 넣으면
 * 문서가 10MB 를 넘겨 열기도 보내기도 어려워진다.
 *
 * 문서에서 그림이 하는 일은 «이 화면이 이렇게 생겼다»를 보이는 것이고, 글자를
 * 읽는 자리가 아니다. 그래서 폭을 줄이고 JPEG 로 바꾼다. 원본은 그대로 남으므로
 * 자세히 볼 일이 있으면 `docs/screenshots/` 를 열면 된다.
 *
 * ── 왜 이미지 라이브러리를 안 쓰는가 ───────────────────────────────
 * 그림 한 종류를 줄이자고 네이티브 의존성을 더하면, 인계받는 쪽에서 `npm install`
 * 한 번으로 재현되지 않는다. 캡처에 이미 쓰고 있는 크롬을 그대로 쓴다 —
 * 캔버스에 줄여 그리고 JPEG 로 뽑는 일은 브라우저가 원래 하는 일이다.
 * ──────────────────────────────────────────────────────────────────
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform, env, exit, pid, cwd } from 'node:process';

const DEBUG_PORT = 9224;
const SOURCE_DIR = join(cwd(), 'docs', 'screenshots');
/** 문서용 그림. 원본과 섞이지 않도록 따로 둔다. */
const OUT_DIR = join(SOURCE_DIR, 'doc');
const PROFILE_DIR = join(cwd(), 'node_modules', '.cache', 'docshot-profile');

/** 문서 폭에 맞춘 최대 가로 픽셀. 이보다 작은 그림은 늘리지 않는다. */
const MAX_WIDTH = 900;
/** 세로로 아주 긴 화면(전체 페이지 캡처)이 문서를 혼자 다 차지하지 않도록 자른다. */
const MAX_HEIGHT = 2200;
const QUALITY = 0.72;

const CHROME_CANDIDATES =
  platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  if (env.CHROME_PATH && existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

async function waitForEndpoint(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      // 아직 안 떴다.
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

/**
 * 캔버스에 줄여 그린 뒤 JPEG 로 돌려준다.
 *
 * 파일을 페이지가 직접 읽게 하지 않고 값으로 넘긴다 — 브라우저는 file:// 사이의
 * 접근을 막아 두는데, 그 빗장을 풀자고 플래그를 더할 일이 아니다.
 */
const CONVERT = `async (dataUrl, maxWidth, maxHeight, quality) => {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('그림을 읽지 못했습니다.'));
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.round(image.width * scale);
  const fullHeight = Math.round(image.height * scale);
  const height = Math.min(fullHeight, maxHeight);
  // 너무 긴 화면은 위에서부터 잘라 담는다. 줄여서 담으면 글자가 뭉개져 아무것도 안 보인다.
  const sourceHeight = Math.round(height / scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  // JPEG 는 투명을 모른다. 흰 바탕을 깔지 않으면 투명한 자리가 검게 나온다.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, image.width, sourceHeight, 0, 0, width, height);

  return { data: canvas.toDataURL('image/jpeg', quality), width, height, cropped: fullHeight > maxHeight };
}`;

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome 또는 Edge 를 찾지 못했습니다. CHROME_PATH 환경변수로 경로를 지정하세요.');
  exit(1);
}

if (!existsSync(SOURCE_DIR)) {
  console.error('캡처 원본이 없습니다. 먼저 `npm run shots` 을 실행하세요.');
  exit(1);
}

/** 이름이 밑줄로 시작하는 것은 작업 중 임시 캡처다. 문서에 싣지 않는다. */
const sources = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith('.png') && !name.startsWith('_'))
  .sort();

if (sources.length === 0) {
  console.error('문서에 실을 캡처가 없습니다.');
  exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let profileDir = PROFILE_DIR;
try {
  rmSync(PROFILE_DIR, { recursive: true, force: true });
} catch {
  profileDir = `${PROFILE_DIR}-${pid}`;
}

const child = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
);

try {
  const browser = await Cdp.connect(await waitForEndpoint());
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  await send('Runtime.enable');

  let totalBefore = 0;
  let totalAfter = 0;

  for (const name of sources) {
    const png = readFileSync(join(SOURCE_DIR, name));
    totalBefore += png.length;

    const result = await send('Runtime.evaluate', {
      expression: `(${CONVERT})(${JSON.stringify(
        `data:image/png;base64,${png.toString('base64')}`,
      )}, ${MAX_WIDTH}, ${MAX_HEIGHT}, ${QUALITY})`,
      awaitPromise: true,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      console.log(`  ! 건너뜀: ${name}`);
      continue;
    }

    const { data, width, height, cropped } = result.result.value;
    const jpeg = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    totalAfter += jpeg.length;

    writeFileSync(join(OUT_DIR, name.replace(/\.png$/, '.jpg')), jpeg);
    console.log(
      `  ${name} → ${width}×${height}${cropped ? ' (아래 잘림)' : ''} · ${(jpeg.length / 1024).toFixed(0)}KB`,
    );
  }

  console.log(
    `\n${sources.length}장 · ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB`,
  );
  console.log(OUT_DIR);
} finally {
  child.kill();
}
