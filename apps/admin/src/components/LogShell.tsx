'use client';

import type { ReactNode } from 'react';
import type { SessionLog } from '@namdo-prism/core/lib';
import { Badge, Panel } from '@namdo-prism/core/ui';
import { useAdminLog } from '@/state/logs';

/**
 * 로그를 바탕으로 하는 화면들의 공통 껍데기.
 *
 * ── 왜 공통으로 두는가 ─────────────────────────────────────────────
 * 로그 화면들은 모두 «키오스크가 내보낸 세션 로그» 하나를 본다.
 * 머리말·건수·판의 모양을 화면마다 따로 적으면 같은 자료를 보는 화면들이 서로 달라 보인다.
 *
 * ── 왜 비었을 때도 게시판을 그리는가 ───────────────────────────────
 * 예전에는 로그가 없으면 안내문 한 장으로 화면을 통째로 바꿨다.
 * 그러면 «이 화면이 원래 어떻게 생겼는지»를 볼 수 없어, 처음 여는 사람은
 * 무엇을 다루는 화면인지조차 알지 못한다. 열은 그대로 두고 표만 비워 두면
 * «무엇이 쌓일 자리인가»가 그대로 보인다. 안내는 그 빈 표 자리에서 한다.
 */

export interface LogShellProps {
  title: string;
  description: string;
  /** 표를 그린다. 로그가 없으면 빈 배열이 온다 — 그때도 게시판은 그대로 그린다. */
  children: (sessions: readonly SessionLog[]) => ReactNode;
  /** 검색·정렬 줄. 표가 있는 화면만 넘긴다. */
  controls?: ReactNode;
  /** 머리말 오른쪽. 안 주면 세션 건수를 적는다. */
  action?: ReactNode;
}

export function LogShell({ title, description, children, controls, action }: LogShellProps) {
  const sessions = useAdminLog((state) => state.sessions);

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title={title}
        description={description}
        action={action ?? <Badge tone={sessions.length === 0 ? 'neutral' : 'brand'}>세션 {sessions.length}건</Badge>}
      >
        {controls ? <div className="mb-md">{controls}</div> : null}
        {children(sessions)}
      </Panel>
    </div>
  );
}
