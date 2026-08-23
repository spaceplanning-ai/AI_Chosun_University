/**
 * 전시장 배포 꾸러미 생성.
 *
 *     npm run package:kiosk
 *
 * ── 왜 이 스크립트가 필요한가 ──────────────────────────────────────
 * Next 의 `output: 'standalone'` 은 서버 실행에 필요한 파일만 모아 준다.
 * **정적 자산(`.next/static`)과 `public/` 은 일부러 빼 놓는다** — 보통은 CDN이 맡기 때문이다.
 *
 * 전시장에는 CDN이 없다. 그대로 복사해 실행하면 서버는 뜨는데 CSS와 스크립트가
 * 전부 404가 나서, 글자만 남은 화면이 대형 모니터에 걸린다.
 * 빌드도 성공하고 서버 로그도 깨끗해서 현장에서 원인을 찾기 어렵다.
 *
 * 그래서 빠진 것을 채워 넣고, 실행 스크립트까지 붙여 **폴더째 복사하면 끝나는** 꾸러미로 만든다.
 * ──────────────────────────────────────────────────────────────────
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const OUT_DIR = join(REPO_ROOT, 'dist', 'kiosk');

/** standalone 이 앱 경로 구조를 그대로 재현하므로, 그 안쪽 경로를 맞춰 준다. */
const STANDALONE_APP = join('apps', 'kiosk');

console.log('1/4 프로덕션 빌드');
// npm 을 거치지 않고 Next CLI 를 현재 Node 로 직접 실행한다.
//   · Windows 의 npm 은 `.cmd` 래퍼인데, Node 20.12+ 는 보안상 shell 없이 이를 실행하지 않는다.
//   · shell:true 로 우회하면 경로에 공백이 있을 때 인자가 깨진다 (이 저장소 경로에 공백이 있다).
// 실행 파일을 process.execPath 로 고정하면 두 문제 모두 발생하지 않는다.
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
execFileSync(process.execPath, [nextBin, 'build'], { cwd: APP_ROOT, stdio: 'inherit' });

const standaloneDir = join(APP_ROOT, '.next', 'standalone');
if (!existsSync(standaloneDir)) {
  console.error('standalone 산출물이 없습니다. next.config.mjs 의 output 설정을 확인하세요.');
  process.exit(1);
}

console.log('2/4 꾸러미 복사');
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
cpSync(standaloneDir, OUT_DIR, { recursive: true });

console.log('3/4 정적 자산 채우기 (standalone 이 빠뜨리는 부분)');
const staticSource = join(APP_ROOT, '.next', 'static');
const staticTarget = join(OUT_DIR, STANDALONE_APP, '.next', 'static');
if (!existsSync(staticSource)) {
  console.error('.next/static 이 없습니다. 빌드가 정상적으로 끝났는지 확인하세요.');
  process.exit(1);
}
cpSync(staticSource, staticTarget, { recursive: true });

const publicSource = join(APP_ROOT, 'public');
if (existsSync(publicSource)) {
  cpSync(publicSource, join(OUT_DIR, STANDALONE_APP, 'public'), { recursive: true });
}

console.log('4/4 실행 스크립트 작성');
const serverPath = join(STANDALONE_APP, 'server.js');

// 전시 담당자가 더블클릭으로 실행할 수 있어야 한다.
writeFileSync(
  join(OUT_DIR, '키오스크_실행.bat'),
  [
    '@echo off',
    'chcp 65001 > nul',
    'cd /d "%~dp0"',
    'set PORT=3000',
    'set HOSTNAME=0.0.0.0',
    'rem 모바일 결과 페이지 주소. 전시장 네트워크의 실제 IP로 바꾸세요.',
    'set NEXT_PUBLIC_MOBILE_BASE_URL=http://127.0.0.1:3001',
    'echo AI 남도 프리즘 키오스크를 시작합니다...',
    `node "${serverPath.replaceAll('/', '\\')}"`,
    'pause',
  ].join('\r\n'),
  'utf8',
);

writeFileSync(
  join(OUT_DIR, 'start-kiosk.sh'),
  [
    '#!/bin/sh',
    'cd "$(dirname "$0")"',
    'export PORT=3000',
    'export HOSTNAME=0.0.0.0',
    '# 모바일 결과 페이지 주소. 전시장 네트워크의 실제 IP로 바꾸세요.',
    'export NEXT_PUBLIC_MOBILE_BASE_URL=${NEXT_PUBLIC_MOBILE_BASE_URL:-http://127.0.0.1:3001}',
    `exec node "${serverPath.replaceAll('\\', '/')}"`,
    '',
  ].join('\n'),
  'utf8',
);

const version = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8')).version;
writeFileSync(
  join(OUT_DIR, '읽어주세요.txt'),
  [
    'AI 남도 프리즘 — 전시장 키오스크 꾸러미',
    `버전 ${version}`,
    '',
    '[실행]',
    '  Windows : 키오스크_실행.bat 더블클릭',
    '  기타     : sh start-kiosk.sh',
    '  브라우저에서 http://localhost:3000 접속 후 F11 로 전체화면',
    '',
    '[모바일 QR 주소 바꾸기]',
    '  실행 스크립트의 NEXT_PUBLIC_MOBILE_BASE_URL 값을',
    '  전시장 네트워크에서 접근 가능한 주소로 바꾸세요.',
    '  이 값이 틀리면 QR을 찍어도 휴대폰에서 열리지 않습니다.',
    '',
    '[인터넷]',
    '  필요하지 않습니다. 외부 통신 없이 동작합니다.',
    '',
    '자세한 운영 절차는 docs/운영매뉴얼.md 를 참고하세요.',
    '',
  ].join('\r\n'),
  'utf8',
);

console.log(`\n완료 — ${OUT_DIR}`);
console.log('  이 폴더를 통째로 전시장 PC에 복사한 뒤 키오스크_실행.bat 을 실행하면 됩니다.');
