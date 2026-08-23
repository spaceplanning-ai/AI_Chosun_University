/**
 * 공식 관광문서 색인 로더.
 *
 * ── 데이터의 원본은 이 파일이 아니라 `officialDocuments.json` 입니다 ──
 * 문서를 추가·갱신하려면 JSON 또는 CSV 반입 절차를 사용하십시오 (`src/data/README.md`).
 * ──────────────────────────────────────────────────────────────────
 *
 * `updatedAt`·`issuerType`·`fields` 세 항목의 조합이 그대로 정보 신뢰도 점수가 됩니다.
 * 실증 데이터를 넣을 때도 이 세 항목은 반드시 실제 값으로 채워야 합니다.
 *
 * 일부 관광지는 의도적으로 단일·노후 출처만 보유합니다.
 * "근거가 부족한 경우 추천대상에서 제외한다"(제안서 7.3)는 규칙이 시연 중
 * 실제로 발동하는 것을 검수자가 눈으로 확인할 수 있어야 하기 때문입니다.
 */

import type { OfficialDocument } from '../domain/types/catalog';
import { ATTRACTIONS } from './attractions';
import rawDocuments from './officialDocuments.json';
import { assertDatasetInDevelopment } from './validate';

export const OFFICIAL_DOCUMENTS: readonly OfficialDocument[] = rawDocuments as OfficialDocument[];

// 관광지와 문서가 모두 로드된 시점이 상호 참조를 검사할 수 있는 가장 이른 지점이다.
assertDatasetInDevelopment(ATTRACTIONS, OFFICIAL_DOCUMENTS);

/** id → 공식문서 조회. */
export const DOCUMENT_BY_ID: ReadonlyMap<string, OfficialDocument> = new Map(
  OFFICIAL_DOCUMENTS.map((document) => [document.id, document]),
);

export function getDocument(id: string): OfficialDocument | undefined {
  return DOCUMENT_BY_ID.get(id);
}

/** 관광지 → 그 관광지를 다루는 공식문서 목록. 신뢰도 산출의 입력이 된다. */
export const DOCUMENTS_BY_ATTRACTION: ReadonlyMap<string, readonly OfficialDocument[]> = (() => {
  const index = new Map<string, OfficialDocument[]>();
  for (const document of OFFICIAL_DOCUMENTS) {
    for (const attractionId of document.coversAttractionIds) {
      const bucket = index.get(attractionId);
      if (bucket) {
        bucket.push(document);
      } else {
        index.set(attractionId, [document]);
      }
    }
  }
  return index;
})();

export function getDocumentsFor(attractionId: string): readonly OfficialDocument[] {
  return DOCUMENTS_BY_ATTRACTION.get(attractionId) ?? [];
}
