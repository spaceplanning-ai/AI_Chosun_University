/**
 * 색 대비 검증.
 *
 * "일반 + 큰 글씨 모드 2종"을 A안에 포함해 달라는 요청의 근거는 **디지털 평등/접근성**이었다
 * (피드백 3.2). 글자 크기만 키우고 대비를 확인하지 않으면 그 근거의 절반만 충족하는 셈이다.
 *
 * 그래서 팔레트를 눈으로 고르지 않고 WCAG 대비율로 측정한다.
 * 브라우저 없이 계산해야 테스트로 고정할 수 있으므로, CSS 파싱부터 색 공간 변환까지
 * 전부 순수 함수로 구현했다. 파일 입출력은 호출자(테스트·스크립트)의 몫이다.
 *
 * `color-mix(in oklab, …)` 를 직접 계산하는 이유는 전시 테마의 옅은 배경 대부분이
 * 그 함수로 정의되어 있어, 지원하지 않으면 검사 대상의 절반이 빠지기 때문이다.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0–1. */
  a: number;
}

/* ── CSS 토큰 파싱 ────────────────────────────────────────────────── */

/**
 * `:root` 계열 블록에서 커스텀 속성 선언을 뽑는다.
 * 셀렉터별로 나누어 담으므로, 테마·대비 조합마다 다른 값을 덮어쓸 수 있다.
 */
export function parseTokenBlocks(cssText: string): { selector: string; tokens: Map<string, string> }[] {
  const blocks: { selector: string; tokens: Map<string, string> }[] = [];
  // 주석을 먼저 걷어낸다. 주석 안의 콜론(예: "색상: 남색")을 선언 구분자로 오인하면
  // 그 뒤에 오는 토큰이 통째로 유실되는데, 파싱 실패가 "대비율 0"으로 나타나
  // 팔레트 문제처럼 보이게 된다.
  const withoutComments = cssText.replaceAll(/\/\*[\s\S]*?\*\//g, '');

  // 중첩이 없는 단순 블록만 다룬다. 토큰 파일은 의도적으로 평평하게 유지된다.
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of withoutComments.matchAll(blockPattern)) {
    const selector = (match[1] ?? '').trim();
    const body = match[2] ?? '';
    if (!selector.includes(':root')) continue;

    const tokens = new Map<string, string>();
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator === -1) continue;
      const name = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      if (name.startsWith('--') && value.length > 0) tokens.set(name, value);
    }
    if (tokens.size > 0) blocks.push({ selector, tokens });
  }

  return blocks;
}

export interface ThemeContext {
  theme: 'light' | 'exhibition';
  contrast: 'normal' | 'high';
}

/** 셀렉터가 이 테마·대비 조합에 적용되는지. 적용 순서는 파일 내 등장 순서를 따른다. */
function selectorApplies(selector: string, context: ThemeContext): boolean {
  const wantsTheme = selector.match(/\[data-theme='([^']+)'\]/)?.[1];
  const wantsContrast = selector.match(/\[data-contrast='([^']+)'\]/)?.[1];
  // ui-mode·surface 는 치수 축이라 색에 영향을 주지 않는다.
  if (selector.includes('[data-ui-mode') || selector.includes('[data-surface')) return false;
  if (wantsTheme && wantsTheme !== context.theme) return false;
  if (wantsContrast && wantsContrast !== context.contrast) return false;
  return true;
}

/** 여러 토큰 파일을 합쳐 특정 테마·대비 조합에서 유효한 최종 토큰 표를 만든다. */
export function resolveTokenTable(
  cssTexts: readonly string[],
  context: ThemeContext,
): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const cssText of cssTexts) {
    for (const block of parseTokenBlocks(cssText)) {
      if (!selectorApplies(block.selector, context)) continue;
      for (const [name, value] of block.tokens) resolved.set(name, value);
    }
  }
  return resolved;
}

/* ── 색 값 해석 ───────────────────────────────────────────────────── */

const HEX_PATTERN = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;

