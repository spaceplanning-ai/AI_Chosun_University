/**
 * 메뉴와 화면 설계도의 짝이 맞는지 점검한다.
 *
 *     npm run check:screens
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 준비 중 화면은 `config/navigation.ts` 에 등록되고, 그 화면의 모양은
 * `config/screenBlueprints.ts` 에 따로 적힌다. 두 파일이 갈라져 있으므로
 * 메뉴만 더하고 설계도를 빠뜨리면 «안내문만 있는 빈 화면»이 조용히 생긴다.
 *
 * 화면이 죽지는 않으므로 빌드를 깨뜨릴 일은 아니지만, 모르고 지나가면
 * 검수 때 발견된다. 그래서 별도 점검으로 둔다.
 *
 * 타입을 읽으려고 TypeScript 를 돌리지 않는다. 두 파일 모두 형태가 고정된
 * 데이터 선언이라 글자만 훑어도 충분하고, 그만큼 의존성이 늘지 않는다.
 * ──────────────────────────────────────────────────────────────────
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const ADMIN_CONFIG = join(cwd(), 'apps', 'admin', 'src', 'config');

const navigation = readFileSync(join(ADMIN_CONFIG, 'navigation.ts'), 'utf8');

/*
  화면 코드 안에서 직접 옮겨 가는 곳(`navigate('...')`)도 본다.
  «다음 단계»만 검사하면, 안내문 속 링크가 지운 메뉴를 가리켜도 조용히 아무 일이 없다.
*/
const componentDir = join(cwd(), 'apps', 'admin', 'src', 'components');
const componentSource = readdirSync(componentDir)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => readFileSync(join(componentDir, name), 'utf8'))
  .join('\n');
const page = readFileSync(join(cwd(), 'apps', 'admin', 'src', 'app', 'page.tsx'), 'utf8');

/** 메뉴에 있는 모든 화면 id. 아래 두 검사의 기준이 된다. */
const allIds = new Set([...navigation.matchAll(/id: '([a-z0-9-]+)',/g)].map((m) => m[1]));

/*
  화면 등록표(VIEWS)에만 있고 메뉴에 없는 화면 — 만들어 놓고 열 수 없는 상태다.
  실제로 이렇게 묻혀 있던 화면이 둘 있었다.
*/
const viewsBlock = page.match(/const VIEWS: Record<string, React\.ComponentType> = \{([\s\S]*?)\n\};/);
const unreachable = viewsBlock
  ? [...viewsBlock[1].matchAll(/^\s*'?([a-z0-9-]+)'?: \w+,/gm)]
      .map((m) => m[1])
      .filter((id) => !allIds.has(id))
  : [];

/*
  «다음 단계» 가 가리키는 화면이 메뉴에 없으면 그 링크는 그려지지 않는다.
  조용히 사라지므로 여기서 잡는다.
*/
const brokenLinks = [...componentSource.matchAll(/navigate\('([a-z0-9-]+)'\)/g)]
  .map((m) => m[1])
  .filter((id) => !allIds.has(id));


if (unreachable.length > 0) {
  console.log('\n메뉴에 없어 열 수 없는 화면:');
  for (const id of unreachable) console.log(`  · ${id}`);
}


if (brokenLinks.length > 0) {
  console.log('\n화면 안에서 옮겨 가는데 메뉴에 없는 곳:');
  for (const id of [...new Set(brokenLinks)]) console.log(`  · ${id}`);
}

if (unreachable.length === 0 && brokenLinks.length === 0) {
  console.log(`화면 ${allIds.size}개 — 열 수 없는 화면도, 끊긴 링크도 없습니다.`);
  exit(0);
}

exit(1);
