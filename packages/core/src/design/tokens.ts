/**
 * 디자인 토큰의 TypeScript 미러.
 *
 * 색상 값(hex)을 여기에 다시 적지 않는다. CSS가 단일 진실 공급원이고,
 * 이 파일은 "토큰 이름"만 타입 안전하게 노출한다.
 * 캔버스(QR)처럼 실제 계산된 색이 필요한 곳은 `resolveTokenColor()` 로 런타임에 읽는다.
 */

export const COLOR_TOKENS = [
  'surface-page',
  'surface-page-subtle',
  'surface-card',
  'surface-raised',
  'surface-sunken',
  'surface-inverse',
  'line-subtle',
  'line',
  'line-strong',
  'content',
  'content-secondary',
  'content-muted',
  'content-subtle',
  'content-inverse',
  'brand',
  'brand-hover',
  'brand-soft',
  'on-brand',
  'brand-ring',
  'accent',
  'accent-hover',
  'accent-soft',
  'on-accent',
  'gwangju',
  'gwangju-soft',
  'jeonnam',
  'jeonnam-soft',
  'positive',
  'positive-soft',
  'caution',
  'caution-soft',
  'excluded',
  'excluded-soft',
  'critical',
  'critical-soft',
  'neutral',
  'neutral-soft',
  'focus',
  /*
    지도 색.
    카카오맵 도형과 오버레이는 CSS 클래스를 받지 못하고 색 문자열만 받으므로,
    화면과 같은 색을 쓰려면 여기서 계산된 값을 읽어 와야 한다.
    SVG 안내도와 실제 지도가 같은 토큰을 보게 하는 지점이다.
  */
  'map-district-0',
  'map-district-1',
  'map-district-2',
  'map-district-3',
  'map-outline',
  'map-selected-surface',
  'map-selected-on',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

/** Tailwind 유틸리티가 참조하는 것과 동일한 CSS 변수명. */
const CSS_VARIABLE_BY_COLOR_TOKEN: Record<ColorToken, string> = {
  'surface-page': '--surface-page',
  'surface-page-subtle': '--surface-page-subtle',
  'surface-card': '--surface-card',
  'surface-raised': '--surface-raised',
  'surface-sunken': '--surface-sunken',
  'surface-inverse': '--surface-inverse',
  'line-subtle': '--line-subtle',
  line: '--line-default',
  'line-strong': '--line-strong',
  content: '--content-primary',
  'content-secondary': '--content-secondary',
  'content-muted': '--content-muted',
  'content-subtle': '--content-subtle',
  'content-inverse': '--content-inverse',
  brand: '--brand-solid',
  'brand-hover': '--brand-hover',
  'brand-soft': '--brand-soft',
  'on-brand': '--brand-on-solid',
  'brand-ring': '--brand-ring',
  accent: '--accent-solid',
  'accent-hover': '--accent-hover',
  'accent-soft': '--accent-soft',
  'on-accent': '--accent-on-solid',
  gwangju: '--region-gwangju',
  'gwangju-soft': '--region-gwangju-soft',
  jeonnam: '--region-jeonnam',
  'jeonnam-soft': '--region-jeonnam-soft',
  positive: '--status-positive',
  'positive-soft': '--status-positive-soft',
  caution: '--status-caution',
  'caution-soft': '--status-caution-soft',
  excluded: '--status-excluded',
  'excluded-soft': '--status-excluded-soft',
  critical: '--status-critical',
  'critical-soft': '--status-critical-soft',
  neutral: '--status-neutral',
  'neutral-soft': '--status-neutral-soft',
  focus: '--focus-ring',
  'map-district-0': '--map-district-0',
  'map-district-1': '--map-district-1',
  'map-district-2': '--map-district-2',
  'map-district-3': '--map-district-3',
  'map-outline': '--map-outline',
  'map-selected-surface': '--map-selected-surface',
  'map-selected-on': '--map-selected-on',
};

/** 인라인 style 속성에 넣을 수 있는 `var(--…)` 문자열. */
export function colorVar(token: ColorToken): string {
  return `var(${CSS_VARIABLE_BY_COLOR_TOKEN[token]})`;
}

/**
 * 계산된 실제 색상값을 읽는다. `color-mix()` 로 정의된 토큰도 브라우저가 풀어서 돌려준다.
 * 캔버스 렌더링(QR 코드)처럼 CSS 변수를 못 쓰는 곳에서만 사용한다.
 */
export function resolveTokenColor(token: ColorToken, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const computed = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(CSS_VARIABLE_BY_COLOR_TOKEN[token])
    .trim();
  return computed.length > 0 ? computed : fallback;
}

/** 모션 토큰 — setTimeout 등 JS 타이밍을 CSS 전환과 맞출 때 사용한다. */
export const MOTION_MS = {
  instant: 90,
  fast: 180,
  normal: 320,
  slow: 560,
  scene: 900,
} as const;

export type MotionSpeed = keyof typeof MOTION_MS;
