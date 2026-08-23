'use client';

import { ACCEPTANCE_TARGETS, REFINEMENT_DEFINITIONS } from '@namdo-prism/core/config';
import { formatElapsed } from '@namdo-prism/core/lib';
import type { SessionLog } from '@namdo-prism/core/lib';
import { Badge, DataTable, type DataTableColumn } from '@namdo-prism/core/ui';
import { LogShell } from '@/components/LogShell';
import { SessionDetail } from '@/components/SessionDetail';
import { useListControls } from '@/components/useListControls';
import { useRecordRoute } from '@/state/recordRoute';
import { useAdminLog } from '@/state/logs';

/**
 * 에러 로그 (6.4).
 *
 * ── 무엇을 «에러»로 보는가 ─────────────────────────────────────────
 * 이 시스템은 예외를 던지고 멈추는 일이 거의 없다. 대신 **조용히 나쁜 결과**를 낸다 —
 * 아무것도 못 찾은 검색, 요청을 못 이룬 재구성, 목표를 넘긴 응답시간.
 * 이런 것들은 화면에서는 정상처럼 보이지만 결과는 실패다.
 *
 * 그래서 여기 모으는 것은 «예외 스택»이 아니라 **결과가 기준을 못 지킨 순간**이다.
 * 세션 로그에서 뽑아낼 뿐, 없는 오류를 지어내지 않는다 — 로그가 없으면 이 표도 비어 있다.
 */

type Severity = 'error' | 'warning';

interface ErrorRow {
  key: string;
  sessionId: string;
  kind: string;
  severity: Severity;
  detail: string;
  /** 상세에서 원본을 다시 짚기 위한 세션. */
  session: SessionLog;
}

/** 한 세션에서 기준을 못 지킨 순간을 모두 뽑는다. 한 세션이 여러 줄이 될 수 있다. */
function collect(session: SessionLog): Omit<ErrorRow, 'session'>[] {
  const found: Omit<ErrorRow, 'session'>[] = [];

  // 근거 문서를 한 건도 못 찾은 검색은 답변이 근거 없이 나갔다는 뜻이다.
  if (session.retrieval.documents.length === 0) {
    found.push({
      key: `${session.sessionId}_retrieval`,
      sessionId: session.sessionId,
      kind: '검색 실패',
      severity: 'error',
      detail: `«${session.retrieval.query.terms.join(' ')}» 로 회수한 문서가 없습니다.`,
    });
  }

  // 요청한 목표를 못 이룬 재구성. 관람객은 눌렀는데 원하는 결과를 못 받은 것이다.
  session.refinements.forEach((trace, index) => {
    if (trace.objectiveSatisfied) return;
    const label = REFINEMENT_DEFINITIONS[trace.refinementId]?.label ?? trace.refinementId;
    found.push({
      key: `${session.sessionId}_replan_${index}`,
      sessionId: session.sessionId,
      kind: '재구성 미달성',
      severity: 'error',
      detail: `«${label}» 요청이 목표를 이루지 못했습니다.`,
    });
  });

  if (session.generationMs > ACCEPTANCE_TARGETS.medianResponseMs) {
    found.push({
      key: `${session.sessionId}_slow`,
      sessionId: session.sessionId,
      kind: '응답 지연',
      severity: 'warning',
      detail: `일정 생성에 ${formatElapsed(session.generationMs)} 걸렸습니다. 목표는 ${formatElapsed(
        ACCEPTANCE_TARGETS.medianResponseMs,
      )} 입니다.`,
    });
  }

  return found;
}

const COLUMNS: DataTableColumn<ErrorRow>[] = [
  {
    key: 'kind',
    header: '종류',
    rowHeader: true,
    width: '10rem',
    cell: (row) => <span className="font-semibold text-content">{row.kind}</span>,
  },
  { key: 'session', header: '세션', width: '11rem', cell: (row) => row.sessionId },
  { key: 'detail', header: '내용', cell: (row) => row.detail },
  {
    key: 'severity',
    header: '등급',
    align: 'center',
    width: '7rem',
    cell: (row) => (
      <Badge size="sm" tone={row.severity === 'error' ? 'critical' : 'caution'}>
        {row.severity === 'error' ? '오류' : '경고'}
      </Badge>
    ),
  },
];

export function ErrorLogView() {
  const sessions = useAdminLog((state) => state.sessions);
  const route = useRecordRoute();

  const rows: ErrorRow[] = sessions.flatMap((session) =>
    collect(session).map((entry) => ({ ...entry, session })),
  );
  /*
    한 세션이 여러 줄이 될 수 있어 세션 번호로는 어느 줄인지 못 가린다.
    줄의 열쇠(«세션_검색실패» 같은)를 그대로 주소에 적는다.
  */
  const open = rows.find((row) => row.key === route.recordId);

  const list = useListControls({
    rows,
    searchIn: (row) => `${row.sessionId} ${row.kind} ${row.detail}`,
    placeholder: '세션·종류·내용 검색',
    pageSize: 10,
    sorts: [
      {
        value: 'severity',
        label: '오류 먼저',
        compare: (a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'),
      },
      { value: 'session', label: '세션순', compare: (a, b) => a.sessionId.localeCompare(b.sessionId) },
    ],
  });

  if (open) {
    return (
      <SessionDetail
        title={open.kind}
        description={open.detail}
        session={open.session}
        onBack={route.close}
      />
    );
  }

  return (
    <LogShell
      title="에러 로그"
      description="결과가 기준을 못 지킨 순간만 모읍니다."
      controls={list.node}
      action={<Badge tone={rows.length === 0 ? 'neutral' : 'critical'}>걸린 항목 {rows.length}건</Badge>}
    >
      {() => (
        <>
          <DataTable
            columns={COLUMNS}
            rows={list.rows}
            rowKey={(row) => row.key}
            onRowClick={(row) => route.open(row.key)}
          />
          {list.pager}
        </>
      )}
    </LogShell>
  );
}
