/**
 * 연구용 로그 워크북 (XLSX).
 *
 * CSV 5장과 **같은 데이터, 같은 열 정의**를 시트 다섯 장으로 묶는다.
 * 정의를 다시 쓰지 않고 `buildCsvTables` 가 쓰는 것과 동일한 열 목록을 재사용하므로,
 * CSV 와 XLSX 의 내용이 갈라질 수 없다.
 *
 * 파일 하나에 다섯 시트가 들어가므로 연구자가 session_id 로 시트 간 조인을 하기 쉽다.
 */

import { createWorkbook, type Worksheet } from './xlsx';
import { CSV_TABLE_DEFINITIONS } from './csv';
import type { SessionLog } from './schema';

/** 시트 탭에 쓸 이름. 파일명보다 짧아야 하므로 따로 둔다. */
const SHEET_NAMES: Record<string, string> = {
  'namdo-prism_sessions.csv': '세션요약',
  'namdo-prism_retrieval.csv': 'RAG검색',
  'namdo-prism_candidates.csv': '후보점수',
  'namdo-prism_exclusions.csv': '제외근거',
  'namdo-prism_replans.csv': '재구성이력',
};

export function buildLogWorkbook(sessions: readonly SessionLog[]): Uint8Array {
  const sheets: Worksheet[] = CSV_TABLE_DEFINITIONS.map((definition) => {
    const rows = definition.extract(sessions);
    return {
      name: SHEET_NAMES[definition.filename] ?? definition.filename,
      headers: definition.columns.map((column) => column.header),
      // CSV 와 달리 숫자를 문자열로 바꾸지 않는다. 엑셀에서 바로 집계할 수 있어야 한다.
      rows: rows.map((row) => definition.columns.map((column) => column.value(row))),
    };
  });

  return createWorkbook(sheets);
}

/** 브라우저에서 워크북을 내려받는다. */
export function downloadLogWorkbook(sessions: readonly SessionLog[], filename: string): void {
  const bytes = buildLogWorkbook(sessions);
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
