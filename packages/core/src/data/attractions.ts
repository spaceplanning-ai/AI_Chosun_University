/**
 * 관광지 표준데이터 로더.
 *
 * ── 데이터의 원본은 이 파일이 아니라 `attractions.json` 입니다 ──────
 * 관광지를 추가·수정·교체하려면 JSON을 직접 고치거나, 엑셀로 작업한 뒤 CSV 반입 절차를 따르십시오.
 * 절차 전문은 `src/data/README.md` 에 있습니다.
 *
 *     npm run data:export     현재 데이터를 CSV로 내보내기 (엑셀 편집용)
 *     npm run data:import     편집한 CSV를 JSON으로 되돌리기
 *     npm run data:validate   무결성 검사 (id 중복, 참조 오류, 값 범위)
 *
 * 데이터 교체가 개발자 수작업에 종속되지 않아야 한다는 요구(피드백 3.2)에 따른 구조입니다.
 * ──────────────────────────────────────────────────────────────────
 *
 * 수치 필드의 의미 (모두 0–100 정규화):
 *   walkingLoad      단지 내 보행거리·경사·계단을 합산한 부담도
 *   familyScore      유아차 접근, 화장실, 그늘/실내 휴게 공간 확보 정도
 *   seniorScore      경사도, 벤치 밀도, 셔틀·주차 근접성
 *   rainySuitability 우천 시에도 관람이 가능한 정도
 *   transitAccess    역·터미널에서 대중교통만으로 도달 가능한 정도
 *   costLevel        입장료·체험료 등 1인 기준 비용 부담
 */

import type { Attraction } from '../domain/types/catalog';
import rawAttractions from './attractions.json';

/**
 * JSON 은 타입 정보를 갖지 못하므로 여기서 한 번 좁힌다.
 * 값의 유효성은 `validate.ts` 가 검사하며, 개발 모드에서는 로드 시점에 자동으로 돈다.
 */
export const ATTRACTIONS: readonly Attraction[] = rawAttractions as Attraction[];

/** id → 관광지 조회. 일정·로그·근거 화면이 모두 이 인덱스를 공유한다. */
export const ATTRACTION_BY_ID: ReadonlyMap<string, Attraction> = new Map(
  ATTRACTIONS.map((attraction) => [attraction.id, attraction]),
);

export function getAttraction(id: string): Attraction | undefined {
  return ATTRACTION_BY_ID.get(id);
}

/**
 * 조회 실패를 조용히 넘기면 화면에 빈 카드가 남는다.
 * 데이터 정합성 문제를 즉시 드러내기 위해 명시적으로 던진다.
 */
export function requireAttraction(id: string): Attraction {
  const attraction = ATTRACTION_BY_ID.get(id);
  if (!attraction) {
    throw new Error(`알 수 없는 관광지 id: ${id}`);
  }
  return attraction;
}
