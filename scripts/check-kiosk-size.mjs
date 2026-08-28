/**
 * 키오스크 글자·조작부 물리 크기 검사.
 *
 *     npm run check:size          모니터 크기별 표
 *     npm run check:size 43       43인치를 기준으로 판정
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 무인정보단말기 접근성 기준은 **밀리미터**로 정해져 있다.
 *
 *   · 화면상의 모든 글자는 높이 12mm 이상
 *   · 모든 조작부는 한 변 12mm 이상, 이웃한 조작부 사이 간격 2.5mm 이상
 *   · 27인치 이상 화면 권장
 *   (출처: 무인정보단말기 UI 가이드 / KS X 9211)
 *
 * 그런데 우리가 코드에 적는 값은 픽셀이다. 같은 24px 라도 32인치에서는 7mm,
 * 55인치에서는 15mm 다 — **모니터 크기를 모르면 지켰는지 알 수 없다.**
 * 눈으로는 판정할 수 없고, 화면을 캡처해 봐도 알 수 없다. 그래서 계산으로 잰다.
 *
 * ── 무엇을 답해 주는가 ─────────────────────────────────────────────
 * 모니터가 정해졌으면 «지금 크기로 되는가»를, 아직 안 정해졌으면
 * «최소 몇 인치가 필요한가»를 답한다. 뒤엣것이 발주처의 하드웨어 결정에 필요한 값이다.
 *
 * 브라우저를 띄우지 않는다. 토큰 파일의 숫자를 직접 읽으므로 어디서나 같은 답이 나온다.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, '..', 'packages', 'core', 'src', 'styles', 'tokens.primitive.css');

/** 기준값. 출처: 무인정보단말기 UI 가이드(글자 12mm · 조작부 한 변 12mm · 간격 2.5mm). */
const MIN_TEXT_MM = 12;
const MIN_CONTROL_SIDE_MM = 12;
const MIN_GAP_MM = 2.5;
/** 지침이 권장하는 최소 화면 크기(인치). */
const RECOMMENDED_INCHES = 27;

/** 전시장에서 실제로 쓰는 세로형 크기들. 이 가운데 하나를 고르게 된다. */
const CANDIDATE_INCHES = [32, 43, 49, 55, 65];

/** 키오스크 해상도. 세로로 세워 짧은 변이 1080px 를 갖는다. */
const SHORT_SIDE_PX = 1080;

/** 브라우저 기본 글꼴 크기. rem 을 px 로 바꾸는 데 쓴다. */
const ROOT_PX = 16;

/* ── 토큰 읽기 ───────────────────────────────────────────────────── */

const css = readFileSync(TOKENS, 'utf8');

/** `--이름: 1.25rem;` 을 찾아 px 로 바꾼다. */
function tokenPx(name) {
  const found = css.match(new RegExp(`--${name}:\\s*([0-9.]+)rem`));
  if (found === null) throw new Error(`토큰을 찾지 못했습니다: --${name}`);
  return Number(found[1]) * ROOT_PX;
}

/**
 * 16:9 화면의 짧은 변 길이(mm).
 *
 * 대각선 D 인치에서 짧은 변은 D × 9/√(16²+9²) 인치다. 세로로 세우면 그 변에
 * 1080px 가 들어가므로, 이 값 하나로 px↔mm 환산이 끝난다.
 */
const shortSideMm = (inches) => (inches * 9) / Math.hypot(16, 9) * 25.4;
const pxPerMm = (inches) => SHORT_SIDE_PX / shortSideMm(inches);
const toMm = (px, inches) => px / pxPerMm(inches);
/** 이 픽셀 크기가 기준 mm 를 채우려면 최소 몇 인치여야 하는가. */
const minInchesFor = (px, mm) => (mm * SHORT_SIDE_PX * Math.hypot(16, 9)) / (px * 9 * 25.4);

/* ── 검사 대상 ───────────────────────────────────────────────────── */

/**
 * 글자 크기.
 *
 * 관람객이 읽는 것만 본다. 진행자 패널·바닥글처럼 서서 읽는 글이 아닌 것은
 * 같은 기준으로 재면 판정이 흐려지므로 «작은 글씨» 로 따로 묶어 참고만 한다.
 */
const TEXT = [
  { token: 'np-size-display', label: '대표 문장', mode: '일반' },
  { token: 'np-size-title', label: '화면 제목', mode: '일반' },
  { token: 'np-size-heading', label: '중제목', mode: '일반' },
  { token: 'np-size-subhead', label: '선택지·항목', mode: '일반' },
  { token: 'np-size-body', label: '본문', mode: '일반' },
  { token: 'np-size-label', label: '이름표', mode: '일반' },
  { token: 'np-size-caption', label: '보조 설명', mode: '일반' },
  { token: 'np-size-large-subhead', label: '선택지·항목', mode: '큰 글씨' },
  { token: 'np-size-large-body', label: '본문', mode: '큰 글씨' },
  { token: 'np-size-large-label', label: '이름표', mode: '큰 글씨' },
  { token: 'np-size-large-caption', label: '보조 설명', mode: '큰 글씨' },
];

