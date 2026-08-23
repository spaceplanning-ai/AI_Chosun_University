/**
 * 관광 데이터 CSV 반입/반출 도구.
 *
 * 피드백 3.2 — "데이터는 CSV/JSON 교체 후 재임베딩 또는 검색인덱스 갱신이 가능해야 하며,
 * 개발자 수작업에 종속되지 않도록 스크립트 또는 명령절차를 인계" 에 대한 구현이다.
 *
 *     node scripts/dataset.mjs export     JSON → CSV (엑셀 편집용)
 *     node scripts/dataset.mjs import     CSV → JSON (편집 결과 반영)
 *     node scripts/dataset.mjs validate   무결성 검사만 수행
 *
 * 배열 필드는 CSV 한 칸 안에 `|` 로 구분해 담는다. 쉼표를 쓰면 엑셀에서 열이 갈라진다.
 * 검색 색인은 별도 갱신 절차가 필요 없다 — 앱 시작 시 JSON에서 매번 다시 만들어진다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'src', 'data');
const CSV_DIR = join(HERE, '..', 'data-csv');

const ATTRACTIONS_JSON = join(DATA_DIR, 'attractions.json');
const DOCUMENTS_JSON = join(DATA_DIR, 'officialDocuments.json');
const ATTRACTIONS_CSV = join(CSV_DIR, 'attractions.csv');
const DOCUMENTS_CSV = join(CSV_DIR, 'officialDocuments.csv');

const LIST_SEPARATOR = '|';
const UTF8_BOM = '﻿';

/* ── 열 정의 ────────────────────────────────────────────────────────
   `kind` 가 CSV 문자열 ↔ JSON 값 변환 규칙을 결정한다.
   열을 추가할 때는 이 표만 고치면 export/import 양쪽이 함께 따라온다.        */

const ATTRACTION_COLUMNS = [
  { key: 'id', kind: 'text' },
  { key: 'name', kind: 'text' },
  { key: 'region', kind: 'text' },
  { key: 'district', kind: 'text' },
  { key: 'address', kind: 'text' },
  { key: 'coordinates.lat', kind: 'number' },
  { key: 'coordinates.lng', kind: 'number' },
  { key: 'categories', kind: 'list' },
  { key: 'audiences', kind: 'list' },
  { key: 'openingHours.open', kind: 'text' },
  { key: 'openingHours.close', kind: 'text' },
  { key: 'closedDays', kind: 'list' },
  { key: 'averageStayMinutes', kind: 'number' },
  { key: 'setting', kind: 'text' },
  { key: 'walkingLoad', kind: 'number' },
  { key: 'familyScore', kind: 'number' },
  { key: 'seniorScore', kind: 'number' },
  { key: 'rainySuitability', kind: 'number' },
  { key: 'transitAccess', kind: 'number' },
  { key: 'costLevel', kind: 'number' },
  { key: 'adjacentIds', kind: 'list' },
  { key: 'summary', kind: 'text' },
  { key: 'highlight', kind: 'text' },
  { key: 'motif', kind: 'text' },
];

const DOCUMENT_COLUMNS = [
  { key: 'id', kind: 'text' },
  { key: 'title', kind: 'text' },
  { key: 'issuer', kind: 'text' },
  { key: 'issuerType', kind: 'text' },
  { key: 'url', kind: 'text' },
  { key: 'updatedAt', kind: 'text' },
  { key: 'coversAttractionIds', kind: 'list' },
  { key: 'fields', kind: 'list' },
  { key: 'keywords', kind: 'list' },
  { key: 'excerpt', kind: 'text' },
];

/* ── CSV 직렬화 ──────────────────────────────────────────────────── */

function readPath(row, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], row);
}

function writePath(row, path, value) {
  const segments = path.split('.');
  const last = segments.pop();
  const target = segments.reduce((node, segment) => (node[segment] ??= {}), row);
  target[last] = value;
}

function escapeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /["\n\r,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  const header = columns.map((column) => column.key).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = readPath(row, column.key);
        return escapeCell(column.kind === 'list' ? (value ?? []).join(LIST_SEPARATOR) : value);
      })
      .join(','),
  );
  return UTF8_BOM + [header, ...body].join('\r\n') + '\r\n';
}

/** RFC 4180 파서. 따옴표 안의 쉼표·개행·이스케이프된 따옴표를 처리한다. */
function parseCsv(text) {
  const source = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r') {
      // \r\n 의 \r 은 버린다.
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

function fromCsv(text, columns, label) {
  const [header, ...dataRows] = parseCsv(text);
  if (!header) throw new Error(`${label}: CSV가 비어 있습니다.`);

  const expected = columns.map((column) => column.key);
  const missing = expected.filter((key) => !header.includes(key));
  if (missing.length > 0) {
    throw new Error(`${label}: 필수 열이 없습니다 — ${missing.join(', ')}`);
  }

  return dataRows.map((cells, rowIndex) => {
    const row = {};
    for (const column of columns) {
      const raw = (cells[header.indexOf(column.key)] ?? '').trim();
      if (column.kind === 'number') {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
          throw new Error(
            `${label}: ${rowIndex + 2}행 '${column.key}' 값이 숫자가 아닙니다 — "${raw}"`,
          );
        }
        writePath(row, column.key, numeric);
      } else if (column.kind === 'list') {
        writePath(
          row,
          column.key,
          raw.length === 0 ? [] : raw.split(LIST_SEPARATOR).map((entry) => entry.trim()),
        );
      } else {
        writePath(row, column.key, raw);
      }
    }
    return row;
  });
}

/* ── 검증 (validate.ts 와 같은 규칙을 JS로 옮긴 최소판) ─────────────
   스크립트는 TypeScript 를 컴파일하지 않고 돌아야 하므로 여기서 다시 구현한다.
   규칙이 갈라지지 않도록, 값 범위·참조 무결성처럼 데이터 교체 시 실제로 깨지는
   항목만 검사하고 나머지는 앱 로드 시점의 검증에 맡긴다.                    */

function validate(attractions, documents) {
  const issues = [];
  const attractionIds = new Set();

  for (const attraction of attractions) {
    const scope = `관광지 ${attraction.id || '(id 없음)'}`;
    if (!attraction.id) issues.push(`${scope}: id 가 비어 있습니다.`);
    if (attractionIds.has(attraction.id)) issues.push(`${scope}: id 가 중복되었습니다.`);
    attractionIds.add(attraction.id);

    for (const field of [
      'walkingLoad',
      'familyScore',
      'seniorScore',
      'rainySuitability',
      'transitAccess',
      'costLevel',
    ]) {
      const value = attraction[field];
      if (typeof value !== 'number' || value < 0 || value > 100) {
        issues.push(`${scope}: ${field} 는 0–100 이어야 합니다 (현재 ${value}).`);
      }
    }
    if (!(attraction.averageStayMinutes > 0)) {
      issues.push(`${scope}: averageStayMinutes 는 양수여야 합니다.`);
    }
    for (const clock of [attraction.openingHours?.open, attraction.openingHours?.close]) {
      if (!/^([01]\d|2[0-4]):[0-5]\d$/.test(clock ?? '')) {
        issues.push(`${scope}: 운영시간 형식 오류 — "${clock}" (HH:MM)`);
      }
    }
  }

  for (const attraction of attractions) {
    for (const adjacentId of attraction.adjacentIds ?? []) {
      if (!attractionIds.has(adjacentId)) {
        issues.push(`관광지 ${attraction.id}: 인접 id 를 찾을 수 없습니다 — ${adjacentId}`);
      }
    }
  }

  const documentIds = new Set();
  const covered = new Set();
  for (const document of documents) {
    const scope = `문서 ${document.id || '(id 없음)'}`;
    if (documentIds.has(document.id)) issues.push(`${scope}: id 가 중복되었습니다.`);
    documentIds.add(document.id);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(document.updatedAt ?? '')) {
      issues.push(`${scope}: 갱신일 형식 오류 — "${document.updatedAt}" (YYYY-MM-DD)`);
    }
    for (const attractionId of document.coversAttractionIds ?? []) {
      if (!attractionIds.has(attractionId)) {
        issues.push(`${scope}: 존재하지 않는 관광지를 참조합니다 — ${attractionId}`);
      }
      covered.add(attractionId);
    }
  }

  const uncovered = [...attractionIds].filter((id) => !covered.has(id));
  return { issues, uncovered };
}

