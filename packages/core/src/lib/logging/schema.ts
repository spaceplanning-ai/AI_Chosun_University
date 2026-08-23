/**
 * 연구용 익명 로그 스키마.
 *
 * 피드백 문서 3.3 「A단계 로그 최소 필드」 표를 그대로 타입으로 옮긴 것이다.
 *
 *   세션  session_id, 이용일시          → sessionId, startedAt
 *   입력  여행조건, 검색질의, UI 모드     → conditions, retrieval.query, uiMode
 *   RAG   검색문서, 검색점수             → retrieval.documents
 *   추천  후보/제외 관광지와 사유,
 *         연계지수, 정보신뢰도           → candidates, exclusions, linkage, trustAssessments
 *   출력  생성 일정, 수정 전후 일정,
 *         응답시간                      → initialItinerary, refinements, finalItinerary, *Ms
 *   연계  QR 생성/접속 여부              → qrGenerated, qrOpened
 *
 * ── 개인정보 원칙 ───────────────────────────────────────────────────
 * 이름·연락처·촬영영상·정확한 위치 등 개인을 식별할 수 있는 항목은 정의하지 않는다.
 * `sessionId` 는 매 세션마다 새로 만들어지는 난수이며 어떤 개인 식별자와도 연결되지 않는다
 * (제안서 7.7, 피드백 6장). 필드를 추가할 때 이 원칙을 먼저 확인할 것.
 * ──────────────────────────────────────────────────────────────────
 */

import type { Contrast, Theme, UiMode } from '../../design/presentation';
import type {
  CandidateScore,
  ExclusionRecord,
  LinkageAssessment,
  RetrievalResult,
  TrustAssessment,
} from '../../domain/types/evidence';
import type { ItineraryMetrics, LinkageCorrection } from '../../domain/types/itinerary';
import type { ReplanTrace } from '../../domain/types/replan';
import type { ConditionVector, TravelConditions } from '../../domain/types/travel';

/** 일정의 로그용 축약본. 전체 일정 객체를 그대로 저장하면 CSV로 펴기 어렵다. */
export interface ItinerarySnapshot {
  itineraryId: string;
  title: string;
  /** 방문 순서를 유지한 관광지 id 목록. */
  stopAttractionIds: string[];
  metrics: ItineraryMetrics;
}

export interface SessionLog {
  sessionId: string;
  /** 키오스크 식별자와 설치 위치. 전시 통계와 지역별 분석에 쓴다. */
  kioskId: string;
  kioskLocation: string;
  startedAt: string;
  endedAt?: string;

  /** 접근성 연구용. 큰 글씨 모드가 사용성에 미치는 영향 분석의 독립변수가 된다. */
  uiMode: UiMode;
  theme: Theme;
  contrast: Contrast;

  /** 프리셋 시나리오로 시작한 경우 그 식별자. 직접 입력이면 undefined. */
  scenarioId?: string;

  conditions: TravelConditions;
  conditionVector: ConditionVector;

  retrieval: RetrievalResult;
  trustAssessments: TrustAssessment[];
  candidates: CandidateScore[];
  exclusions: ExclusionRecord[];
  linkage: LinkageAssessment;
  linkageCorrection?: LinkageCorrection;

  initialItinerary: ItinerarySnapshot;
  /** 수정 이력. 배열 순서가 곧 이용자가 버튼을 누른 순서다. */
  refinements: ReplanTrace[];
  finalItinerary: ItinerarySnapshot;

  /** 일정 생성에 걸린 시간(ms). 검수기준의 응답시간 지표가 된다. */
  generationMs: number;
  /** 재구성까지 포함한 누적 처리시간(ms). */
  totalProcessingMs: number;

  qrGenerated: boolean;
  qrOpened: boolean;
}

/** 로그 묶음. 내보내기·가져오기의 단위이며 버전을 함께 실어 스키마 변경에 대비한다. */
export interface SessionLogBundle {
  schemaVersion: 1;
  exportedAt: string;
  kioskId: string;
  sessions: SessionLog[];
}

export const LOG_SCHEMA_VERSION = 1 as const;
