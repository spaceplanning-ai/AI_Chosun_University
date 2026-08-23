/**
 * 키오스크 운영 상수.
 *
 * 전시장 무인 운영을 전제로 한 타이밍·설치정보·납품단계 스위치를 모은다.
 * 화면 컴포넌트가 숫자를 직접 들고 있으면 전시 현장에서 조정할 때
 * 여러 파일을 뒤져야 하므로, 조정 대상 값은 전부 이 파일에 남긴다.
 */

/** 납품 단계. A단계는 피드백 문서 3장의 최소범위만 노출한다. */
export const DELIVERY_PHASE: 'A' | 'C' = 'A';

export const IDLE_TIMEOUTS_MS = {
  /** 조작이 없을 때 "곧 처음으로 돌아갑니다" 경고를 띄우기까지의 시간. */
  warnAfter: 75_000,
  /** 경고 후 대기화면으로 자동 복귀하기까지의 유예. */
  resetAfter: 15_000,
  /** 결과화면은 관람객이 오래 들여다보므로 더 길게 잡는다. */
  resultWarnAfter: 150_000,
} as const;

export const ANALYSIS_TIMING_MS = {
  /** AI 분석화면 총 노출시간. 제안서 6.3 "약 3∼7초". */
  totalDuration: 4_600,
  /** 단계 사이 최소 간격. 너무 빨리 넘어가면 처리과정이 읽히지 않는다. */
  minimumStepInterval: 420,
} as const;

/** 대기화면 배경 이미지 전환 주기. */
export const ATTRACT_ROTATION_MS = 6_500;

/**
 * 설치 위치. 로그의 `kioskLocation` 필드로 저장되며 출발지 기본값을 결정한다.
 * 실제 배포 시 빌드 환경변수로 주입할 수 있도록 단일 지점으로 모아둔다.
 */
export const KIOSK_DEPLOYMENT = {
  id: 'seoul-station-01',
  label: '서울역 3층 관광안내 구역',
  defaultOrigin: '서울역',
} as const;

/**
 * 오프라인 시연모드.
 * 피드백 [기타] 항목의 "부트캠프에서는 오프라인 시연 모드만 구동하여
 * 백엔드 구조나 프롬프트가 대중에게 노출되는 것을 원천 차단" 요구에 따라,
 * 프런트엔드는 기본적으로 내장 엔진으로만 동작한다.
 */
export const OFFLINE_DEMO_MODE = true;

/** 연구자 화면 진입용 히든 제스처: 좌상단 로고를 이 횟수만큼 연속 터치. */
export const RESEARCHER_UNLOCK_TAPS = 5;

/** 위 연속 터치가 유효한 최대 간격(ms). */
export const RESEARCHER_UNLOCK_WINDOW_MS = 2_000;

/** 검수기준(제안서 17.2)의 목표치. 연구자 화면 상단에 실측치와 나란히 표시한다. */
export const ACCEPTANCE_TARGETS = {
  /** 출처 제시율 목표. */
  sourceCitationRate: 90,
  /** 답변-근거 일치율 목표. */
  answerEvidenceMatchRate: 85,
  /** 일반 질의 응답시간 중앙값 목표(ms). */
  medianResponseMs: 7_000,
} as const;
