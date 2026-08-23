/**
 * 요구사항 정의서 생성기.
 *
 *     npm run docs:srs
 *
 * ── 왜 생성기인가 ──────────────────────────────────────────────────
 * 요구사항 정의서·기능 명세서·화면 정의서는 같은 사실을 다른 각도에서 적는다.
 * 손으로 세 번 쓰면 화면 하나를 고칠 때 세 곳을 고쳐야 하고, 한 곳을 빠뜨리면
 * 문서끼리 서로 다른 말을 하는 상태가 조용히 남는다.
 *
 * 그래서 사실은 `packages/core/src/docs/**` 에만 적고 문서는 여기서 만든다.
 * **산출된 HTML 을 직접 고치지 않는다. 다음 실행에서 덮어쓴다.**
 *
 * ── 왜 TypeScript 를 컴파일해서 읽는가 ─────────────────────────────
 * 이 저장소에는 tsx·ts-node 가 없다. 검수 재현을 `npm install` 하나로 끝내기
 * 위해 개발 의존성을 최소로 두었기 때문이다. 그래서 테스트와 같은 방식으로
 * TypeScript 를 CommonJS 로 컴파일한 뒤 그 산출물을 읽는다.
 *
 * 어드민 메뉴(`navigation.ts`)만은 컴파일하지 않고 글자로 훑는다 —
 * 그 파일은 아이콘 컴포넌트를 함께 들고 있어 Node 에서 그대로 불러올 수 없고,
 * 여기서 필요한 것은 화면 id 목록뿐이다.
 * ──────────────────────────────────────────────────────────────────
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, cwd, exit } from 'node:process';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORE = join(ROOT, 'packages', 'core');
const BUILD = join(CORE, '.build-tests', 'src');

/** 문서 작성일. 실행할 때마다 흔들리지 않도록 인자로 고정할 수 있다. */
const ISSUED_AT = argv.find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) ?? new Date().toISOString().slice(0, 10);

/* ────────────────────────────────────────────────────────────────
   1. 원본 읽기
   ──────────────────────────────────────────────────────────────── */

