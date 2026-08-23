/**
 * 어드민 등록·수정·삭제 동작 점검.
 *
 *     npm run dev:admin   ← 먼저 띄워 두고
 *     npm run check:crud
 *
 * ── 왜 캡처만으로는 모자란가 ──────────────────────────────────────
 * 화면 캡처는 «그려지는가»만 본다. 저장을 눌렀을 때 값이 실제로 남는지,
 * 삭제가 목록에서 빠지는지, 그 과정에서 콘솔 오류가 나는지는 드러나지 않는다.
 * 관리 화면은 스키마 하나로 여러 자료를 그리므로, 한 곳이 깨지면 여러 화면이
 * 같이 깨진다 — 그만큼 눌러 보는 검증이 필요하다.
 *
 * 캡처 스크립트와 같은 방식으로 설치된 Chrome 을 헤드리스로 띄우고
 * Node 내장 WebSocket 으로 DevTools 프로토콜에 직접 말한다. 의존성이 늘지 않는다.
 * ──────────────────────────────────────────────────────────────────
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { platform, env, exit, pid } from 'node:process';

const DEBUG_PORT = 9224;
const ADMIN_URL = env.ADMIN_URL ?? 'http://localhost:3002';
const PROFILE_DIR = join(process.cwd(), 'node_modules', '.cache', 'crud-profile');

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
 * 점검할 흐름.
 *
 * 자료마다 «어느 메뉴를 거쳐 들어가는가»와 «무엇을 채워야 저장되는가»가 달라
 * 그 둘만 적어 둔다. 나머지 절차(등록창 열기·저장·삭제)는 모두 같다.
 */
const FLOWS = [
  {
    label: '프롬프트 템플릿',
    menu: ['시스템 설정', '프롬프트'],
    addButton: '템플릿 등록',
    /** 필수 칸을 채운다. 라벨로 찾아 값을 넣는다. */
    fill: [
      { label: '템플릿명', value: '점검용 임시 템플릿' },
      { label: '본문', value: '점검용 본문' },
      { label: '용도', select: 'answer' },
    ],
    /** 저장 뒤 목록에 나타나야 하는 글자. */
    expect: '점검용 임시 템플릿',
  },
  {
    label: '권역',
    menu: ['초광역 연계지수', '권역'],
    addButton: '권역 등록',
    fill: [
      { label: '권역명', value: '점검용 임시 권역' },
      { label: '소속 지역', select: 'gwangju' },
      { label: '포함 시군구', value: '광주 동구' },
    ],
    expect: '점검용 임시 권역',
  },
];

/**
 * 상세 주소를 볼 화면.
 *
 * 목록에서 줄을 누르면 주소에 «어느 항목인지»가 적혀야 하고,
 * 그 주소를 새로 열었을 때도 같은 상세가 나와야 한다.
 * 이게 깨지면 새로고침하면 목록으로 튕기고, 링크를 건넬 수도 없다.
 */
