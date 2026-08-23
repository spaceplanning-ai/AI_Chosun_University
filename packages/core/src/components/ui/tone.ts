/**
 * 의미 톤(tone).
 *
 * 뱃지·미터·통계 타일·시트가 모두 같은 톤 어휘를 공유한다.
 * 컴포넌트마다 색을 따로 정하면 "제외"가 어떤 화면에서는 주황, 어떤 화면에서는 빨강이 된다.
 * 톤 → 토큰 매핑은 오직 이 파일에만 존재한다.
 */

export const TONES = [
  'brand',
  'accent',
  'gwangju',
  'jeonnam',
  'positive',
  'caution',
  'excluded',
  'critical',
  'neutral',
] as const;

export type Tone = (typeof TONES)[number];

/** 진한 배경 위에 밝은 글자. 채워진 뱃지·버튼에 쓴다. */
export const TONE_SOLID: Record<Tone, string> = {
  brand: 'bg-brand text-on-brand',
  accent: 'bg-accent text-on-accent',
  gwangju: 'bg-gwangju text-surface-page',
  jeonnam: 'bg-jeonnam text-surface-page',
  positive: 'bg-positive text-surface-page',
  caution: 'bg-caution text-surface-page',
  excluded: 'bg-excluded text-surface-page',
  critical: 'bg-critical text-surface-page',
  neutral: 'bg-neutral text-surface-page',
};

/** 옅은 배경 위에 같은 계열 글자. 정보 밀도가 높은 표·칩에 쓴다. */
export const TONE_SOFT: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-text',
  accent: 'bg-accent-soft text-accent-text',
  gwangju: 'bg-gwangju-soft text-gwangju',
  jeonnam: 'bg-jeonnam-soft text-jeonnam',
  positive: 'bg-positive-soft text-positive',
  caution: 'bg-caution-soft text-caution',
  excluded: 'bg-excluded-soft text-excluded',
  critical: 'bg-critical-soft text-critical',
  neutral: 'bg-neutral-soft text-content-muted',
};

/** 글자색만. 수치 강조에 쓴다. */
export const TONE_TEXT: Record<Tone, string> = {
  // 파란 «글자»는 지정색보다 한 단계 어두운 쪽을 쓴다. 지정색 그대로는 흰 면에서 3.71:1 이다.
  brand: 'text-brand-text',
  accent: 'text-accent-text',
  gwangju: 'text-gwangju',
  jeonnam: 'text-jeonnam',
  positive: 'text-positive',
  caution: 'text-caution',
  excluded: 'text-excluded',
  critical: 'text-critical',
  neutral: 'text-content-muted',
};

/**
 * 채움색만. 미터 막대·그래프에 쓴다.
 *
 * 상태색은 «글자용»이 아니라 `-mark` 를 쓴다. 글자용 값은 흰 바탕에서 4.5:1 을
 * 넘기려고 가장 어두운 단계라, 막대에 칠하면 주의색이 갈색으로 보인다.
 * 색만으로 뜻을 전하는 자리이므로 알아볼 수 있는 단계여야 한다.
 */
export const TONE_FILL: Record<Tone, string> = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  gwangju: 'bg-gwangju-mark',
  jeonnam: 'bg-jeonnam-mark',
  positive: 'bg-positive-mark',
  caution: 'bg-caution-mark',
  excluded: 'bg-excluded-mark',
  critical: 'bg-critical-mark',
  neutral: 'bg-neutral',
};

/** 테두리색만. */
export const TONE_BORDER: Record<Tone, string> = {
  brand: 'border-brand',
  accent: 'border-accent',
  gwangju: 'border-gwangju',
  jeonnam: 'border-jeonnam',
  positive: 'border-positive',
  caution: 'border-caution',
  excluded: 'border-excluded',
  critical: 'border-critical',
  neutral: 'border-line',
};

/** 점수 구간 → 톤. 신뢰도·연계지수·추천점수가 같은 기준으로 색을 갖게 한다. */
export function toneForScore(score: number): Tone {
  if (score >= 75) return 'positive';
  if (score >= 55) return 'caution';
  return 'critical';
}

/**
 * 지역 마크 색 — 지도 노드·차트처럼 **색만으로 지역을 나타내는** 자리에 쓴다.
 * 글자 라벨이 붙는 뱃지는 `TONE_*` 의 gwangju/jeonnam 을 그대로 쓰면 된다.
 */
export const REGION_MARK_FILL = {
  gwangju: 'fill-gwangju-mark',
  jeonnam: 'fill-jeonnam-mark',
} as const;

export const REGION_MARK_BG = {
  gwangju: 'bg-gwangju-mark',
  jeonnam: 'bg-jeonnam-mark',
} as const;

/** 지역 → 톤. 광주/전남 구분 색을 한곳에서 정한다. */
export const REGION_TONE = { gwangju: 'gwangju', jeonnam: 'jeonnam' } as const satisfies Record<
  string,
  Tone
>;