// 테스트와 같은 설정으로 컴파일한다. 이미 컴파일되어 있어도 값이 최신이도록 매번 돌린다.
execFileSync(
  process.execPath,
  [join(ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', join(CORE, 'tsconfig.tests.json')],
  { stdio: 'inherit' },
);
writeFileSync(join(CORE, '.build-tests', 'package.json'), '{ "type": "commonjs" }\n', 'utf8');

const docs = require(join(BUILD, 'docs', 'index.js'));
const kioskConfig = require(join(BUILD, 'config', 'kiosk.js'));
const scoring = require(join(BUILD, 'config', 'scoring.js'));
const refinements = require(join(BUILD, 'config', 'refinements.js'));
const attractions = require(join(CORE, 'src', 'data', 'attractions.json'));
const officialDocuments = require(join(CORE, 'src', 'data', 'officialDocuments.json'));

const {
  DOC_PROJECT,
  DOC_BACKGROUND,
  DOC_GOALS,
  DOC_PERSONAS,
  DOC_COMPOSITION,
  DOC_DATA_NOTE,
  DOC_CONSTRAINTS,
  DOC_SCREENS,
  DOC_OPERATION_RULES,
  DOC_EXTERNAL_INTRO,
  DOC_EXTERNAL_ITEMS,
  DOC_PREPARATION_ITEMS,
  DOC_OPEN_QUESTIONS,
  DOC_CODE_SAMPLES,
  DOC_SAMPLE_INTRO,
  DOC_SAMPLE_SIDE_LABELS,
  DOC_CAPTURES,
  DOC_SAMPLE_CAPTURES,
  DOC_APP_LABELS,
  DOC_REQUIREMENT_IDS,
} = docs;

/*
  문서에 실을 그림.

  원본 PNG 가 아니라 `npm run docs:shots` 이 줄여 둔 것을 쓴다.
  원본을 그대로 넣으면 문서가 10MB 를 넘겨 열기도 보내기도 어려워진다.
*/
const SHOT_DIR = join(ROOT, 'docs', 'screenshots', 'doc');

/* ────────────────────────────────────────────────────────────────
   2. 원본과 코드가 어긋나지 않는지 본다
   문서를 만들기 전에 멈춰야, 사실과 다른 문서가 배포되지 않는다.
   ──────────────────────────────────────────────────────────────── */

const problems = [];

/** 어드민 메뉴에 실제로 있는 화면 id. 데이터 선언이라 글자만 훑어도 충분하다. */
const navigationSource = readFileSync(join(ROOT, 'apps', 'admin', 'src', 'config', 'navigation.ts'), 'utf8');
const navigationIds = new Set([...navigationSource.matchAll(/id: '([a-z0-9-]+)',/g)].map((match) => match[1]));

const documentedAdminIds = new Set(
  DOC_SCREENS.filter((screen) => screen.app === 'admin').map((screen) => screen.id),
);
for (const id of navigationIds) {
  if (!documentedAdminIds.has(id)) problems.push(`메뉴에는 있으나 화면 정의가 없습니다: ${id}`);
}
for (const id of documentedAdminIds) {
  if (!navigationIds.has(id)) problems.push(`화면 정의에는 있으나 메뉴에 없습니다: ${id}`);
}

/** 기능 코드와 요구 ID 는 문서 전체에서 겹치지 않아야 한다. */
const seenCodes = new Set();
for (const screen of DOC_SCREENS) {
  if (seenCodes.has(screen.code)) problems.push(`대응 기능 코드가 겹칩니다: ${screen.code}`);
  seenCodes.add(screen.code);
  for (const feature of screen.features) {
    if (!feature.action || !feature.process || !feature.result) {
      problems.push(`동작·처리·결과 중 빈 칸이 있습니다: ${feature.id}`);
    }
  }
}

/**
 * 화면마다 캡처가 있는지, 그 파일이 실제로 있는지.
 *
 * 그림이 빠진 채로 문서가 나가면 «그 화면은 아직 없다»로 읽힌다.
 * 이름만 적고 파일이 없는 경우도 같은 결과이므로 함께 본다.
 */
const shotExists = (file) => existsSync(join(SHOT_DIR, `${file}.jpg`));

for (const screen of DOC_SCREENS) {
  const key = `${screen.app}/${screen.id}`;
  const captures = DOC_CAPTURES[key] ?? [];
  if (captures.length === 0) {
    problems.push(`화면 캡처가 없습니다: ${key}`);
    continue;
  }
  for (const capture of captures) {
    if (!shotExists(capture.file)) {
      problems.push(`캡처 파일이 없습니다: ${capture.file} (${key})`);
    }
  }
}

for (const [sampleId, capture] of Object.entries(DOC_SAMPLE_CAPTURES)) {
  if (!shotExists(capture.file)) problems.push(`샘플 캡처 파일이 없습니다: ${capture.file} (${sampleId})`);
}

/** 운영 규칙이 가리키는 기능 코드가 실제로 있는지. */
for (const rule of DOC_OPERATION_RULES) {
  for (const code of rule.related) {
    if (!seenCodes.has(code)) problems.push(`${rule.id} 이(가) 없는 기능을 가리킵니다: ${code}`);
  }
}

if (problems.length > 0) {
  console.error('요구사항 원본과 코드가 어긋납니다. 문서를 만들지 않았습니다.\n');
  for (const problem of problems) console.error(`  · ${problem}`);
  exit(1);
}

/* ────────────────────────────────────────────────────────────────
   3. 문서에 실을 값
   숫자는 전부 코드 상수에서 가져온다. 문서에 손으로 적지 않는다.
   ──────────────────────────────────────────────────────────────── */

const minutes = (ms) => `${Math.round(ms / 1000)}초`;

const BASELINE_VALUES = [
  ['납품 단계', `${kioskConfig.DELIVERY_PHASE}단계`, '노출되는 일정 재구성 종류를 결정한다'],
  [
    '일정 재구성 노출',
    `${refinements.getEnabledRefinements(kioskConfig.DELIVERY_PHASE).length}종 / 전체 ${refinements.REFINEMENT_ORDER.length}종`,
    'A단계 검수 범위는 2종 이상이다',
  ],
  ['등록 관광지', `${attractions.length}곳`, '권장 범위 약 20곳'],
  ['공식문서', `${officialDocuments.length}건`, '권장 범위 30∼50건'],
  [
    '무조작 복귀',
    `${minutes(kioskConfig.IDLE_TIMEOUTS_MS.warnAfter)} 뒤 안내 · ${minutes(kioskConfig.IDLE_TIMEOUTS_MS.resetAfter)} 뒤 복귀`,
    '결과화면은 안내까지 ' + minutes(kioskConfig.IDLE_TIMEOUTS_MS.resultWarnAfter),
  ],
  ['분석화면 노출', `${(kioskConfig.ANALYSIS_TIMING_MS.totalDuration / 1000).toFixed(1)}초`, '제안서 기준 약 3∼7초'],
  [
    '신뢰도 기준',
    `${scoring.TRUST_THRESHOLDS.exclude}점 미만 제외 · ${scoring.TRUST_THRESHOLDS.demote}점 미만 순위 강등`,
    '정보 신뢰도 100점 기준',
  ],
  [
    '문서 갱신일',
    `${scoring.DOCUMENT_FRESHNESS_DAYS.fresh}일 이내 최신 · ${scoring.DOCUMENT_FRESHNESS_DAYS.stale}일 초과 오래된 정보`,
    '신뢰도 계산에 직접 쓰인다',
  ],
  [
    '일정 상한',
    `하루 ${scoring.SCHEDULING.maxStopsPerDay}곳 · 같은 유형 ${scoring.MAX_STOPS_PER_CATEGORY}회`,
    '자원 다양성과 화면 표시 한계',
  ],
  [
    '이동시간 추정',
    `직선거리 × ${scoring.TRAVEL_MODEL.detourFactor} · 1km당 ${scoring.TRAVEL_MODEL.minutesPerKilometer}분 · 승하차 ${scoring.TRAVEL_MODEL.boardingOverheadMinutes}분`,
    `대중교통 선택 시 ×${scoring.TRAVEL_MODEL.transitMultiplier}`,
  ],
  [
    '검수 목표',
    `출처 제시율 ${kioskConfig.ACCEPTANCE_TARGETS.sourceCitationRate}% · 근거 일치율 ${kioskConfig.ACCEPTANCE_TARGETS.answerEvidenceMatchRate}% · 응답시간 중앙값 ${kioskConfig.ACCEPTANCE_TARGETS.medianResponseMs / 1000}초`,
    '제안서 17.2 검수기준',
  ],
  [
    '오프라인 시연모드',
    kioskConfig.OFFLINE_DEMO_MODE ? '켜짐' : '꺼짐',
    '외부 호출 없이 내장 엔진으로만 동작한다',
  ],
];

/* ────────────────────────────────────────────────────────────────
   4. 요구 ID 매기기
   고객(키오스크·모바일)과 관리자(어드민)를 나누어 번호를 준다.
   ──────────────────────────────────────────────────────────────── */

const clientScreens = DOC_SCREENS.filter((screen) => screen.app !== 'admin');
const adminScreens = DOC_SCREENS.filter((screen) => screen.app === 'admin');

/* 번호를 매기는 규칙은 화면 정의 원본이 갖는다 — 캡처 묶음도 같은 번호를 쓴다. */
const requirementId = (screen) => DOC_REQUIREMENT_IDS[`${screen.app}/${screen.id}`];

const clientRows = clientScreens.map((screen) => ({ screen, id: requirementId(screen) }));
const adminRows = adminScreens.map((screen) => ({ screen, id: requirementId(screen) }));
const allRows = [...clientRows, ...adminRows];

/* ────────────────────────────────────────────────────────────────
   5. HTML 만들기
   외부 라이브러리를 쓰지 않는다. 파일 하나로 열리고 인쇄된다.
   ──────────────────────────────────────────────────────────────── */

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 그림 한 장을 문서 안에 담는다.
 *
 * 바깥 파일을 가리키면 문서만 보냈을 때 그림이 통째로 빠진다.
 * 파일 하나로 열려야 하므로 내용을 안에 넣는다.
 */
const figure = (capture) => {
  const jpeg = readFileSync(join(SHOT_DIR, `${capture.file}.jpg`));
  return `<figure class="shot">
      <img src="data:image/jpeg;base64,${jpeg.toString('base64')}" alt="${escape(capture.file)}" loading="lazy">
      <figcaption>${escape(capture.caption)}</figcaption>
    </figure>`;
};

/** 기능 한 줄을 «동작 · 처리 · 결과» 순서의 한 항목으로 적는다. */
const featureLine = (feature) => `${feature.action} ${feature.process} ${feature.result}`;

const detailItems = (screen) => [
  ...screen.features.map((feature) => ({ kind: 'do', text: featureLine(feature) })),
  ...screen.guards.map((guard) => ({ kind: 'guard', text: guard })),
];

const cell = (value) => `<td>${escape(value)}</td>`;

const requirementTable = (rows) => `
<div class="table-scroll">
  <table class="req-table">
    <thead>
      <tr>
        <th class="col-no">순번</th>
        <th class="col-id">요구 ID</th>
        <th class="col-area">영역</th>
        <th class="col-screen">화면</th>
        <th class="col-req">요구사항</th>
        <th class="col-detail">세부 요구</th>
        <th class="col-code">대응 기능</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          ({ screen, id }, index) => `
      <tr>
        <td class="col-no">${index + 1}</td>
        <td class="col-id"><span class="req-id">${escape(id)}</span></td>
        ${cell(screen.area)}
        <td class="col-screen"><span class="screen-name">${escape(screen.name)}</span><span class="screen-route">${escape(screen.route)}</span>${
          screen.readiness === 'pending'
            ? '<span class="tag tag-pending">백엔드 대기</span>'
            : '<span class="tag tag-working">동작</span>'
        }</td>
        <td class="col-req">${escape(screen.requirement)}</td>
        <td class="col-detail">
          <ul>
            ${detailItems(screen)
              .map(
                (item) =>
                  `<li class="${item.kind === 'guard' ? 'is-guard' : ''}">${
                    item.kind === 'guard' ? '<span class="guard-mark">예외</span> ' : ''
                  }${escape(item.text)}</li>`,
              )
              .join('\n            ')}
          </ul>
        </td>
        <td class="col-code"><span class="fn-code">${escape(screen.code)}</span></td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</div>`;

const simpleTable = (headers, rows, className = '') => `
<div class="table-scroll">
  <table class="${className}">
    <thead><tr>${headers.map((header) => `<th>${escape(header)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${row
              .map((value, index) => (index === 0 ? `<td class="col-no">${value}</td>` : `<td>${value}</td>`))
              .join('')}</tr>`,
        )
        .join('\n      ')}
    </tbody>
  </table>
</div>`;

const section = (id, number, title, body, options = {}) => `
<section class="doc-section${options.tone ? ` tone-${options.tone}` : ''}" id="${id}">
  <div class="section-head">
    <h2><span class="section-no">${number}</span>${escape(title)}</h2>
    <button type="button" class="fold" data-fold="${id}" aria-expanded="true">접기</button>
  </div>
  <div class="section-body" id="${id}-body">
    ${body}
  </div>
</section>`;

const codeList = (codes) => codes.map((code) => `<span class="fn-code">${escape(code)}</span>`).join(' ');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escape(DOC_PROJECT.name)} ${escape(DOC_PROJECT.documentTitle)}</title>
<style>
  :root {
    --ink: #14181f;
    --ink-soft: #414b59;
    --ink-faint: #6b7688;
    --line: #dde2ea;
    --line-strong: #c3ccd9;
    --paper: #ffffff;
    --page: #eef1f6;
    --head: #f4f6fa;
    --accent: #1f4f8f;
    --accent-soft: #eaf1fa;
    --guard: #8a4b12;
    --guard-soft: #fbf1e6;
    --pending: #7a4a86;
    --pending-soft: #f5edf7;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--page);
    color: var(--ink);
    font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.75;
    word-break: keep-all;
  }
  .sheet {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 24px 96px;
  }
  .doc-head {
    background: var(--paper);
    border: 1px solid var(--line);
    border-top: 4px solid var(--accent);
    padding: 40px 44px 32px;
    margin: 32px 0 0;
  }
  .doc-head .eyebrow { color: var(--accent); font-weight: 700; letter-spacing: .04em; margin: 0 0 8px; font-size: 13px; }
  .doc-head h1 { margin: 0; font-size: 30px; line-height: 1.35; letter-spacing: -.01em; }
  .doc-head .subtitle { margin: 10px 0 0; color: var(--ink-soft); font-size: 15px; }
  .doc-head .issued { margin: 22px 0 0; padding-top: 14px; border-top: 1px solid var(--line); color: var(--ink-faint); font-size: 13px; }
  .doc-section {
    background: var(--paper);
    border: 1px solid var(--line);
    border-top: 0;
    padding: 34px 44px 40px;
  }
  .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; border-bottom: 2px solid var(--ink); padding-bottom: 10px; margin-bottom: 24px; }
  .doc-section h2 { font-size: 20px; margin: 0; letter-spacing: -.01em; }
  .section-no { display: inline-block; min-width: 30px; color: var(--accent); font-variant-numeric: tabular-nums; }
  .fold { font: inherit; font-size: 13px; color: var(--ink-faint); background: none; border: 1px solid var(--line); border-radius: 3px; padding: 3px 10px; cursor: pointer; }
  .fold:hover { color: var(--accent); border-color: var(--line-strong); }
  .doc-section h3 { font-size: 16px; margin: 30px 0 10px; }
  .doc-section h3:first-child { margin-top: 0; }
  .doc-section p { margin: 0 0 12px; color: var(--ink-soft); }
  .doc-section > .section-body > p:last-child { margin-bottom: 0; }
  .lead { color: var(--ink-soft); }

  .tone-admin .section-no { color: #2f6b45; }
  .tone-ops .section-no { color: #8a4b12; }
  .tone-check .section-no { color: #8a2f4b; }

  .table-scroll { overflow-x: auto; margin: 14px 0 4px; -webkit-overflow-scrolling: touch; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; line-height: 1.65; }
  th, td { border: 1px solid var(--line); padding: 10px 12px; vertical-align: top; text-align: left; }
  thead th { background: var(--head); font-weight: 700; font-size: 13px; color: var(--ink); white-space: nowrap; }
  tbody tr:nth-child(even) td { background: #fbfcfe; }
  td ul { margin: 0; padding-left: 18px; }
  td li { margin: 0 0 6px; }
  td li:last-child { margin-bottom: 0; }
  td li.is-guard { color: var(--guard); }
  .col-no { width: 46px; text-align: center; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
  .col-id { width: 96px; }
  .col-area { width: 96px; }
  .col-screen { width: 168px; }
  .col-req { width: 25%; }
  .col-detail { width: 34%; }
  .col-code { width: 118px; }

  .req-id { display: inline-block; font-weight: 700; font-size: 12.5px; color: var(--accent); background: var(--accent-soft); border: 1px solid #cfe0f2; border-radius: 3px; padding: 2px 7px; white-space: nowrap; }
  .fn-code { display: inline-block; font-family: 'Consolas', 'D2Coding', monospace; font-size: 12px; color: var(--ink-soft); background: #f3f5f9; border: 1px solid var(--line); border-radius: 3px; padding: 1px 6px; white-space: nowrap; margin: 0 3px 3px 0; }
  .screen-name { display: block; font-weight: 600; }
  .screen-route { display: block; color: var(--ink-faint); font-size: 12px; font-family: 'Consolas', 'D2Coding', monospace; margin-top: 2px; overflow-wrap: break-word; }
  .tag { display: inline-block; margin-top: 6px; font-size: 11.5px; font-weight: 600; border-radius: 3px; padding: 1px 6px; }
  .tag-working { color: #2f6b45; background: #eaf5ee; border: 1px solid #cbe5d6; }
  .tag-pending { color: var(--pending); background: var(--pending-soft); border: 1px solid #e4d3ea; }
  .guard-mark { display: inline-block; font-size: 11.5px; font-weight: 700; color: var(--guard); background: var(--guard-soft); border: 1px solid #ecdcc6; border-radius: 3px; padding: 0 5px; }

  ul.rules { margin: 8px 0 0; padding-left: 20px; color: var(--ink-soft); }
  ul.rules li { margin-bottom: 10px; }
  ul.rules li:last-child { margin-bottom: 0; }

  .shot { margin: 14px 0 0; }
  .shot img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 4px; background: #fff; }
  .shot figcaption { margin-top: 8px; color: var(--ink-faint); font-size: 13px; line-height: 1.6; }
  .shot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px; }
  .screen-block { padding-top: 26px; margin-top: 26px; border-top: 1px solid var(--line); }
  .screen-block:first-of-type { padding-top: 4px; margin-top: 0; border-top: 0; }
  .screen-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 0 0 4px; font-size: 16px; }
  .screen-title .fn-code { margin: 0; }
  .app-band { margin: 34px 0 14px; padding: 8px 14px; background: var(--head); border-left: 3px solid var(--accent); font-weight: 700; font-size: 14px; }
  .app-band:first-of-type { margin-top: 8px; }

  .sample { margin-top: 30px; }
  .sample:first-of-type { margin-top: 8px; }
  .sample-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .sample-head h3 { margin: 0; font-size: 16px; }
  .side { font-size: 11.5px; font-weight: 700; border-radius: 3px; padding: 2px 8px; white-space: nowrap; }
  .side-frontend { color: var(--accent); background: var(--accent-soft); border: 1px solid #cfe0f2; }
  .side-backend { color: #2f6b45; background: #eaf5ee; border: 1px solid #cbe5d6; }
  .sample-path { font-family: 'Consolas', 'D2Coding', monospace; font-size: 12px; color: var(--ink-faint); }
  .code-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 4px; background: #fbfcfe; margin: 12px 0 0; }
  pre { margin: 0; padding: 16px 18px; }
  pre, code { font-family: 'Consolas', 'D2Coding', 'Menlo', monospace; font-size: 12.5px; line-height: 1.7; color: var(--ink); }
  pre code { white-space: pre; }
  .sample .rules { margin-top: 12px; }

  .note {
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    padding: 14px 18px;
    margin: 16px 0 0;
    color: var(--ink-soft);
  }
  .note.warn { border-left-color: var(--guard); background: var(--guard-soft); }

  .doc-foot { color: var(--ink-faint); font-size: 12.5px; padding: 20px 44px 0; }

  @media (max-width: 720px) {
    .doc-head, .doc-section, .doc-foot { padding-left: 20px; padding-right: 20px; }
    .doc-head h1 { font-size: 23px; }
    table { font-size: 13px; }
    .col-req, .col-detail { min-width: 260px; }
  }

  @media print {
    :root { --page: #fff; }
    body { font-size: 10pt; line-height: 1.55; background: #fff; }
    .sheet { max-width: none; padding: 0; }
    .fold { display: none !important; }
    .doc-head, .doc-section { border: 0; padding: 0; margin: 0; }
    .doc-head { border-bottom: 2pt solid #000; padding-bottom: 10pt; margin-bottom: 14pt; }
    .doc-section { break-before: page; padding-top: 4pt; }
    .doc-section:first-of-type { break-before: auto; }
    .section-body { display: block !important; }
    .section-head { border-bottom: 1.5pt solid #000; }
    .table-scroll { overflow: visible; }
    table { font-size: 8.6pt; }
    th, td { border: 0.5pt solid #666; padding: 4pt 5pt; }
    thead { display: table-header-group; }
    thead th { background: #eee !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tbody tr { break-inside: avoid; }
    tr, h2, h3 { break-after: auto; }
    .req-id, .fn-code, .tag, .guard-mark { border: 0.5pt solid #999; background: none !important; }
    .note { border-left: 2pt solid #000; background: none !important; }
    .code-scroll { overflow: visible; border: 0.5pt solid #666; background: none !important; }
    pre, code { font-size: 7.6pt; line-height: 1.5; }
    pre { padding: 5pt 6pt; }
    pre code { white-space: pre-wrap; }
    .side, .sample-path { border: 0.5pt solid #999; background: none !important; }
    .sample { break-inside: auto; }
    .shot { break-inside: avoid; }
    .shot img { border: 0.5pt solid #666; max-height: 150mm; object-fit: contain; object-position: top; }
    .screen-block { break-inside: avoid; border-top: 0.5pt solid #999; }
    .app-band { background: none !important; border-left: 2pt solid #000; }
    .sample-head { break-after: avoid; }
    a { color: inherit; text-decoration: none; }
    @page { size: A4; margin: 14mm 12mm; }
  }
</style>
</head>
<body>
<div class="sheet">

  <header class="doc-head">
    <p class="eyebrow">${escape(DOC_PROJECT.scope)}</p>
    <h1>${escape(DOC_PROJECT.name)} ${escape(DOC_PROJECT.documentTitle)}</h1>
    <p class="subtitle">${escape(DOC_PROJECT.fullName)}</p>
    <p class="issued">작성일 ${escape(ISSUED_AT)}</p>
  </header>

  ${section(
    's1',
    '1',
    '사업 배경과 목표',
    `
    <h3>1.1 배경</h3>
    ${DOC_BACKGROUND.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('\n    ')}

    <h3>1.2 목표</h3>
    <p class="lead">목표는 검수 때 확인할 수 있는 결과로 적는다.</p>
    ${simpleTable(
      ['순번', '구분', '목표', '판단 기준'],
      DOC_GOALS.map((goal, index) => [index + 1, escape(goal.category), escape(goal.goal), escape(goal.criterion)]),
    )}

    <h3>1.3 대상 사용자</h3>
    ${simpleTable(
      ['순번', '사용자', '상황', '이 서비스에서 하는 일'],
      DOC_PERSONAS.map((persona, index) => [
        index + 1,
        escape(persona.user),
        escape(persona.situation),
        escape(persona.task),
      ]),
    )}`,
  )}

  ${section(
    's2',
    '2',
    '서비스 구성과 정보 구조',
    `
    ${simpleTable(
      ['순번', '구분', '화면 수', '영역 구성', '비고'],
      DOC_COMPOSITION.map((row, index) => {
        const appId = ['kiosk', 'mobile', 'admin'][index];
        const count = DOC_SCREENS.filter((screen) => screen.app === appId).length;
        return [index + 1, escape(row.service), `${count}`, escape(row.areas), escape(row.note)];
      }),
    )}
    <p class="note">${escape(DOC_DATA_NOTE)}</p>`,
  )}

  ${section(
    's3',
    '3',
    '고객 서비스 요구사항',
    `
    <p class="lead">관람객이 서비스에서 해결해야 하는 것을 화면 단위로 정리한다. 「대응 기능」은 이 요구를 구현한 기능 명세서의 항목이며, 「예외」로 표시한 줄은 자료가 없거나 조건을 갖추지 못했을 때의 처리다.</p>
    ${requirementTable(clientRows)}`,
  )}

  ${section(
    's4',
    '4',
    '관리자 서비스 요구사항',
    `
    <p class="lead">운영자와 연구자가 서비스를 유지하고 결과를 확인하기 위해 필요한 관리 기능을 정리한다. 「백엔드 대기」로 표시한 화면은 화면과 판정 규칙이 준비되어 있으나 값을 채울 자료를 서버가 내려줘야 한다.</p>
    ${requirementTable(adminRows)}`,
    { tone: 'admin' },
  )}

  ${section(
    's5',
    '5',
    '운영 요구사항',
    `
    <p class="lead">표시 · 기록 · 신뢰도 · 일정 · 운영 · 개인정보에 걸리는 공통 규칙이다. 화면 하나에 매이지 않고 서비스 전반에 적용되므로 따로 정리한다.</p>
    ${simpleTable(
      ['순번', '요구 ID', '주제', '적용 대상', '요구사항', '관련 기능'],
      DOC_OPERATION_RULES.map((rule, index) => [
        index + 1,
        `<span class="req-id">${escape(rule.id)}</span>`,
        escape(rule.topic),
        escape(rule.target),
        escape(rule.requirement),
        codeList(rule.related),
      ]),
      'ops-table',
    )}`,
    { tone: 'ops' },
  )}

  ${section(
    's6',
    '6',
    '외부 서비스 및 준비 사항',
    `
    <p class="lead">${escape(DOC_EXTERNAL_INTRO)}</p>
    <h3>6.1 외부 서비스</h3>
    ${simpleTable(
      ['순번', '요구 ID', '준비 항목', '주체', '내용', '미준비 시 영향'],
      DOC_EXTERNAL_ITEMS.map((item, index) => [
        index + 1,
        `<span class="req-id">${escape(item.id)}</span>`,
        escape(item.item),
        escape(item.owner),
        escape(item.content),
        escape(item.impact),
      ]),
    )}
    <h3>6.2 그 밖의 준비 사항</h3>
    ${simpleTable(
      ['순번', '요구 ID', '준비 항목', '주체', '내용', '미준비 시 영향'],
      DOC_PREPARATION_ITEMS.map((item, index) => [
        index + 1,
        `<span class="req-id">${escape(item.id)}</span>`,
        escape(item.item),
        escape(item.owner),
        escape(item.content),
        escape(item.impact),
      ]),
    )}
    <p class="note warn">정책 · 요금 · 사용량 한도는 제공 사업자가 바꿀 수 있다. 이 문서에 확정 값으로 적지 않으며, 계약 시점에 다시 확인한다.</p>`,
  )}

  ${section(
    's7',
    '7',
    '제약 사항과 전제',
    `
    <ul class="rules">
      ${DOC_CONSTRAINTS.map((rule) => `<li>${escape(rule)}</li>`).join('\n      ')}
    </ul>
    <h3>7.1 현재 적용 중인 기준값</h3>
    <p class="lead">아래 값은 저장소의 설정 상수를 그대로 옮긴 것이다. 값이 바뀌면 이 표도 함께 바뀐다.</p>
    ${simpleTable(
      ['순번', '항목', '적용 값', '비고'],
      BASELINE_VALUES.map((row, index) => [index + 1, escape(row[0]), escape(row[1]), escape(row[2])]),
    )}`,
  )}

  ${section(
    's8',
    '8',
    '요구사항 추적표',
    `
    <p class="lead">요구사항과 구현 기능을 잇는다. 검수할 때 요구 ID 로 시작해 기능 코드로 확인하고, 그 기능의 세부 동작은 「기능 명세서」의 같은 코드 항목에서 본다.</p>
    ${simpleTable(
      ['순번', '요구 ID', '구분', '화면', '대응 기능', '화면 경로', '세부 기능 수', '상태'],
      allRows.map(({ screen, id }, index) => [
        index + 1,
        `<span class="req-id">${escape(id)}</span>`,
        escape(screen.app === 'admin' ? '관리자' : '고객'),
        escape(screen.name),
        `<span class="fn-code">${escape(screen.code)}</span>`,
        `<span class="screen-route">${escape(screen.route)}</span>`,
        `${screen.features.length}`,
        screen.readiness === 'pending'
          ? '<span class="tag tag-pending">백엔드 대기</span>'
          : '<span class="tag tag-working">동작</span>',
      ]),
    )}`,
  )}

  ${section(
    's9',
    '9',
    '확인 필요 사항',
    `
    <p class="lead">발주 자료만으로는 확정할 수 없어 결정이 필요한 항목이다. 정해지지 않은 것을 임의로 확정해 적지 않고 여기에 모은다.</p>
    ${simpleTable(
      ['순번', '구분', '확인 필요 사항', '결정이 필요한 이유', '영향 범위'],
      DOC_OPEN_QUESTIONS.map((item, index) => [
        index + 1,
        escape(item.category),
        escape(item.question),
        escape(item.reason),
        escape(item.affects),
      ]),
    )}`,
    { tone: 'check' },
  )}

  ${section(
    's10',
    '10',
    '샘플 코드',
    `
    <p class="lead">${escape(DOC_SAMPLE_INTRO)}</p>
    ${DOC_CODE_SAMPLES.map(
      (sample) => `
    <div class="sample">
      <div class="sample-head">
        <span class="side side-${sample.side}">${escape(DOC_SAMPLE_SIDE_LABELS[sample.side])}</span>
        <h3>${escape(sample.title)}</h3>
        <span class="sample-path">${escape(sample.path)}</span>
      </div>
      <p>${escape(sample.purpose)}</p>
      ${DOC_SAMPLE_CAPTURES[sample.id] ? figure(DOC_SAMPLE_CAPTURES[sample.id]) : ''}
      <div class="code-scroll"><pre><code>${escape(sample.code)}</code></pre></div>
      <ul class="rules">
        ${sample.notes.map((note) => `<li>${escape(note)}</li>`).join('')}
      </ul>
    </div>`,
    ).join('')}
    <p class="note">두 코드는 같은 계약의 양쪽이다. 응답 필드의 이름과 뜻이 이 모양을 유지하면 화면 코드를 고치지 않고 백엔드를 붙일 수 있다. 화면별로 어떤 자료를 기다리는지는 저장소의 <code>packages/core/src/integration/contracts.ts</code> 에 타입으로 적혀 있다.</p>`,
  )}

  ${section(
    's11',
    '11',
    '화면 캡처',
    `
    <p class="lead">각 화면이 지금 어떻게 생겼는지 그대로 싣는다. 그림은 실행 중인 화면을 찍은 것이며, 자료가 없는 화면은 «자료가 없는 그대로» 찍혀 있다 — 채워진 모습을 만들어 넣지 않는다. 자세히 볼 일이 있으면 저장소의 <code>docs/screenshots/</code> 에 원본이 있다.</p>
    ${['kiosk', 'mobile', 'admin']
      .map(
        (app) => `
    <p class="app-band">${escape(DOC_APP_LABELS[app])}</p>
    ${DOC_SCREENS.filter((screen) => screen.app === app)
      .map((screen) => {
        const row = allRows.find((entry) => entry.screen === screen);
        const captures = DOC_CAPTURES[`${screen.app}/${screen.id}`] ?? [];
        return `
    <div class="screen-block">
      <h3 class="screen-title">
        <span class="req-id">${escape(row.id)}</span>
        ${escape(screen.name)}
        <span class="fn-code">${escape(screen.code)}</span>
        <span class="screen-route">${escape(screen.route)}</span>
      </h3>
      <p>${escape(screen.purpose)}</p>
      <div class="${captures.length > 1 ? 'shot-grid' : ''}">
        ${captures.map((capture) => figure(capture)).join('')}
      </div>
      ${simpleTable(
        ['순번', '영역', '표시 내용', '자료 출처'],
        screen.areas.map((area, index) => [index + 1, escape(area.name), escape(area.content), escape(area.source)]),
      )}
    </div>`;
      })
      .join('')}`,
      )
      .join('')}`,
  )}

  <p class="doc-foot">이 문서는 저장소의 화면 정의 원본에서 생성된다. 내용을 고칠 때는 이 파일이 아니라 <code>packages/core/src/docs/</code> 의 원본을 고치고 <code>npm run docs:srs</code> 를 다시 실행한다.</p>
</div>

<script>
  /*
    문서 내용이 먼저다. 스크립트가 없어도 표는 모두 펼쳐진 채로 읽힌다 —
    접기는 «있으면 편한 것»이지 «있어야 보이는 것»이 아니다.
  */
  (function () {
    // 섹션 접기 — 인쇄에는 영향을 주지 않는다(@media print 가 항상 펼친다).
    document.querySelectorAll('.fold').forEach(function (button) {
      button.addEventListener('click', function () {
        var target = document.getElementById(button.dataset.fold + '-body');
        if (!target) return;
        var folded = target.style.display === 'none';
        target.style.display = folded ? '' : 'none';
        button.textContent = folded ? '접기' : '펼치기';
        button.setAttribute('aria-expanded', folded ? 'true' : 'false');
      });
    });

    // 인쇄 직전에는 접힌 것을 모두 펼친다.
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('.section-body').forEach(function (node) { node.style.display = ''; });
    });
  })();
</script>
</body>
</html>
`;

/* ────────────────────────────────────────────────────────────────
   6. 내보내기
   ──────────────────────────────────────────────────────────────── */

const OUTPUTS = [
  join(ROOT, 'docs', 'AI남도프리즘_요구사항정의서.html'),
  // 발주 자료와 나란히 두어 바로 열어 볼 수 있게 한 벌 더 둔다.
  join(ROOT, '..', 'AI 남도 프리즘 요구사항 정의서.html'),
];

for (const output of OUTPUTS) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html, 'utf8');
}

const bytes = Buffer.byteLength(html, 'utf8');
console.log(`요구사항 정의서를 만들었습니다 — ${(bytes / 1024).toFixed(0)}KB`);
console.log(`  고객 요구 ${clientRows.length}건 · 관리자 요구 ${adminRows.length}건 · 운영 규칙 ${DOC_OPERATION_RULES.length}건 · 확인 필요 ${DOC_OPEN_QUESTIONS.length}건`);
for (const output of OUTPUTS) console.log(`  ${output.replace(cwd() + '\\', '')}`);
