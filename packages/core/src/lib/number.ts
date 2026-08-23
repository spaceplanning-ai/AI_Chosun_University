/** 도메인 계산 전반에서 쓰는 수치 유틸리티. */

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** 0–100 범위로 자른다. 모든 점수 계산의 마무리에 쓴다. */
export function clampScore(value: number): number {
  return clamp(value, 0, 100);
}

export function roundTo(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** 빈 배열에서 NaN이 새어 나가지 않도록 0을 돌려준다. */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

/** `value` 를 [from, to] 구간에서 0–1로 정규화한다. 구간이 0이면 0. */
export function normalize(value: number, from: number, to: number): number {
  if (to === from) return 0;
  return clamp((value - from) / (to - from), 0, 1);
}

/** 0–100 점수를 0–1 비율로. */
export function toRatio(score: number): number {
  return clamp(score / 100, 0, 1);
}

/** 두 값을 `weight`(0–1) 비율로 섞는다. */
export function blend(base: number, target: number, weight: number): number {
  const w = clamp(weight, 0, 1);
  return base * (1 - w) + target * w;
}