const CONTROLS = [
  { token: 'np-control-sm', label: '작은 조작부', mode: '일반' },
  { token: 'np-control-md', label: '보통 조작부', mode: '일반' },
  { token: 'np-control-lg', label: '큰 조작부', mode: '일반' },
  { token: 'np-control-large-sm', label: '작은 조작부', mode: '큰 글씨' },
];

/** 조작부 사이 간격으로 실제 쓰는 가장 좁은 값. */
const GAPS = [
  { token: 'np-space-xs', label: '좁은 간격' },
  { token: 'np-space-sm', label: '보통 간격' },
];

/* ── 판정 ───────────────────────────────────────────────────────── */

const inches = Number(argv[2]);
const mm1 = (value) => value.toFixed(1);

if (Number.isFinite(inches) && inches > 0) {
  console.log(`\n화면 ${inches}인치 세로형 · ${SHORT_SIDE_PX}px 폭 기준 (1mm = ${pxPerMm(inches).toFixed(2)}px)\n`);

  let failed = 0;
  const line = (label, mode, px, mm, need) => {
    const ok = mm >= need;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? '✓' : '✗'} ${(mode + ' · ' + label).padEnd(22)} ${String(Math.round(px)).padStart(3)}px  ${mm1(mm).padStart(5)}mm  (기준 ${need}mm)`,
    );
  };

  console.log('글자 높이');
  for (const item of TEXT) {
    const px = tokenPx(item.token);
    line(item.label, item.mode, px, toMm(px, inches), MIN_TEXT_MM);
  }

  console.log('\n조작부 한 변');
  for (const item of CONTROLS) {
    const px = tokenPx(item.token);
    line(item.label, item.mode, px, toMm(px, inches), MIN_CONTROL_SIDE_MM);
  }

  console.log('\n조작부 사이 간격');
  for (const item of GAPS) {
    const px = tokenPx(item.token);
    line(item.label, '공통', px, toMm(px, inches), MIN_GAP_MM);
  }

  if (inches < RECOMMENDED_INCHES) {
    console.log(`\n! 지침은 ${RECOMMENDED_INCHES}인치 이상을 권장합니다.`);
  }

  console.log(
    failed === 0
      ? '\n전체 통과 — 이 화면 크기에서 모든 값이 기준을 넘습니다.\n'
      : `\n${failed}개 항목이 기준에 못 미칩니다.\n`,
  );
  exit(failed === 0 ? 0 : 1);
}

/* 크기를 주지 않았으면 «몇 인치부터 되는가» 를 답한다. */

console.log('\n화면 크기가 정해지지 않았습니다. 크기별로 기준을 채우는지 봅니다.\n');
console.log(`  기준 — 글자 높이 ${MIN_TEXT_MM}mm · 조작부 한 변 ${MIN_CONTROL_SIDE_MM}mm · 간격 ${MIN_GAP_MM}mm`);
console.log(`  (무인정보단말기 UI 가이드 / KS X 9211, 세로형 ${SHORT_SIDE_PX}px 폭 기준)\n`);

const header = ['항목'.padEnd(24), ...CANDIDATE_INCHES.map((n) => `${n}"`.padStart(7))].join('');
console.log(header);
console.log('─'.repeat(header.length));

for (const item of [...TEXT]) {
  const px = tokenPx(item.token);
  const cells = CANDIDATE_INCHES.map((n) => {
    const mm = toMm(px, n);
    return `${mm >= MIN_TEXT_MM ? '✓' : '✗'}${mm1(mm)}`.padStart(7);
  });
  console.log(`${(item.mode + ' · ' + item.label).padEnd(24)}${cells.join('')}`);
}

console.log('\n조작부·간격은 어느 크기에서도 기준을 넘습니다 — 아래에 최소 크기를 함께 적습니다.\n');

/** 각 묶음에서 가장 작은 값이 그 묶음의 판정을 결정한다. */
const smallest = (items, need) =>
  items
    .map((item) => ({ ...item, px: tokenPx(item.token), need }))
    .sort((a, b) => a.px - b.px)[0];

const rows = [
  { what: '일반 모드 글자', ...smallest(TEXT.filter((t) => t.mode === '일반'), MIN_TEXT_MM) },
  { what: '큰 글씨 모드 글자', ...smallest(TEXT.filter((t) => t.mode === '큰 글씨'), MIN_TEXT_MM) },
  { what: '조작부 한 변', ...smallest(CONTROLS, MIN_CONTROL_SIDE_MM) },
  { what: '조작부 간격', ...smallest(GAPS, MIN_GAP_MM) },
];

for (const row of rows) {
  const need = minInchesFor(row.px, row.need);
  console.log(
    `  ${row.what.padEnd(20)} 가장 작은 값 ${String(Math.round(row.px)).padStart(3)}px(${row.label}) → ${need.toFixed(0)}인치 이상 필요`,
  );
}

console.log(
  `\n지침은 ${RECOMMENDED_INCHES}인치 이상을 권장합니다. 화면 크기가 정해지면 그 값으로 다시 실행하세요.\n`,
);
