'use client';

import { KIOSK_PRESENTATION } from '@namdo-prism/core/design';
import { createPresentationStore } from '@namdo-prism/core/state';

/**
 * 키오스크 표현 컨텍스트 스토어.
 * 기본값은 밝은 화면 + 일반 글씨이며, 관람객이 큰 글씨로 바꾼 설정은
 * 세션이 초기화되어도 유지된다 — 고령 관람객이 매번 다시 누르지 않게 하기 위함이다.
 *
 * 저장 키에 버전을 붙였다. 기본값을 바꿔도 브라우저에 남은 옛 설정이 그대로 살아나면
 * «바꿨는데 그대로»가 되기 때문이다. 키를 올리면 옛 값은 버려진다.
 */
export const usePresentation = createPresentationStore(KIOSK_PRESENTATION, 'namdo-prism.kiosk.ui.v2');