function parseHex(value: string): Rgba | undefined {
  const match = HEX_PATTERN.exec(value);
  if (!match) return undefined;
  let digits = match[1] ?? '';
  if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join('');
  const toByte = (offset: number) => Number.parseInt(digits.slice(offset, offset + 2), 16) / 255;
  return {
    r: toByte(0),
    g: toByte(2),
    b: toByte(4),
    a: digits.length === 8 ? toByte(6) : 1,
  };
}

function parseRgbFunction(value: string): Rgba | undefined {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (!match) return undefined;
  const [channels, alpha] = (match[1] ?? '').split('/');
  const parts = (channels ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  const [r, g, b] = parts;
  if (r === undefined || g === undefined || b === undefined) return undefined;
  return { r: r / 255, g: g / 255, b: b / 255, a: alpha === undefined ? 1 : Number(alpha.trim()) };
}

/** 최상위 쉼표 기준으로 자른다. 중첩 함수 안의 쉼표는 건드리지 않는다. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

/**
 * 토큰 값을 실제 색으로 해석한다.
 * `var()` 참조, `color-mix(in oklab, …)`, hex, rgb() 를 다룬다.
 */
export function resolveColor(
  value: string,
  tokens: ReadonlyMap<string, string>,
  depth = 0,
): Rgba | undefined {
  // 순환 참조가 있어도 무한 재귀로 죽지 않게 한다.
  if (depth > 12) return undefined;
  const trimmed = value.trim();

  if (trimmed === 'transparent') return TRANSPARENT;

  const varMatch = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(trimmed);
  if (varMatch) {
    const referenced = tokens.get(varMatch[1] ?? '');
    if (referenced !== undefined) return resolveColor(referenced, tokens, depth + 1);
    return varMatch[2] === undefined ? undefined : resolveColor(varMatch[2], tokens, depth + 1);
  }

  const mixMatch = /^color-mix\(\s*in\s+oklab\s*,\s*(.+)\)$/i.exec(trimmed);
  if (mixMatch) {
    const [first, second] = splitTopLevel(mixMatch[1] ?? '');
    if (first === undefined || second === undefined) return undefined;

    const parsePart = (part: string) => {
      const percentMatch = /\s(\d+(?:\.\d+)?)%$/.exec(part);
      const colorText = percentMatch ? part.slice(0, percentMatch.index).trim() : part.trim();
      return {
        color: resolveColor(colorText, tokens, depth + 1),
        weight: percentMatch ? Number(percentMatch[1]) / 100 : undefined,
      };
    };

    const a = parsePart(first);
    const b = parsePart(second);
    if (!a.color || !b.color) return undefined;

    const weightA = a.weight ?? (b.weight === undefined ? 0.5 : 1 - b.weight);
    return mixOklab(a.color, b.color, weightA);
  }

  return parseHex(trimmed) ?? parseRgbFunction(trimmed);
}

/* ── 색 공간 변환 ─────────────────────────────────────────────────── */

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function toGamma(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

interface Oklab {
  L: number;
  a: number;
  b: number;
}

function rgbToOklab({ r, g, b }: Rgba): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = Math.cbrt(0.412_221_470_8 * lr + 0.536_332_536_3 * lg + 0.051_445_992_9 * lb);
  const m = Math.cbrt(0.211_903_498_2 * lr + 0.680_699_545_1 * lg + 0.107_396_956_6 * lb);
  const s = Math.cbrt(0.088_302_461_9 * lr + 0.281_718_837_6 * lg + 0.629_978_700_5 * lb);

  return {
    L: 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    a: 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    b: 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  };
}

function oklabToRgb({ L, a, b }: Oklab, alpha: number): Rgba {
  const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;

  const clamp01 = (channel: number) => Math.min(1, Math.max(0, channel));

  return {
    r: clamp01(toGamma(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s)),
    g: clamp01(toGamma(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s)),
    b: clamp01(toGamma(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s)),
    a: alpha,
  };
}

/** CSS `color-mix(in oklab, a w%, b)` 와 같은 결과를 낸다. */
export function mixOklab(a: Rgba, b: Rgba, weightA: number): Rgba {
  const weight = Math.min(1, Math.max(0, weightA));
  const first = rgbToOklab(a);
  const second = rgbToOklab(b);

  return oklabToRgb(
    {
      L: first.L * weight + second.L * (1 - weight),
      a: first.a * weight + second.a * (1 - weight),
      b: first.b * weight + second.b * (1 - weight),
    },
    a.a * weight + b.a * (1 - weight),
  );
}

/* ── 대비율 ───────────────────────────────────────────────────────── */

/** 반투명 색을 배경 위에 합성한다. 합성하지 않으면 대비가 실제보다 높게 계산된다. */
export function compositeOver(foreground: Rgba, background: Rgba): Rgba {
  if (foreground.a >= 1) return foreground;
  const blend = (channel: 'r' | 'g' | 'b') =>
    foreground[channel] * foreground.a + background[channel] * (1 - foreground.a);
  return { r: blend('r'), g: blend('g'), b: blend('b'), a: 1 };
}

export function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.1 대비율 (1–21). */
export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const front = compositeOver(foreground, background);
  const lighter = Math.max(relativeLuminance(front), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(front), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── 색 구분 거리 ─────────────────────────────────────────────────── */

/**
 * 두 색의 OKLab 거리 (×100).
 *
 * 대비율은 "밝기 차"만 본다. 밝기가 비슷하고 색상만 다른 두 색은 대비율이 1에 가까워
 * 검사에 걸리지 않지만, 화면에서는 구분이 안 된다. 지도 노드처럼 **색만으로 정보를
 * 전달하는 자리**에서는 이 거리로 따로 확인해야 한다.
 *
 * 실제로 광주(청록)·전남(녹색)이 이 상태였다 — 대비 검사는 통과하는데
 * 정상 시각 ΔE 5.5 로 구분이 되지 않았다.
 */
export function colorDistance(a: Rgba, b: Rgba): number {
  const first = rgbToOklab(a);
  const second = rgbToOklab(b);
  return (
    Math.hypot(first.L - second.L, first.a - second.a, first.b - second.b) * 100
  );
}

/**
 * 색만으로 구분되어야 하는 최소 거리.
 * 이 아래는 전색각 이용자도 구별하기 어렵다.
 */
export const MINIMUM_COLOR_DISTANCE = 15;

/**
 * 글자 라벨이 함께 붙는 자리의 완화된 기준.
 *
 * 뱃지에는 언제나 '광주'·'전남'이라는 글자가 들어가므로 색이 유일한 단서가 아니다.
 * 색만으로 구분하는 자리와 같은 기준을 적용할 이유가 없지만,
 * 색이 정보를 거들기는 하므로 최소한의 거리는 지킨다.
 */
export const LABELLED_COLOR_DISTANCE = 8;

export interface DistinctColorPair {
  label: string;
  tokens: [string, string];
  minimum: number;
  /** 왜 이 기준인지. 나중에 기준을 낮추고 싶을 때 근거를 되짚을 수 있게 남긴다. */
  rationale: string;
}

/** 색이 정보를 전달하는 토큰 쌍. 값이 아니라 이름으로 적어 테마별로 각각 검사한다. */
export const DISTINCT_COLOR_PAIRS: readonly DistinctColorPair[] = [
  {
    label: '지역 구분 — 마크(지도·차트)',
    tokens: ['--region-gwangju-mark', '--region-jeonnam-mark'],
    minimum: MINIMUM_COLOR_DISTANCE,
    rationale: '지도 노드에는 지역명이 적히지 않는다. 색이 유일한 단서다.',
  },
  {
    label: '지역 구분 — 글자·뱃지',
    tokens: ['--region-gwangju', '--region-jeonnam'],
    minimum: LABELLED_COLOR_DISTANCE,
    rationale: '뱃지에 지역명이 함께 표시되므로 색은 보조 단서다.',
  },
  {
    label: '막대의 빈 칸 — 바탕과 구분',
    tokens: ['--track', '--surface-page'],
    minimum: LABELLED_COLOR_DISTANCE,
    rationale:
      '단계 표시·진행 막대의 빈 칸이 바탕과 같은 색이면 남은 단계가 통째로 사라진다. 실제로 고대비 화면에서 5단계 중 3칸만 보이던 적이 있다. 옆에 숫자가 함께 적히므로 색만이 유일한 단서는 아니다.',
  },
];

/* ── 검사 대상 조합 ───────────────────────────────────────────────── */

/**
 * 실제 화면에서 쓰이는 글자색·배경색 조합.
 *
 * 목표 대비는 글자 크기에 따라 다르다(WCAG 1.4.3).
 * 키오스크 본문은 19px 이상이지만 캡션·마이크로는 작으므로,
 * 작은 글자에 쓰이는 역할에는 4.5:1을, 큰 글자 전용 역할에는 3:1을 적용한다.
 */
export interface ContrastPair {
  label: string;
  foreground: string;
  background: string;
  /** WCAG AA 목표 대비율. */
  minimum: number;
}

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // 본문 계열 — 작은 글자에도 쓰이므로 4.5:1
  { label: '본문 / 페이지 배경', foreground: '--content-primary', background: '--surface-page', minimum: 4.5 },
  { label: '본문 / 카드', foreground: '--content-primary', background: '--surface-card', minimum: 4.5 },
  { label: '본문 / 융기면', foreground: '--content-primary', background: '--surface-raised', minimum: 4.5 },
  { label: '본문 / 함몰면', foreground: '--content-primary', background: '--surface-sunken', minimum: 4.5 },
  { label: '보조 글자 / 카드', foreground: '--content-secondary', background: '--surface-card', minimum: 4.5 },
  { label: '흐린 글자 / 카드', foreground: '--content-muted', background: '--surface-card', minimum: 4.5 },
  { label: '흐린 글자 / 함몰면', foreground: '--content-muted', background: '--surface-sunken', minimum: 4.5 },
  // 페이지 배경 위에도 그대로 쓰인다. 카드만 검사하면 대기화면·시트 밖 글자가 검사망에서 빠진다.
  { label: '흐린 글자 / 페이지 배경', foreground: '--content-muted', background: '--surface-page', minimum: 4.5 },
  // 가장 옅은 글자 역할은 캡션·주석 전용이라 3:1 을 목표로 둔다.
  { label: '가장 흐린 글자 / 카드', foreground: '--content-subtle', background: '--surface-card', minimum: 3 },
  { label: '가장 흐린 글자 / 페이지 배경', foreground: '--content-subtle', background: '--surface-page', minimum: 3 },
  { label: '가장 흐린 글자 / 함몰면', foreground: '--content-subtle', background: '--surface-sunken', minimum: 3 },

  // 채워진 버튼·뱃지 — 큰 글자 위주지만 안전하게 4.5:1
  /*
    채움 버튼은 두 크기로 나뉜다.
    · 큰 버튼(`lg`)의 글자는 2rem 굵은 글씨라 WCAG 상 «큰 글자»이므로 기준이 3:1 이다.
    · 작은 버튼(`sm`)의 글자는 그보다 작아 4.5:1 이 필요하므로 한 단계 어두운 채움을 쓴다.
    두 경우를 모두 검사한다 — 하나만 재면 나머지가 검사망에서 빠진다.
  */
  { label: '큰 채움버튼 글자 (브랜드)', foreground: '--brand-on-solid', background: '--brand-solid', minimum: 3 },
  { label: '큰 채움버튼 글자 (강조)', foreground: '--accent-on-solid', background: '--accent-solid', minimum: 3 },
  { label: '작은 채움버튼 글자 (브랜드)', foreground: '--brand-on-solid', background: '--brand-strong', minimum: 4.5 },
  { label: '작은 채움버튼 글자 (강조)', foreground: '--accent-on-solid', background: '--accent-strong', minimum: 4.5 },
  { label: '반전면 글자', foreground: '--content-inverse', background: '--surface-inverse', minimum: 4.5 },
  // 자치구 안내도에서 선택한 구. 지도 도형과 오른쪽 목록이 같은 색을 쓴다.
  // 지도의 구 이름은 화면에서 60px 안팎으로 크게 그려진다 (viewBox 7px × 확대). 큰 글자 기준.
  { label: '선택한 자치구 글자', foreground: '--map-selected-on', background: '--map-selected-surface', minimum: 3 },
  // 안내도 단계별 글자 — 채움이 진해질 때 글자가 묻히지 않는지 네 단계 모두 확인한다.
  { label: '안내도 글자 (0단계)', foreground: '--map-ink-0', background: '--map-district-0', minimum: 3 },
  { label: '안내도 글자 (1단계)', foreground: '--map-ink-1', background: '--map-district-1', minimum: 3 },
  { label: '안내도 글자 (2단계)', foreground: '--map-ink-2', background: '--map-district-2', minimum: 3 },
  { label: '안내도 글자 (3단계)', foreground: '--map-ink-3', background: '--map-district-3', minimum: 3 },

  /*
    상태 막대 채움 — 글자 없이 색만으로 뜻을 전하므로 WCAG 1.4.11(비문자 요소) 3:1.
    막대는 카드 위에도 함몰면 위에도 놓이므로 어두운 쪽 바탕으로 잰다.
  */
  { label: '좋음 막대 / 함몰면', foreground: '--status-positive-mark', background: '--surface-sunken', minimum: 3 },
  { label: '주의 막대 / 함몰면', foreground: '--status-caution-mark', background: '--surface-sunken', minimum: 3 },
  { label: '제외 막대 / 함몰면', foreground: '--status-excluded-mark', background: '--surface-sunken', minimum: 3 },
  { label: '오류 막대 / 함몰면', foreground: '--status-critical-mark', background: '--surface-sunken', minimum: 3 },

  // 옅은 뱃지 — 캡션 크기로 쓰이므로 4.5:1
  { label: '광주 뱃지', foreground: '--region-gwangju', background: '--region-gwangju-soft', minimum: 4.5 },
  { label: '전남 뱃지', foreground: '--region-jeonnam', background: '--region-jeonnam-soft', minimum: 4.5 },
  { label: '긍정 뱃지', foreground: '--status-positive', background: '--status-positive-soft', minimum: 4.5 },
  { label: '주의 뱃지', foreground: '--status-caution', background: '--status-caution-soft', minimum: 4.5 },
  { label: '제외 뱃지', foreground: '--status-excluded', background: '--status-excluded-soft', minimum: 4.5 },
  { label: '오류 뱃지', foreground: '--status-critical', background: '--status-critical-soft', minimum: 4.5 },
  { label: '중립 뱃지', foreground: '--status-neutral', background: '--status-neutral-soft', minimum: 4.5 },
  { label: '브랜드 뱃지', foreground: '--brand-text', background: '--brand-soft', minimum: 4.5 },
  { label: '강조 뱃지', foreground: '--accent-text', background: '--accent-soft', minimum: 4.5 },

  // 상태색을 카드 위에 직접 쓰는 경우 (수치 강조)
  { label: '강조색 글자 / 카드', foreground: '--accent-text', background: '--surface-card', minimum: 4.5 },
  { label: '긍정색 글자 / 카드', foreground: '--status-positive', background: '--surface-card', minimum: 4.5 },
  { label: '오류색 글자 / 카드', foreground: '--status-critical', background: '--surface-card', minimum: 4.5 },
];

export interface ContrastResult extends ContrastPair {
  ratio: number;
  passes: boolean;
}

export function auditContrast(
  tokens: ReadonlyMap<string, string>,
  pairs: readonly ContrastPair[] = CONTRAST_PAIRS,
): ContrastResult[] {
  return pairs.map((pair) => {
    const foreground = resolveColor(`var(${pair.foreground})`, tokens);
    const background = resolveColor(`var(${pair.background})`, tokens);

    if (!foreground || !background) {
      return { ...pair, ratio: 0, passes: false };
    }

    const ratio = contrastRatio(foreground, background);
    return { ...pair, ratio: Math.round(ratio * 100) / 100, passes: ratio >= pair.minimum };
  });
}
