/**
 * ════════════════════════════════════════════════════════════════════
 *  특허 후보 제1안 모듈
 *  「초광역 관광연계지수와 정보 신뢰도를 이용한 설명가능 여행일정 생성 방법 및 시스템」
 * ════════════════════════════════════════════════════════════════════
 *
 * 피드백 문서 5.3의 요청 "특허 1 관련 모듈: linkage/trust/recommendation 영역의
 * 입력·처리·출력값을 별도 함수 또는 서비스 단위로 식별 가능하게" 에 대응하는 경계다.
 * 이 폴더 밖에서는 아래 공개 함수만 호출한다.
 *
 * 처리단계와 구현 파일의 대응 (제안서 9.3):
 *
 *   2) 이용자의 여행조건을 입력받는 단계          → (프레젠테이션 계층)
 *   3) 여행조건을 복수의 평가요소로 변환           → conditionVector.ts
 *   4) 공식 관광문서에서 후보 관광지를 검색        → retrieval.ts
 *   5) 정보 신뢰도가 기준 이하인 후보를 제외       → trust.ts + eligibility.ts
 *   6) 초광역 연계지수를 산출                     → linkageIndex.ts
 *   7) 취향·이동부담·연계지수를 반영해 일정 생성   → scoring.ts + composer.ts
 *   8) 추천 이유와 근거문서를 제공                → rationale.ts
 *
 * 9) 최소변경 재생성 단계는 본 모듈에 포함하지 않는다.
 *    별도 권리화 검토를 위해 `domain/minimal-change-replan` 으로 완전히 분리되어 있다.
 */

import { ATTRACTIONS } from '../../data/attractions';
import { computeMetrics, flattenStops, stopsToAttractions } from '../shared/metrics';
import type { GenerationOutcome, Itinerary } from '../types/itinerary';
import type { ConditionVector, TravelConditions } from '../types/travel';
import { composeItinerary } from './composer';
import { buildConditionVector } from './conditionVector';
import { filterEligible } from './eligibility';
import { assessLinkage } from './linkageIndex';
import { retrieveForConditions } from './retrieval';
import { assessTrustForAll } from './trust';

export interface GenerateItineraryInput {
  conditions: TravelConditions;
  /**
   * 정보 신뢰도의 갱신일 판정 기준일 (ISO yyyy-mm-dd).
   * 인자로 받는 이유는 검수 재현성 때문이다 — 같은 입력이면 몇 달 뒤에 돌려도 같은 결과가 나와야 한다.
   */
  referenceDate: string;
  /** 방문 요일(예: '토'). 지정하면 휴무일 규칙이 작동한다. */
  visitDay?: string;
  /** 일정 식별자. 지정하지 않으면 호출 측(세션 계층)이 부여한다. */
  itineraryId: string;
  /**
   * 미리 만들어 둔 조건벡터. 지정하면 `conditions` 로부터 새로 만들지 않는다.
   * 다중 사용자 선호 병합(C단계)처럼 여러 사람의 조건을 합쳐 넣을 때 쓴다.
   */
  conditionVector?: ConditionVector;
}

/**
 * 여행조건 → 설명가능한 여행일정.
 * 화면에 보여 줄 `itinerary` 와 재현·검수용 `trace` 를 함께 돌려준다.
 * 둘을 따로 만들면 화면의 숫자와 로그의 숫자가 갈라지므로, 반드시 한 번의 계산에서 나온다.
 */
export function generateItinerary(input: GenerateItineraryInput): GenerationOutcome {
  const startedAt = performance.now();
  const { conditions, referenceDate, visitDay, itineraryId } = input;

  // 3) 조건 구조화 (병합된 벡터가 주어지면 그것을 그대로 쓴다)
  const conditionVector = input.conditionVector ?? buildConditionVector(conditions);

  // 4) 공식자료 검색
  const retrieval = retrieveForConditions(conditions);

  // 5) 신뢰도 산출 및 후보 제외
  const trust = assessTrustForAll(
    ATTRACTIONS.map((attraction) => attraction.id),
    referenceDate,
  );
  const { eligible, exclusions } = filterEligible({
    attractions: ATTRACTIONS,
    vector: conditionVector,
    conditions,
    trust,
    referenceDate,
    visitDay,
  });

  // 6·7·8) 채점 → 일정 생성 → 근거 생성
  const composed = composeItinerary({ eligible, vector: conditionVector, conditions, trust });

  const metrics = computeMetrics(composed.days, trust);
  const linkage = assessLinkage(stopsToAttractions(flattenStops(composed.days)));

  const itinerary: Itinerary = {
    id: itineraryId,
    title: composed.title,
    subtitle: composed.subtitle,
    days: composed.days,
    metrics,
    linkage,
  };

  return {
    itinerary,
    trace: {
      conditions,
      conditionVector,
      retrieval,
      trustAssessments: [...trust.values()],
      candidates: composed.candidates,
      exclusions: [...exclusions, ...composed.exclusions],
      linkage,
      linkageCorrection: composed.linkageCorrection,
      elapsedMs: performance.now() - startedAt,
    },
  };
}

export { buildConditionVector, applyVectorDelta } from './conditionVector';
export {
  assessGroupFairness,
  buildParticipantVectors,
  mergeConditionVectors,
  type GroupFairness,
  type Participant,
  type ParticipantSatisfaction,
} from './groupConditions';
export { assessLinkage, assessLinkageByIds } from './linkageIndex';
export { assessTrust, assessTrustForAll } from './trust';
export { filterEligible } from './eligibility';
export { rankCandidates, scoreCandidate, type ScoringContext } from './scoring';
export { buildStopRationale } from './rationale';
export {
  buildDocumentIndex,
  buildQuery,
  retrieveForConditions,
  retrieveForQuestion,
  searchDocuments,
  type RetrievalSettings,
  tokenize,
  type IndexedDocument,
} from './retrieval';
