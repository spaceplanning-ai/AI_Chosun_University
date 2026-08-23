'use client';

import { useQueryState } from 'nuqs';

/**
 * 상세로 들어간 항목을 주소에 적는다.
 *
 * ── 왜 주소에 두는가 ───────────────────────────────────────────────
 * 상세를 화면 안의 상태로만 들고 있으면 새로고침하면 목록으로 튕기고,
 * 「이 문서 좀 봐 달라」고 링크를 건넬 수 없으며, 뒤로가기를 누르면 상세가 아니라
 * 다른 메뉴로 나가 버린다. 주소에 적어 두면 셋 다 저절로 풀린다.
 *
 * ── 왜 `?id=` 인가 ─────────────────────────────────────────────────
 * `/doc-manage/문서번호` 처럼 길을 하나 더 파면 화면마다 라우트 파일이 늘고,
 * 미리 만들어 둘 수 없는 주소(사람이 새로 등록한 항목)가 생겨 배포 방식을 가린다.
 * 물음표 뒤는 어느 배포 방식에서도 클라이언트가 그대로 읽는다.
 *
 * ── 왜 `nuqs` 인가 ─────────────────────────────────────────────────
 * `useSearchParams` 로 읽고 `router.push` 로 쓰는 일을 손으로 하면,
 * 화면마다 «다른 조건은 그대로 두고 id 만 바꾸기»·«뒤로가기 기록 남길지»를
 * 다시 정하게 되어 화면마다 동작이 갈린다. 그 규칙을 한 벌로 못 박아 주는 라이브러리다.
 */

/** 주소에 쓰는 이름. 화면이 여럿이어도 뜻은 하나 — «지금 열어 둔 항목». */
const RECORD_KEY = 'id';

export interface RecordRoute {
  /** 지금 열어 둔 항목. 목록을 보고 있으면 `undefined`. */
  recordId: string | undefined;
  /** 상세로 들어간다. */
  open: (id: string) => void;
  /** 목록으로 돌아간다. */
  close: () => void;
}

export function useRecordRoute(): RecordRoute {
  /*
    `push` 로 둔다 — 상세로 들어간 것은 «다른 곳으로 간 일»이므로
    뒤로가기를 누르면 목록으로 돌아와야 한다. `replace` 면 메뉴 밖으로 튕긴다.
  */
  const [recordId, setRecordId] = useQueryState(RECORD_KEY, { history: 'push' });

  return {
    recordId: recordId ?? undefined,
    open: (id) => void setRecordId(id),
    close: () => void setRecordId(null),
  };
}
