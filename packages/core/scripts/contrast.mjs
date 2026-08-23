/**
 * 색 대비 검사 보고서.
 *
 *     npm run contrast
 *
 * 네 가지 표시 조합(밝은/전시 × 일반/고대비)에서 실제 화면에 쓰이는
 * 글자색·배경색 조합의 WCAG 대비율을 측정한다.
 * 브라우저 없이 CSS 토큰을 직접 해석하므로 CI에서도 그대로 돌릴 수 있다.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = join(HERE, '..');
const REPO_ROOT = join(CORE_ROOT, '..', '..');
const BUILD_DIR = join(CORE_ROOT, '.build-scripts');
const STYLES_DIR = join(CORE_ROOT, 'src', 'styles');

execFileSync(
  process.execPath,
  [join(REPO_ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', join(CORE_ROOT, 'tsconfig.scripts.json')],
  { stdio: 'inherit' },
);
writeFileSync(join(BUILD_DIR, 'package.json'), '{ "type": "commonjs" }\n', 'utf8');

const require = createRequire(import.meta.url);
const { auditContrast, resolveTokenTable } = require(join(BUILD_DIR, 'design/contrast.js'));

const cssTexts = ['tokens.primitive.css', 'tokens.semantic.css'].map((file) =>
  readFileSync(join(STYLES_DIR, file), 'utf8'),
);

const CONTEXTS = [
  { theme: 'light', contrast: 'normal', label: '밝은 배경 · 일반' },
  { theme: 'light', contrast: 'high', label: '밝은 배경 · 고대비' },
  { theme: 'exhibition', contrast: 'normal', label: '전시 배경 · 일반' },
  { theme: 'exhibition', contrast: 'high', label: '전시 배경 · 고대비' },
];

let failures = 0;

for (const context of CONTEXTS) {
  const tokens = resolveTokenTable(cssTexts, context);
  const results = auditContrast(tokens);

  console.log(`\n■ ${context.label}`);
  for (const result of results) {
    const mark = result.passes ? ' ' : '✗';
    if (!result.passes) failures += 1;
    console.log(
      `  ${mark} ${result.label.padEnd(22)} ${String(result.ratio).padStart(6)}:1  (기준 ${result.minimum}:1)`,
    );
  }
}

console.log(
  failures === 0
    ? `\n전체 통과 — ${CONTEXTS.length}개 조합 × ${auditContrast(resolveTokenTable(cssTexts, CONTEXTS[0])).length}개 조합 검사`
    : `\n미달 ${failures}건 — 위 ✗ 표시 항목의 토큰을 조정하십시오.`,
);

process.exit(failures === 0 ? 0 : 1);
