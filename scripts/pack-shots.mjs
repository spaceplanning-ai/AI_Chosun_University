/**
 * 화면 캡처를 한 봉투로 묶는다.
 *
 *     npm run shots       ← 먼저 찍고
 *     npm run docs:shots  ← 문서용으로 줄인 뒤
 *     npm run docs:zip
 *
 * ── 왜 따로 묶는가 ─────────────────────────────────────────────────
 * 요구사항 정의서 안의 그림은 폭 900px 로 줄인 것이다. 문서에서 그림이 하는 일은
 * «이 화면이 이렇게 생겼다»를 보이는 것이라 그것으로 충분하지만, 화면을 뜯어보거나
 * 발표 자료에 옮겨 붙일 때는 원본이 필요하다.
 *
 * 폴더째 건네면 어느 그림이 어느 화면인지가 파일 이름에만 남는다. 그래서 봉투 안에
 * 요구 ID·화면 이름·무엇을 보라는 것인지를 적은 안내를 함께 넣는다 — 문서의
 * 「11. 화면 캡처」와 같은 표다.
 *
 * ── 왜 압축하지 않는가 ─────────────────────────────────────────────
 * 담는 것이 PNG·JPEG 라 이미 압축돼 있다. 다시 압축해도 줄지 않는다.
 * 봉투의 목적은 «한 파일로 건네는 것»이지 크기를 줄이는 것이 아니다.
 * ──────────────────────────────────────────────────────────────────
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit } from 'node:process';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORE = join(ROOT, 'packages', 'core');
const BUILD = join(CORE, '.build-tests', 'src');

const SHOT_DIR = join(ROOT, 'docs', 'screenshots');
const DOC_SHOT_DIR = join(SHOT_DIR, 'doc');

if (!existsSync(SHOT_DIR)) {
  console.error('캡처가 없습니다. 먼저 `npm run shots` 을 실행하세요.');
  exit(1);
}

/* 화면 정의와 캡처 표를 읽으려면 TypeScript 를 한 번 컴파일해야 한다(테스트와 같은 방식). */
execFileSync(
  process.execPath,
  [join(ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', join(CORE, 'tsconfig.tests.json')],
  { stdio: 'inherit' },
);
writeFileSync(join(CORE, '.build-tests', 'package.json'), '{ "type": "commonjs" }\n', 'utf8');

const { DOC_SCREENS, DOC_APP_LABELS, DOC_CAPTURES, DOC_REQUIREMENT_IDS, DOC_SAMPLE_CAPTURES } = require(
  join(BUILD, 'docs', 'index.js'),
);
/** ZIP 작성기는 로그 통합문서가 쓰던 것을 그대로 쓴다. 같은 일을 두 번 만들지 않는다. */
const { createZip } = require(join(BUILD, 'lib', 'logging', 'zip.js'));

/** 이름이 밑줄로 시작하는 것은 작업 중 임시 캡처다. 봉투에 넣지 않는다. */
const originals = readdirSync(SHOT_DIR)
  .filter((name) => name.endsWith('.png') && !name.startsWith('_'))
  .sort();

const reduced = existsSync(DOC_SHOT_DIR)
  ? readdirSync(DOC_SHOT_DIR).filter((name) => name.endsWith('.jpg')).sort()
  : [];

/* ── 안내문 ────────────────────────────────────────────────────────
   어느 그림이 어느 화면인지 봉투 안에서 바로 확인되도록 적는다.
   문서를 열지 않고 그림만 받은 사람이 첫 번째 독자다.
   ────────────────────────────────────────────────────────────────── */

const lines = [
  'AI 남도 프리즘 — 화면 캡처',
  '',
  '이 봉투는 요구사항 정의서의 「11. 화면 캡처」와 같은 그림을 담고 있습니다.',
  '',
  '  원본/    실행 중인 화면을 그대로 찍은 것입니다.',
  '  문서용/  요구사항 정의서에 실린 것과 같습니다. 폭 900px 로 줄인 JPEG 입니다.',
  '',
  '자료가 없는 화면은 «자료가 없는 그대로» 찍혀 있습니다. 채워진 모습을 만들어 넣지 않았습니다.',
  '',
  '─'.repeat(78),
  '',
];

/** 캡처를 쓴 화면이 하나도 없는 그림. 봉투에는 넣되 어디에 쓰였는지는 적지 않는다. */
const used = new Set();

for (const app of ['kiosk', 'mobile', 'admin']) {
  lines.push(`[${DOC_APP_LABELS[app]}]`, '');

  for (const screen of DOC_SCREENS.filter((entry) => entry.app === app)) {
    const key = `${screen.app}/${screen.id}`;
    lines.push(`  ${DOC_REQUIREMENT_IDS[key]}  ${screen.name}  (${screen.code})`);
    for (const capture of DOC_CAPTURES[key] ?? []) {
      used.add(capture.file);
      lines.push(`      ${capture.file}.png`, `        ${capture.caption}`);
    }
    lines.push('');
  }
}

lines.push('─'.repeat(78), '', '[샘플 코드와 짝지은 그림]', '');
for (const [sampleId, capture] of Object.entries(DOC_SAMPLE_CAPTURES)) {
  used.add(capture.file);
  lines.push(`  ${sampleId}  ${capture.file}.png`, `      ${capture.caption}`, '');
}

const spare = originals.map((name) => name.replace(/\.png$/, '')).filter((name) => !used.has(name));
if (spare.length > 0) {
  lines.push(
    '─'.repeat(78),
    '',
    '[문서에 싣지 않은 그림]',
    '  화면의 다른 상태(창·확인·알림 등)를 찍어 둔 것입니다.',
    '',
    ...spare.map((name) => `  ${name}.png`),
    '',
  );
}

/* ── 봉투 만들기 ───────────────────────────────────────────────── */

const encoder = new TextEncoder();
const entries = [
  // 윈도우 메모장이 UTF-8 로 열도록 BOM 을 붙인다. 없으면 한글이 깨져 보인다.
  { path: '안내.txt', data: encoder.encode(`﻿${lines.join('\r\n')}`) },
  ...originals.map((name) => ({ path: `원본/${name}`, data: readFileSync(join(SHOT_DIR, name)) })),
  ...reduced.map((name) => ({ path: `문서용/${name}`, data: readFileSync(join(DOC_SHOT_DIR, name)) })),
];

const zip = createZip(entries);

const OUTPUTS = [
  join(ROOT, 'docs', 'AI남도프리즘_화면캡처.zip'),
  // 문서 옆에 나란히 둔다 — 그림만 따로 건넬 일이 많다.
  join(ROOT, '..', 'AI 남도 프리즘 화면 캡처.zip'),
];

for (const output of OUTPUTS) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, zip);
}

console.log(
  `화면 캡처를 묶었습니다 — 원본 ${originals.length}장 · 문서용 ${reduced.length}장 · ${(zip.length / 1024 / 1024).toFixed(1)}MB`,
);
if (spare.length > 0) console.log(`  문서에 싣지 않은 그림 ${spare.length}장도 함께 넣었습니다.`);
for (const output of OUTPUTS) console.log(`  ${output}`);