const DETAIL_ROUTES = ['/doc-manage', '/poi-manage', '/poi-meta', '/poi-region', '/sys-prompt'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 화면에 보이는 글자로 누른다. 셀렉터보다 화면과 덜 어긋난다.
 *
 * 창이 떠 있으면 그 안에서만 찾는다 — 사람도 창이 떠 있으면 뒷장을 누를 수 없다.
 * 이걸 안 하면 창의 「등록」을 누르려다 뒷장의 「템플릿 등록」이 먼저 걸려,
 * 적어 둔 것이 새 양식으로 지워진다.
 * 같은 글자가 여럿이면 «꼭 같은 것»을 먼저 본다.
 */
const CLICK_BY_TEXT = `(text) => {
  const scope = [...document.querySelectorAll('dialog[open]')].at(-1) ?? document;
  const nodes = [...scope.querySelectorAll('button, a, [role="radio"], [role="checkbox"], summary')];
  const label = (node) => (node.innerText || '').replace(/\\s+/g, ' ').trim();
  const hit = nodes.find((node) => label(node) === text) ?? nodes.find((node) => label(node).includes(text));
  if (!hit) return 'NOT_FOUND';
  hit.scrollIntoView({ block: 'center' });
  hit.click();
  return 'OK';
}`;

/**
 * 라벨로 입력칸을 찾아 값을 넣는다.
 *
 * 틀은 `<label>` 일 수도 `<div>` 일 수도 있다 — 안에 버튼이 여럿인 칸(칩 묶음,
 * 직접 그린 선택 메뉴)은 `<label>` 로 감싸면 라벨을 눌렀을 때 첫 버튼이 눌리므로
 * `<div>` 로 감싼다. 그래서 틀을 찾는 대신 **라벨 글자를 이고 있는 칸**을 찾는다.
 *
 * 직접 그린 선택 메뉴는 여기서 열기만 하고 `MENU` 를 돌려준다.
 * 항목은 React 가 다시 그린 뒤에야 생기므로 고르는 일은 다음 호출로 미룬다.
 */
const FILL_BY_LABEL = `(label, value) => {
  const caption = [...document.querySelectorAll('span')].find((node) =>
    (node.textContent || '').trim() === label);
  const frame = caption?.parentElement?.parentElement;
  if (!frame) return 'NO_LABEL';

  const menu = frame.querySelector('[aria-haspopup="listbox"]');
  if (menu) {
    menu.scrollIntoView({ block: 'center' });
    menu.click();
    return 'MENU';
  }

  const field = frame.querySelector('input, textarea, select');
  if (!field) return 'NO_FIELD';
  const proto = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : field instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  return 'OK';
}`;

/** 목록의 첫 줄을 누른다. 줄 자체가 누르는 자리이므로 칸을 눌러 위로 전달한다. */
const CLICK_FIRST_ROW = `(() => {
  const cell = document.querySelector('main table tbody tr th, main table tbody tr td');
  if (!cell) return 'NO_ROW';
  cell.click();
  return 'OK';
})()`;

/** 열려 있는 선택 메뉴에서 값으로 항목을 고른다. 화면에는 이름만 보이므로 `data-value` 를 본다. */
const CHOOSE_OPTION = `(value) => {
  const option = document.querySelector(\`[role="option"][data-value="\${value}"]\`);
  if (!option) return 'NO_OPTION';
  const button = option.querySelector('button') ?? option;
  button.click();
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

function findChrome() {
  if (env.CHROME_PATH && existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

async function connectBrowser() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      const info = await response.json();
      return await Cdp.connect(info.webSocketDebuggerUrl);
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome 디버깅 포트에 연결하지 못했습니다.');
}

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome 또는 Edge 를 찾지 못했습니다. CHROME_PATH 로 경로를 지정하세요.');
  exit(1);
}

/*
  앞선 실행의 브라우저가 남아 있으면 프로필이 잠겨 지워지지 않는다.
  멈추는 대신 옆에 새 폴더를 만들어 쓴다 — 남은 브라우저가 예전 화면을 보여 주는 일도 막는다.
*/
let profileDir = PROFILE_DIR;
try {
  rmSync(PROFILE_DIR, { recursive: true, force: true });
} catch {
  profileDir = `${PROFILE_DIR}-${pid}`;
}
mkdirSync(profileDir, { recursive: true });

const process_ = spawn(
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

const browser = await connectBrowser();
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
const send = (method, params) => browser.send(method, params, sessionId);

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

/** 콘솔 오류·예외를 모은다. 조용히 지나가면 검수에서야 드러난다. */
const problems = [];
browser.onEvent((message) => {
  if (message.method === 'Runtime.exceptionThrown') {
    problems.push(message.params.exceptionDetails.text ?? '예외');
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    // 주소를 함께 남긴다. «404 하나» 만으로는 무엇을 고쳐야 할지 알 수 없다.
    const entry = message.params.entry;
    problems.push(entry.url ? `${entry.text} — ${entry.url}` : entry.text);
  }
});

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result.value;
};

const click = (text) => evaluate(`(${CLICK_BY_TEXT})(${JSON.stringify(text)})`);
const fill = (label, value) =>
  evaluate(`(${FILL_BY_LABEL})(${JSON.stringify(label)}, ${JSON.stringify(value)})`);
const chooseOption = (value) => evaluate(`(${CHOOSE_OPTION})(${JSON.stringify(value)})`);

await send('Page.navigate', { url: ADMIN_URL });
await sleep(4000);

let failures = 0;

for (const flow of FLOWS) {
  console.log(`\n${flow.label}`);

  for (const step of flow.menu) {
    const result = await click(step);
    if (result !== 'OK') console.log(`  ! 메뉴 «${step}» 못 찾음`);
    await sleep(600);
  }

  // ── 등록
  if ((await click(flow.addButton)) !== 'OK') {
    console.log(`  ✗ «${flow.addButton}» 버튼을 찾지 못했습니다`);
    failures += 1;
    continue;
  }
  await sleep(500);

  for (const entry of flow.fill) {
    if (entry.chip) {
      if ((await click(entry.chip)) !== 'OK') console.log(`  ! 칩 «${entry.chip}» 못 찾음`);
    } else {
      const result = await fill(entry.label, entry.select ?? entry.value);
      if (result === 'MENU') {
        // 메뉴가 열렸다. 항목이 그려질 틈을 준 뒤 고른다.
        await sleep(250);
        const chosen = await chooseOption(entry.select ?? entry.value);
        if (chosen !== 'OK') console.log(`  ! 칸 «${entry.label}» ${chosen}`);
      } else if (result !== 'OK') {
        console.log(`  ! 칸 «${entry.label}» ${result}`);
      }
    }
    await sleep(150);
  }

  /*
    새로 만들 때의 단추는 「등록」, 이미 있는 것을 고칠 때는 「저장」이다.
    둘 다 시도한다 — 없는 쪽은 조용히 지나간다.
  */
  if ((await click('등록')) !== 'OK') await click('저장');
  await sleep(700);

  /*
    저장은 확인 창을 한 번 더 거친다.
    열려 있는 창에서 「저장」·「등록」을 눌러야 실제로 목록에 들어간다.
  */
  await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (!dialog) return 'NO_DIALOG';
    const hit = [...dialog.querySelectorAll('button')]
      .find((node) => ['저장', '등록'].includes((node.innerText || '').trim()));
    if (!hit) return 'NO_BUTTON';
    hit.click();
    return 'OK';
  })()`);
  await sleep(800);

  /* 표에서 찾는다 — 알림 문구에도 같은 이름이 들어 있어 화면 전체를 훑으면 헛통과한다. */
  const saved = await evaluate(
    `(() => {
      const table = document.querySelector('main table');
      if (!table) return 'NO';
      return (table.innerText || '').includes(${JSON.stringify(flow.expect)}) ? 'YES' : 'NO';
    })()`,
  );
  if (saved === 'YES') {
    console.log('  ✓ 등록됨');
  } else {
    console.log('  ✗ 등록한 항목이 목록에 없습니다');
    failures += 1;
  }

  // ── 삭제 (확인 창까지 거친다)
  const deleteResult = await evaluate(
    `(() => {
      // 한 줄에 「수정」과 「삭제」가 나란히 있다. 이름만 보면 수정이 먼저 걸린다.
      const button = [...document.querySelectorAll('button')].find((node) => {
        const label = node.getAttribute('aria-label') || '';
        return label.includes(${JSON.stringify(flow.expect)}) && label.includes('삭제');
      });
      if (!button) return 'NOT_FOUND';
      button.click();
      return 'OK';
    })()`,
  );
  if (deleteResult !== 'OK') {
    console.log('  ✗ 삭제 버튼을 찾지 못했습니다');
    failures += 1;
    continue;
  }
  await sleep(400);
  /*
    열려 있는 창 안에서만 누른다.
    닫힌 `<dialog>` 도 글자는 그대로 들고 있어(화면에 안 그려질 뿐), 문서 전체를 훑으면
    «0건 삭제» 같은 엉뚱한 단추가 먼저 걸린다.
  */
  await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (!dialog) return 'NO_DIALOG';
    const hit = [...dialog.querySelectorAll('button')]
      .find((node) => (node.innerText || '').trim() === '삭제');
    if (!hit) return 'NO_BUTTON';
    hit.click();
    return 'OK';
  })()`);
  await sleep(600);

  /*
    표 안에서만 찾는다.
    삭제하면 «…을(를) 삭제했습니다» 알림이 잠깐 떠 있는데, 그 문구에 방금 지운
    이름이 들어 있다. 화면 전체를 훑으면 지웠는데도 «남아 있다»고 읽힌다.
  */
  const gone = await evaluate(
    `(() => {
      const table = document.querySelector('main table');
      if (!table) return 'NO';
      return (table.innerText || '').includes(${JSON.stringify(flow.expect)}) ? 'YES' : 'NO';
    })()`,
  );
  if (gone === 'NO') {
    console.log('  ✓ 삭제됨');
  } else {
    console.log('  ✗ 삭제했는데 목록에 남아 있습니다');
    failures += 1;
  }
}

/* ── 상세 주소 ──────────────────────────────────────────────────── */
console.log('\n상세 주소');
for (const path of DETAIL_ROUTES) {
  await send('Page.navigate', { url: `${ADMIN_URL}${path}` });
  await sleep(2200);

  if ((await evaluate(CLICK_FIRST_ROW)) !== 'OK') {
    console.log(`  ! ${path} — 누를 줄이 없습니다`);
    continue;
  }
  await sleep(800);

  const search = await evaluate('location.search');
  const opened = await evaluate(`document.querySelector('main h2')?.innerText ?? ''`);
  if (!search.startsWith('?id=')) {
    console.log(`  ✗ ${path} — 줄을 눌러도 주소에 남지 않습니다`);
    failures += 1;
    continue;
  }

  // 같은 주소를 새로 열었을 때도 같은 상세가 나와야 한다.
  await send('Page.navigate', { url: `${ADMIN_URL}${path}${search}` });
  await sleep(2200);
  const reopened = await evaluate(`document.querySelector('main h2')?.innerText ?? ''`);
  if (reopened === opened && opened !== '') {
    console.log(`  ✓ ${path}${search}`);
  } else {
    console.log(`  ✗ ${path} — 그 주소로 다시 열리지 않습니다 («${opened}» → «${reopened}»)`);
    failures += 1;
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
process_.kill();

if (failures > 0) {
  console.log(`\n실패 ${failures}건`);
  exit(1);
}
console.log('\n모두 통과');
