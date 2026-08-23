'use client';

import { createLogStore } from '@namdo-prism/core/state';

/** 키오스크 로컬에 쌓이는 익명 세션 로그. 전시 종료 후 파일로 내보낸다. */
export const useKioskLog = createLogStore('namdo-prism.kiosk.logs');
