/**
 * 테스트 실행기.
 *
 * TypeScript 를 CommonJS 로 컴파일한 뒤 Node 내장 테스트 러너로 돌린다.
 * 별도 테스트 프레임워크나 네이티브 바이너리에 의존하지 않으므로,
 * 인계받은 쪽에서 `npm install` 만으로 검수 재현이 가능하다.
 *
 *     npm test
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = join(HERE, '..');
const REPO_ROOT = join(CORE_ROOT, '..', '..');
const BUILD_DIR = join(CORE_ROOT, '.build-tests');

execFileSync(
  process.execPath,
  [join(REPO_ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js'), '-p', join(CORE_ROOT, 'tsconfig.tests.json')],
  { stdio: 'inherit' },
);

// 코어 패키지는 ESM 이므로, 컴파일 산출물만 CommonJS 로 취급하도록 표시한다.
writeFileSync(join(BUILD_DIR, 'package.json'), '{ "type": "commonjs" }\n', 'utf8');

// 디렉터리 인자는 경로에 공백이 있으면 해석되지 않으므로 파일을 직접 넘긴다.
const testDir = join(BUILD_DIR, 'tests');
const testFiles = readdirSync(testDir)
  .filter((file) => file.endsWith('.test.js'))
  .map((file) => join(testDir, file));

if (testFiles.length === 0) {
  console.error('실행할 테스트 파일이 없습니다.');
  process.exit(1);
}

execFileSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' },
});
