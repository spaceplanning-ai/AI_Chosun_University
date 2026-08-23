/**
 * 서체 번들 만들기.
 *
 *     npm run fonts:build
 *
 * ── 왜 서체를 번들하는가 ───────────────────────────────────────────
 * 전시장은 오프라인이다. 그래서 원래는 웹폰트를 쓰지 않고 OS 내장 한글 서체에
 * 기대도록 해 뒀는데, 그러면 **현장에서 다른 글꼴로 그려진다.**
 * 개발 PC 에는 Pretendard 가 깔려 있어 화면이 Pretendard 로 보이지만,
 * 전시 장비에는 없을 테니 맑은 고딕으로 떨어진다. 맑은 고딕은 SemiBold 가 없어
 * `font-semibold` 가 합성되고, 글자폭이 달라 줄바꿈 위치까지 어긋난다.
 *
 * 자체 호스팅은 네트워크와 무관하다 — 앱과 같은 오리진에서 나가므로
 * 오프라인에서도 그대로 뜬다. 그래서 지켜야 할 규칙은 «웹폰트 금지»가 아니라
 * «외부 CDN 금지»이고, 이 스크립트가 그 자체 호스팅본을 만든다.
 *
 * ── 왜 서브셋하는가 ────────────────────────────────────────────────
 * 원본 OTF 는 굵기당 1.5MB 다. 화면에 나올 수 없는 글자(한자·가나·이모지)를
 * 걷어내면 굵기당 600KB 안쪽으로 줄어든다.
 *
 * 다만 한글 음절은 **전부** 남긴다. 관광지 이름·문서 제목은 자료가 바뀌면
 * 함께 바뀌므로, 지금 쓰이는 글자만 골라 담으면 나중에 자료를 고쳤을 때
 * 조용히 두부(□)가 생긴다. 자료 변경이 서체 재생성을 요구해선 안 된다.
 *
 * ── 왜 모바일에는 넣지 않는가 ──────────────────────────────────────
 * 모바일 결과 페이지는 관람객 휴대폰이 이동통신망으로 받아 간다.
 * 2MB 를 더 받게 할 이유가 없고, 요즘 휴대폰의 한글 기본 서체는 충분히 좋다.
 * 키오스크(오프라인 필수)와 어드민(검수 화면)만 번들한다.
 * ──────────────────────────────────────────────────────────────────
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

/** 화면에서 실제로 쓰는 굵기. Tailwind 의 font-medium/semibold/bold 와 짝이 맞아야 한다. */
const WEIGHTS = [
  { file: 'Pretendard-Regular.otf', weight: 400 },
  { file: 'Pretendard-Medium.otf', weight: 500 },
  { file: 'Pretendard-SemiBold.otf', weight: 600 },
  { file: 'Pretendard-Bold.otf', weight: 700 },
];

/** 원본을 찾을 곳. 설치본이 없으면 저장소 안의 `assets/fonts` 를 본다. */
const SOURCE_DIRS = [
  join(homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'),
  join('C:\\', 'Windows', 'Fonts'),
  join(cwd(), 'assets', 'fonts'),
];

/** 넣을 곳. 앱마다 따로 배포되므로 각자 자기 `public` 에 들고 있어야 한다. */
const OUT_DIRS = ['apps/kiosk/public/fonts', 'apps/admin/public/fonts'];

/**
 * 남길 글자의 유니코드 범위.
 *
 * 한자·가나·이모지는 화면에 나올 일이 없으므로 뺀다.
 * 그 셋이 원본 용량의 대부분을 차지한다.
 */
const UNICODE_RANGES = [
  'U+0020-007E', // 라틴 기본·숫자·문장부호
  'U+00A0-00FF', // 라틴 보충 (·, °, × 등)
  'U+2000-206F', // 일반 문장부호 (—, ·, «», 줄임표)
  'U+20A9', // 원화 기호
  'U+2190-21FF', // 화살표
  'U+2460-24FF', // 원 숫자 (①②③)
  'U+25A0-25FF', // 도형 (■ ● ▶)
  'U+3000-303F', // 한중일 문장부호
  'U+3130-318F', // 한글 자모 (ㄱ, ㅏ)
  'U+AC00-D7A3', // 한글 음절 전체 — 자료가 바뀌어도 두부가 생기지 않게
  'U+FF01-FF60', // 전각 영숫자·부호
];

function findSource(file) {
  for (const dir of SOURCE_DIRS) {
    const path = join(dir, file);
    if (existsSync(path)) return path;
  }
  return undefined;
}

const missing = WEIGHTS.filter((entry) => !findSource(entry.file));
if (missing.length > 0) {
  console.log('원본 서체를 찾지 못했습니다:');
  for (const entry of missing) console.log(`  · ${entry.file}`);
  console.log('\nPretendard 를 설치하거나 assets/fonts 에 OTF 를 넣어 주세요.');
  console.log('https://github.com/orioncactus/pretendard  (SIL OFL 1.1)');
  exit(1);
}

const [primaryDir, ...mirrorDirs] = OUT_DIRS.map((dir) => join(cwd(), dir));
mkdirSync(primaryDir, { recursive: true });

console.log(`서체 서브셋을 만듭니다 — 굵기 ${WEIGHTS.length}종\n`);

let total = 0;

for (const entry of WEIGHTS) {
  const name = `pretendard-${entry.weight}.woff2`;
  const target = join(primaryDir, name);

  execFileSync(
    'python',
    [
      '-m',
      'fontTools.subset',
      findSource(entry.file),
      `--unicodes=${UNICODE_RANGES.join(',')}`,
      // 커닝·합자만 남긴다. 나머지 OpenType 기능은 이 화면에서 쓰지 않는다.
      '--layout-features=kern,liga,calt',
      '--flavor=woff2',
      '--desubroutinize',
      `--output-file=${target}`,
    ],
    { stdio: 'inherit' },
  );

  const size = statSync(target).size;
  total += size;
  console.log(`  ${entry.weight}  ${(size / 1024).toFixed(0)}KB`);

  for (const dir of mirrorDirs) {
    mkdirSync(dir, { recursive: true });
    copyFileSync(target, join(dir, name));
  }
}

console.log(`\n합계 ${(total / 1024 / 1024).toFixed(2)}MB · ${OUT_DIRS.length}개 앱에 배치했습니다.`);
console.log('라이선스: SIL OFL 1.1 — 각 public/fonts/OFL.txt 를 함께 배포해야 합니다.');