/* ── 명령 ───────────────────────────────────────────────────────── */

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function report(attractions, documents) {
  const { issues, uncovered } = validate(attractions, documents);

  console.log(`관광지 ${attractions.length}곳 · 공식문서 ${documents.length}건`);
  if (uncovered.length > 0) {
    console.log(
      `\n[안내] 공식문서가 없어 항상 추천에서 제외되는 관광지 ${uncovered.length}곳: ${uncovered.join(', ')}`,
    );
  }
  if (issues.length === 0) {
    console.log('\n무결성 검사 통과 — 오류 0건');
    return true;
  }
  console.error(`\n무결성 검사 실패 — 오류 ${issues.length}건`);
  for (const issue of issues) console.error(`  · ${issue}`);
  return false;
}

const command = process.argv[2];

if (command === 'export') {
  const attractions = loadJson(ATTRACTIONS_JSON);
  const documents = loadJson(DOCUMENTS_JSON);
  if (!existsSync(CSV_DIR)) mkdirSync(CSV_DIR, { recursive: true });

  writeFileSync(ATTRACTIONS_CSV, toCsv(attractions, ATTRACTION_COLUMNS), 'utf8');
  writeFileSync(DOCUMENTS_CSV, toCsv(documents, DOCUMENT_COLUMNS), 'utf8');

  console.log(`내보내기 완료\n  ${ATTRACTIONS_CSV}\n  ${DOCUMENTS_CSV}`);
  console.log('\n엑셀에서 편집한 뒤 `npm run data:import` 로 되돌리십시오.');
  console.log('배열 항목은 한 칸 안에서 | 로 구분합니다.');
} else if (command === 'import') {
  if (!existsSync(ATTRACTIONS_CSV) || !existsSync(DOCUMENTS_CSV)) {
    console.error(`CSV 파일이 없습니다. 먼저 \`npm run data:export\` 를 실행하십시오.`);
    process.exit(1);
  }

  const attractions = fromCsv(readFileSync(ATTRACTIONS_CSV, 'utf8'), ATTRACTION_COLUMNS, 'attractions.csv');
  const documents = fromCsv(readFileSync(DOCUMENTS_CSV, 'utf8'), DOCUMENT_COLUMNS, 'officialDocuments.csv');

  // 검증을 통과하지 못한 데이터는 절대 기록하지 않는다.
  // 깨진 JSON을 남기면 앱이 뜨지 않아 되돌리기가 더 어려워진다.
  if (!report(attractions, documents)) {
    console.error('\n오류를 수정한 뒤 다시 실행하십시오. JSON은 변경되지 않았습니다.');
    process.exit(1);
  }

  writeJson(ATTRACTIONS_JSON, attractions);
  writeJson(DOCUMENTS_JSON, documents);
  console.log(`\n반영 완료\n  ${ATTRACTIONS_JSON}\n  ${DOCUMENTS_JSON}`);
  console.log('검색 색인은 앱 시작 시 자동으로 다시 만들어집니다. 별도 갱신 명령이 필요 없습니다.');
} else if (command === 'validate') {
  process.exit(report(loadJson(ATTRACTIONS_JSON), loadJson(DOCUMENTS_JSON)) ? 0 : 1);
} else {
  console.error('사용법: node scripts/dataset.mjs <export|import|validate>');
  process.exit(1);
}
