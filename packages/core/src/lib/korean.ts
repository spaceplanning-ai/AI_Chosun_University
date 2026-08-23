/**
 * 한국어 조사 붙이기.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 알림·안내 문구에 이름을 끼워 넣으면 조사가 따라온다.
 * 「죽녹원을 삭제했습니다」와 「메타세쿼이아를 삭제했습니다」는 조사가 다르다.
 * 이름이 자료에서 오는 이상 문구에 박아 둘 수 없어, 대개 「을(를)」 로 도망친다.
 * 그 표기는 사람이 쓴 글로 보이지 않는다 — 앞 글자의 받침만 보면 고를 수 있다.
 *
 * ── 어떻게 고르는가 ────────────────────────────────────────────────
 * 한글 음절은 유니코드에서 «가»(0xAC00) 부터 28개 종성을 한 묶음으로 늘어선다.
 * 따라서 (코드 - 0xAC00) % 28 이 0 이면 받침이 없다.
 *
 * 한글이 아닌 글자로 끝나면(영문·숫자·기호) 받침을 알 수 없으므로 받침 있는 쪽을
 * 쓴다 — 「AI를」 보다 「AI을」 이 어색하지만, 자료에 그런 이름이 들어오면
 * 어느 쪽을 골라도 어색하다. 숫자만은 읽는 소리가 정해져 있어 따로 본다.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const FINAL_CONSONANT_COUNT = 28;

/** 숫자를 읽었을 때 받침으로 끝나는가. 0·1·3·6·7·8 → 영·일·삼·육·칠·팔 */
const DIGIT_HAS_FINAL: Record<string, boolean> = {
  '0': true,
  '1': true,
  '2': false,
  '3': true,
  '4': false,
  '5': false,
  '6': true,
  '7': true,
  '8': true,
  '9': false,
};

/** 종성표에서 ㄹ 의 자리. 「으로/로」 는 이 받침만 예외로 다룬다. */
const RIEUL_INDEX = 8;

/**
 * 마지막 글자의 받침이 ㄹ 인가.
 *
 * 「서울으로」가 아니라 「서울로」다 — 방향격 조사만 ㄹ 받침을 받침 없는 것처럼 다룬다.
 */
function endsWithRieul(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (Number.isNaN(code) || code < HANGUL_BASE || code > HANGUL_LAST) return false;
  return (code - HANGUL_BASE) % FINAL_CONSONANT_COUNT === RIEUL_INDEX;
}

/** 마지막 글자에 받침이 있는가. 판단할 수 없으면 `true`(받침 있음) 로 본다. */
export function endsWithFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1);
  if (last.length === 0) return true;

  const digit = DIGIT_HAS_FINAL[last];
  if (digit !== undefined) return digit;

  const code = last.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_LAST) return true;
  return (code - HANGUL_BASE) % FINAL_CONSONANT_COUNT !== 0;
}

/** 받침 유무로 갈리는 조사 짝. 앞쪽이 받침 있을 때 쓰는 형태다. */
export const PARTICLES = {
  목적격: ['을', '를'],
  주격: ['이', '가'],
  보조사: ['은', '는'],
  공동격: ['과', '와'],
  방향격: ['으로', '로'],
} as const;

export type ParticleKind = keyof typeof PARTICLES;

/**
 * 이름 뒤에 알맞은 조사를 붙여 돌려준다.
 *
 *     withParticle('죽녹원', '목적격')  // '죽녹원을'
 *     withParticle('죽녹원', '주격')    // '죽녹원이'
 */
export function withParticle(word: string, kind: ParticleKind): string {
  const [withFinal, withoutFinal] = PARTICLES[kind];
  const takesFinalForm =
    kind === '방향격' ? endsWithFinalConsonant(word) && !endsWithRieul(word) : endsWithFinalConsonant(word);
  return `${word}${takesFinalForm ? withFinal : withoutFinal}`;
}
