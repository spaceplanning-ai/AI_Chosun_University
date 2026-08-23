/**
 * ZIP 작성기 (무압축).
 *
 * ── 왜 직접 만드는가 ───────────────────────────────────────────────
 * 키오스크는 전시장에서 오프라인으로 구동되고, 번들이 커질수록 부팅이 느려진다.
 * 압축 라이브러리는 대개 수백 KB 인데, 여기서 필요한 것은 «파일 몇 개를 한 봉투에
 * 담는 일»뿐이다. 그 대가를 치를 이유가 없다.
 *
 * ── 왜 무압축인가 ──────────────────────────────────────────────────
 * 담는 것이 XLSX 의 XML 이거나 이미 압축된 그림(PNG·JPEG)이다. 앞의 것은 양이 작고
 * 뒤의 것은 다시 압축해도 줄지 않는다. 압축 없이도 엑셀·탐색기·macOS 가 모두 연다.
 *
 * ── 왜 날짜를 고정하는가 ───────────────────────────────────────────
 * 같은 자료에서 언제 만들어도 같은 바이트가 나와야, 검수 때 파일을 견주어
 * «내용이 그대로인지»를 확인할 수 있다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 봉투에 담을 파일 하나. `path` 에 `/` 를 넣으면 폴더가 된다. */
export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

/* ── CRC32 (ZIP 규격) ─────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** 리틀엔디언 정수 바이트열. ZIP 헤더 필드는 모두 이 형식이다. */
function le(value: number, byteLength: 2 | 4): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < byteLength; index += 1) {
    bytes[index] = (value >>> (index * 8)) & 0xff;
  }
  return bytes;
}

/**
 * 무압축 ZIP 을 만든다.
 *
 * 날짜·시각 필드는 고정값을 쓴다. 같은 데이터에서 항상 같은 바이트가 나와야
 * 검수 시 파일 비교로 재현성을 확인할 수 있기 때문이다.
 */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  const DOS_TIME = 0;
  const DOS_DATE = 0x21_00; // 1996-08-00 상당. 재현성을 위한 고정값.

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const checksum = crc32(entry.data);

    const localHeader = concat([
      le(0x04_03_4b_50, 4), // 로컬 파일 헤더 시그니처
      le(20, 2), // 필요 버전
      le(0x08_00, 2), // 플래그: UTF-8 파일명
      le(0, 2), // 압축 방식: STORED
      le(DOS_TIME, 2),
      le(DOS_DATE, 2),
      le(checksum, 4),
      le(entry.data.length, 4),
      le(entry.data.length, 4),
      le(nameBytes.length, 2),
      le(0, 2), // extra 길이
      nameBytes,
    ]);

    localChunks.push(localHeader, entry.data);

    centralChunks.push(
      concat([
        le(0x02_01_4b_50, 4), // 중앙 디렉터리 시그니처
        le(20, 2), // 생성 버전
        le(20, 2), // 필요 버전
        le(0x08_00, 2),
        le(0, 2),
        le(DOS_TIME, 2),
        le(DOS_DATE, 2),
        le(checksum, 4),
        le(entry.data.length, 4),
        le(entry.data.length, 4),
        le(nameBytes.length, 2),
        le(0, 2), // extra
        le(0, 2), // comment
        le(0, 2), // disk
        le(0, 2), // internal attrs
        le(0, 4), // external attrs
        le(offset, 4),
        nameBytes,
      ]),
    );

    offset += localHeader.length + entry.data.length;
  }

  const central = concat(centralChunks);
  const end = concat([
    le(0x06_05_4b_50, 4), // 중앙 디렉터리 끝 시그니처
    le(0, 2),
    le(0, 2),
    le(entries.length, 2),
    le(entries.length, 2),
    le(central.length, 4),
    le(offset, 4),
    le(0, 2), // comment 길이
  ]);

  return concat([...localChunks, central, end]);
}
