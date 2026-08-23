/**
 * XLSX 워크북 작성기 (피드백 7.1 "CSV/XLSX 원시로그 및 실험용 내보내기").
 *
 * ── 왜 라이브러리를 쓰지 않았는가 ──────────────────────────────────
 * 키오스크는 전시장에서 오프라인으로 구동되고, 번들이 커질수록 부팅과 초기 로딩이 느려진다.
 * 엑셀 라이브러리는 대개 수백 KB~1MB 규모인데, 우리가 쓰는 기능은
 * "문자열과 숫자로 된 표 다섯 장"이 전부다. 그 대가를 치를 이유가 없다.
 *
 * 대신 XLSX 가 요구하는 최소 구조만 직접 만든다.
 *   · XLSX = OOXML 파일 몇 개를 담은 ZIP
 *   · 압축은 STORED(무압축)로 충분하다. 엑셀이 정상적으로 읽는다.
 *   · 문자열은 inlineStr 로 넣어 sharedStrings.xml 을 생략한다.
 *
 * CSV 와의 차이는 "다섯 장을 한 파일로" 라는 점이다. 연구자가 시트 사이를 오가며
 * session_id 로 조인할 수 있어, 파일 다섯 개를 따로 관리하는 것보다 실험에 편하다.
 * ──────────────────────────────────────────────────────────────────
 */

import { createZip, type ZipEntry } from './zip';

export type CellValue = string | number | boolean | null | undefined;

export interface Worksheet {
  /** 시트 탭 이름. 엑셀 제약에 맞춰 자동으로 다듬어진다. */
  name: string;
  /** 첫 행에 들어갈 머리글. */
  headers: readonly string[];
  rows: readonly (readonly CellValue[])[];
}

/* ── OOXML ────────────────────────────────────────────────────────── */

function escapeXml(text: string): string {
  return (
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      // 엑셀은 XML 1.0 이 금지하는 제어문자를 허용하지 않는다.
      // 로그 문자열에 하나라도 섞여 들어오면 파일 자체가 열리지 않으므로 미리 걷어낸다.
      .replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  );
}

/** 0 → A, 25 → Z, 26 → AA. 엑셀 열 이름 규칙. */
function columnName(index: number): string {
  let name = '';
  let remaining = index;
  while (remaining >= 0) {
    name = String.fromCodePoint((remaining % 26) + 65) + name;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return name;
}

function renderCell(value: CellValue, column: number, row: number): string {
  const reference = `${columnName(column)}${row}`;
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  // 문자열은 inlineStr 로 넣어 sharedStrings.xml 을 생략한다.
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function renderSheet(sheet: Worksheet): string {
  const headerRow = `<row r="1">${sheet.headers
    .map((header, column) => renderCell(header, column, 1))
    .join('')}</row>`;

  const bodyRows = sheet.rows
    .map((row, index) => {
      const rowNumber = index + 2;
      const cells = row.map((value, column) => renderCell(value, column, rowNumber)).join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headerRow}${bodyRows}</sheetData></worksheet>`;
}

/**
 * 시트 이름을 엑셀 제약에 맞춘다.
 * 31자 초과, `\/?*[]` 포함, 빈 이름은 파일이 열리지 않는 원인이 된다.
 */
export function sanitizeSheetName(name: string, fallback: string): string {
  const cleaned = name.replaceAll(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** 워크시트 목록 → XLSX 바이트열. */
export function createWorkbook(sheets: readonly Worksheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('시트가 하나도 없는 워크북은 만들 수 없습니다.');

  const encoder = new TextEncoder();
  const names = sheets.map((sheet, index) => sanitizeSheetName(sheet.name, `시트${index + 1}`));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')}</Relationships>`;

  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { path: '_rels/.rels', data: encoder.encode(rootRels) },
    { path: 'xl/workbook.xml', data: encoder.encode(workbook) },
    { path: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(renderSheet(sheet)),
    })),
  ];

  return createZip(entries);
}
