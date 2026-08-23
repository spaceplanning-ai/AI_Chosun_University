/**
 * 표현 컨텍스트(Presentation context).
 *
 * `<html>` 의 data-* 속성 4개가 시맨틱 토큰 전체를 갈아끼운다.
 * 이 파일이 속성 이름과 허용값의 단일 진실 공급원이며,
 * 스토어·레이아웃·토글 컴포넌트가 모두 여기만 참조한다.
 */

export const UI_MODES = ['standard', 'large'] as const;
export const THEMES = ['light', 'exhibition'] as const;
export const CONTRASTS = ['normal', 'high'] as const;
export const SURFACES = ['kiosk', 'mobile'] as const;

export type UiMode = (typeof UI_MODES)[number];
export type Theme = (typeof THEMES)[number];
export type Contrast = (typeof CONTRASTS)[number];
export type Surface = (typeof SURFACES)[number];

export interface PresentationContext {
  uiMode: UiMode;
  theme: Theme;
  contrast: Contrast;
  surface: Surface;
}

export const PRESENTATION_ATTRIBUTE = {
  uiMode: 'data-ui-mode',
  theme: 'data-theme',
  contrast: 'data-contrast',
  surface: 'data-surface',
} as const satisfies Record<keyof PresentationContext, `data-${string}`>;

/** 전시장 세로형 키오스크 기본값: 어두운 전시 배경 + 일반 모드. */
export const KIOSK_PRESENTATION: PresentationContext = {
  uiMode: 'standard',
  // 흰 배경 + 지정 팔레트를 기본으로 한다. 어두운 전시 테마는 토글로 그대로 남는다.
  theme: 'light',
  contrast: 'normal',
  surface: 'kiosk',
};

/** QR로 넘어간 개인 단말 기본값: 밝은 배경 + 모바일 밀도. */
export const MOBILE_PRESENTATION: PresentationContext = {
  uiMode: 'standard',
  theme: 'light',
  contrast: 'normal',
  surface: 'mobile',
};

/** 연구자·관리자 화면 기본값: 데이터 가독성 우선. */
export const ADMIN_PRESENTATION: PresentationContext = {
  uiMode: 'standard',
  theme: 'light',
  contrast: 'normal',
  surface: 'mobile',
};

/** JSX 스프레드용 — 서버 렌더 시점의 초기 컨텍스트를 `<html>` 에 심는다. */
export function presentationAttributes(context: PresentationContext) {
  return {
    [PRESENTATION_ATTRIBUTE.uiMode]: context.uiMode,
    [PRESENTATION_ATTRIBUTE.theme]: context.theme,
    [PRESENTATION_ATTRIBUTE.contrast]: context.contrast,
    [PRESENTATION_ATTRIBUTE.surface]: context.surface,
  };
}

/** 클라이언트에서 컨텍스트가 바뀔 때 `<html>` 속성을 동기화한다. */
export function applyPresentation(context: PresentationContext): void {
  const root = document.documentElement;
  root.setAttribute(PRESENTATION_ATTRIBUTE.uiMode, context.uiMode);
  root.setAttribute(PRESENTATION_ATTRIBUTE.theme, context.theme);
  root.setAttribute(PRESENTATION_ATTRIBUTE.contrast, context.contrast);
  root.setAttribute(PRESENTATION_ATTRIBUTE.surface, context.surface);
}

/** 두 값짜리 축을 토글한다 (일반 ↔ 큰 글씨, 밝은 ↔ 전시). */
export function toggleBinary<T extends string>(current: T, options: readonly [T, T]): T {
  return current === options[0] ? options[1] : options[0];
}
