'use client';

import { createLogStore } from '@namdo-prism/core/state';

/**
 * 어드민이 보관하는 세션 로그.
 * 키오스크와는 다른 오리진에 배포되므로 저장소를 공유하지 않는다 —
 * 키오스크가 내보낸 JSON 파일을 가져와 채운다.
 */
export const useAdminLog = createLogStore('namdo-prism.admin.logs');
