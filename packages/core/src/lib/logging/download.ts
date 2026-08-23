/**
 * 브라우저 파일 내보내기.
 *
 * 키오스크는 전시장에서 오프라인으로 돌아가고, 어드민은 별도 리포·별도 오리진으로 배포된다.
 * 따라서 로그는 서버가 아니라 파일로 건네는 것이 유일하게 성립하는 경로다
 * (키오스크에서 내보내기 → 어드민에서 가져오기).
 */

import type { CsvTable } from './csv';
import type { SessionLogBundle } from './schema';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // 즉시 해제하면 일부 브라우저에서 저장이 취소되므로 한 틱 뒤에 정리한다.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 임의의 텍스트를 파일로 내려받는다. 시험결과서·데이터 내보내기에 쓴다. */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  triggerDownload(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
}

export function downloadCsvTable(table: CsvTable): void {
  triggerDownload(new Blob([table.content], { type: 'text/csv;charset=utf-8' }), table.filename);
}

export function downloadCsvTables(tables: readonly CsvTable[]): void {
  for (const table of tables) downloadCsvTable(table);
}

/** 어드민이 그대로 가져올 수 있는 원본 묶음. CSV로는 표현이 어려운 중첩 구조까지 보존한다. */
export function downloadLogBundle(bundle: SessionLogBundle, filename: string): void {
  triggerDownload(
    new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' }),
    filename,
  );
}

/** 파일에서 로그 묶음을 읽어들인다. 스키마 버전이 다르면 거부한다. */
export async function readLogBundle(file: File): Promise<SessionLogBundle> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('schemaVersion' in parsed) ||
    !('sessions' in parsed) ||
    !Array.isArray((parsed as SessionLogBundle).sessions)
  ) {
    throw new Error('로그 파일 형식이 올바르지 않습니다.');
  }

  const bundle = parsed as SessionLogBundle;
  if (bundle.schemaVersion !== 1) {
    throw new Error(`지원하지 않는 로그 스키마 버전입니다: ${String(bundle.schemaVersion)}`);
  }
  return bundle;
}
