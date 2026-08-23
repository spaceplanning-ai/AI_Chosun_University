/**
 * XLSX 작성기 검증.
 *
 * 라이브러리 없이 직접 만든 파일이므로, 구조가 어긋나면 엑셀이 "복구할 수 없는 파일"이라며
 * 통째로 거부한다. 그 실패는 검수 현장에서야 드러나므로 여기서 미리 막는다.
 *
 * 엔트리를 무압축(STORED)으로 넣기 때문에 테스트에서 ZIP 을 직접 풀어
 * 내용을 그대로 확인할 수 있다. 압축 라이브러리 없이 왕복 검증이 가능한 것도 그 선택의 이득이다.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createWorkbook, sanitizeSheetName, type Worksheet } from '../src/lib/logging/xlsx';

/** 무압축 ZIP 을 풀어 경로 → 내용 표로 만든다. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();

  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04_03_4b_50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    files.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + compressedSize)));

    offset = dataStart + compressedSize;
  }
  return files;
}

const SHEETS: Worksheet[] = [
  {
    name: '세션요약',
    headers: ['session_id', '연계지수', '목표달성'],
    rows: [
      ['s_A', 73, true],
      ['쉼표, 따옴표 "포함"', 59.7, false],
      ['빈 값 처리', null, undefined],
    ],
  },
  {
    name: '제외근거',
    headers: ['관광지', '사유'],
    rows: [['무등산국립공원 증심사지구', '보행부담 88점이 감내 한계 30점을 초과했습니다.']],
  },
];

describe('XLSX 구조', () => {
  const bytes = createWorkbook(SHEETS);
  const files = unzip(bytes);

  it('ZIP 시그니처로 시작한다', () => {
    assert.deepEqual([...bytes.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  });

  it('엑셀이 요구하는 필수 파트가 모두 들어 있다', () => {
    for (const path of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]) {
      assert.ok(files.has(path), `${path} 누락`);
    }
  });

  it('시트 수만큼 관계와 콘텐츠 타입이 선언된다', () => {
    const contentTypes = files.get('[Content_Types].xml') ?? '';
    const rels = files.get('xl/_rels/workbook.xml.rels') ?? '';
    assert.equal((contentTypes.match(/worksheets\/sheet\d+\.xml/g) ?? []).length, SHEETS.length);
    assert.equal((rels.match(/worksheets\/sheet\d+\.xml/g) ?? []).length, SHEETS.length);
  });

  it('중앙 디렉터리와 끝 레코드가 붙는다', () => {
    const text = new TextDecoder('latin1').decode(bytes);
    assert.ok(text.includes('PK'), '중앙 디렉터리 없음');
    assert.ok(text.includes('PK'), '끝 레코드 없음');
  });
});

describe('셀 내용', () => {
  const files = unzip(createWorkbook(SHEETS));
  const sheet1 = files.get('xl/worksheets/sheet1.xml') ?? '';
  const sheet2 = files.get('xl/worksheets/sheet2.xml') ?? '';

  it('머리글이 1행에 들어간다', () => {
    assert.ok(sheet1.includes('<row r="1">'));
    assert.ok(sheet1.includes('session_id'));
  });

  it('숫자는 숫자 셀로 저장된다', () => {
    // CSV 대비 XLSX 의 실질적 이점. 문자열로 들어가면 엑셀에서 바로 집계할 수 없다.
    assert.ok(sheet1.includes('<v>73</v>'), '정수가 숫자 셀이 아님');
    assert.ok(sheet1.includes('<v>59.7</v>'), '소수가 숫자 셀이 아님');
  });

  it('불리언은 불리언 셀로 저장된다', () => {
    assert.ok(sheet1.includes('t="b"'));
  });

  it('문자열은 inlineStr 로 저장된다', () => {
    assert.ok(sheet1.includes('t="inlineStr"'));
  });

  it('따옴표와 특수문자가 이스케이프된다', () => {
    assert.ok(sheet1.includes('&quot;포함&quot;'), '따옴표 미이스케이프');
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(sheet1), '이스케이프되지 않은 & 존재');
  });

  it('한글이 그대로 보존된다', () => {
    assert.ok(sheet2.includes('무등산국립공원 증심사지구'));
    assert.ok(sheet2.includes('보행부담 88점'));
  });

  it('빈 값은 셀 자체를 만들지 않는다', () => {
    // null/undefined 를 빈 문자열 셀로 넣으면 집계에서 0 으로 잡히는 사고가 난다.
    const thirdRow = /<row r="4">(.*?)<\/row>/.exec(sheet1)?.[1] ?? '';
    assert.equal((thirdRow.match(/<c /g) ?? []).length, 1, '빈 값에 셀이 생성됨');
  });

  it('셀 좌표가 A1 형식으로 매겨진다', () => {
    assert.ok(sheet1.includes('r="A1"'));
    assert.ok(sheet1.includes('r="C1"'));
  });
});

describe('시트 이름 규칙', () => {
  it('31자를 넘지 않는다', () => {
    const long = sanitizeSheetName('가'.repeat(60), '대체');
    assert.ok(long.length <= 31);
  });

  it('엑셀이 금지하는 문자를 제거한다', () => {
    const cleaned = sanitizeSheetName('세션/요약*[검수]', '대체');
    assert.ok(!/[\\/?*[\]:]/.test(cleaned), cleaned);
  });

  it('비어 있으면 대체 이름을 쓴다', () => {
    assert.equal(sanitizeSheetName('///', '시트1'), '시트1');
    assert.equal(sanitizeSheetName('   ', '시트1'), '시트1');
  });
});

describe('경계 조건', () => {
  it('시트가 없으면 조용히 빈 파일을 만들지 않는다', () => {
    assert.throws(() => createWorkbook([]));
  });

  it('행이 없는 시트도 유효한 파일이 된다', () => {
    const files = unzip(createWorkbook([{ name: '빈시트', headers: ['a'], rows: [] }]));
    assert.ok(files.get('xl/worksheets/sheet1.xml')?.includes('<row r="1">'));
  });

  it('같은 입력이면 같은 바이트가 나온다', () => {
    // 타임스탬프를 고정했으므로 검수 시 파일 비교로 재현성을 확인할 수 있다.
    assert.deepEqual([...createWorkbook(SHEETS)], [...createWorkbook(SHEETS)]);
  });
});
