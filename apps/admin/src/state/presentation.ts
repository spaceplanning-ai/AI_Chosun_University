'use client';

import { ADMIN_PRESENTATION } from '@namdo-prism/core/design';
import { createPresentationStore } from '@namdo-prism/core/state';

/** 어드민 표현 컨텍스트. 데이터 가독성이 우선이므로 밝은 테마가 기본이다. */
export const usePresentation = createPresentationStore(ADMIN_PRESENTATION, 'namdo-prism.admin.ui');
