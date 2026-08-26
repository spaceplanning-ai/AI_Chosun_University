'use client';

import {
  COMPANION_LABELS,
  DURATION_LABELS,
  INTEREST_LABELS,
  TRANSPORT_LABELS,
  type Companion,
  type Duration,
  type Interest,
  type Transport,
} from '@namdo-prism/core/domain';
import { REFINEMENT_DEFINITIONS } from '@namdo-prism/core/config';
import { formatTimestamp, type SessionLog } from '@namdo-prism/core/lib';
import { Badge, BarList, DataTable, Meter, Stat, type DataTableColumn } from '@namdo-prism/core/ui';
import { LogShell } from '@/components/LogShell';
import { SessionDetail } from '@/components/SessionDetail';
import { useListControls } from '@/components/useListControls';
import { useRecordRoute } from '@/state/recordRoute';
import { useAdminLog } from '@/state/logs';

/**
 * 사용자 화면 (7.1–7.2).
 *
 * 로그 화면이 «엔진이 무엇을 했는가»라면, 여기는 «사람이 어떻게 썼는가»다.
 * 두 화면 모두 같은 세션 로그를 보므로 한곳에 모아 둔다 —
 * 로그 스키마가 바뀔 때 함께 고칠 수 있다.
 *
 * ── 왜 분포 위에 표를 두는가 ───────────────────────────────────────
 * 분포만 있으면 «친구 동행이 12회»까지는 알아도 그게 어느 세션이었는지 짚을 수 없다.
 * 이상한 값을 봤을 때 확인할 곳이 없으면 그 숫자는 되짚을 수 없는 숫자가 된다.
 * 그래서 같은 화면 안에 세션 목록을 두고, 줄을 누르면 그 세션의 전모로 들어간다.
 * 분포는 «전체가 어땠나», 표는 «그게 누구였나»다.
 */

/** 세는 함수. 라벨 사전을 받아 화면에 쓸 막대 항목으로 바꾼다. */
function countBy<T extends string>(
  sessions: readonly SessionLog[],
  pick: (session: SessionLog) => T | T[],
  labels: Record<T, string>,
) {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const picked = pick(session);
    for (const value of Array.isArray(picked) ? picked : [picked]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      key: value,
      label: labels[value as T] ?? value,
      value: count,
      unit: '회',
    }))
    .sort((a, b) => b.value - a.value);
}

/** 두 화면이 함께 쓰는 세션 열. 어느 화면에서 보든 같은 값이 같은 자리에 있어야 한다. */
const SESSION_COLUMN: DataTableColumn<SessionLog> = {
  key: 'session',
  header: '세션',
  rowHeader: true,
  width: '13rem',
  cell: (row) => (
    <div className="min-w-0">
      <p className="font-semibold text-content" data-numeric="">
        {row.sessionId}
      </p>
      <p className="mt-2xs text-micro text-content-muted">{formatTimestamp(row.startedAt)}</p>
    </div>
  ),
};

/** 목록을 무엇 기준으로 줄 세울지. 두 화면 모두 «언제»가 기본이다. */
const RECENT_SORT = {
  value: 'recent',
  label: '최근순',
  compare: (a: SessionLog, b: SessionLog) => b.startedAt.localeCompare(a.startedAt),
};

/** 검색이 훑을 글자. 세션 번호와 고른 값이 모두 걸리게 한다. */
const searchIn = (session: SessionLog) =>
  [
    session.sessionId,
    session.kioskLocation,
    COMPANION_LABELS[session.conditions.companion],
    DURATION_LABELS[session.conditions.duration],
    TRANSPORT_LABELS[session.conditions.transport],
    ...session.conditions.interests.map((interest) => INTEREST_LABELS[interest]),
  ].join(' ');

/* ── 7.1 이용 패턴 ────────────────────────────────────────────── */

const PATTERN_COLUMNS: DataTableColumn<SessionLog>[] = [
  SESSION_COLUMN,
  {
    key: 'companion',
    header: '동행',
    width: '7rem',
    cell: (row) => COMPANION_LABELS[row.conditions.companion],
  },
  {
    key: 'duration',
    header: '여행기간',
    width: '7rem',
    cell: (row) => DURATION_LABELS[row.conditions.duration],
  },
  {
    key: 'interests',
    header: '관심사',
    cell: (row) => (
      <span className="flex flex-wrap gap-2xs">
        {row.conditions.interests.map((interest) => (
          <Badge key={interest} size="sm" tone="brand">
            {INTEREST_LABELS[interest]}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    key: 'transport',
    header: '이동수단',
    width: '7rem',
    cell: (row) => TRANSPORT_LABELS[row.conditions.transport],
  },
  {
    key: 'mode',
    header: '화면',
    align: 'center',
    width: '6rem',
    cell: (row) => (
      <Badge size="sm" tone={row.uiMode === 'large' ? 'accent' : 'neutral'}>
        {row.uiMode === 'large' ? '큰 글씨' : '일반'}
      </Badge>
    ),
  },
  {
    key: 'refinements',
    header: '재구성',
    align: 'right',
    numeric: true,
    width: '6rem',
    cell: (row) => `${row.refinements.length}회`,
  },
];

export function FieldPatternView() {
  const sessions = useAdminLog((state) => state.sessions);
  /** 상세에서 보고 있는 세션. 주소에 적혀 있으므로 새로고침해도 그대로 열린다. */
  const route = useRecordRoute();
  const open = sessions.find((session) => session.sessionId === route.recordId);

  const list = useListControls({
    rows: sessions,
    searchIn,
    placeholder: '세션·동행·관심사 검색',
    pageSize: 10,
    sorts: [
      RECENT_SORT,
      {
        value: 'refinements',
        label: '재구성 많은순',
        compare: (a, b) => b.refinements.length - a.refinements.length,
      },
    ],
  });

  if (open) {
    return (
      <SessionDetail
        title="이용 상세"
        description="이 세션이 여행조건 5단계에서 고른 값입니다."
        session={open}
        onBack={route.close}
      />
    );
  }

  return (
    <LogShell
      title="이용 패턴"
      description="관람객이 실제로 무엇을 골랐는지. 선택지 구성을 다듬는 근거입니다."
    >
      {() => (
        <>
          {/*
            막대가 전부 0 인 그림은 «아무도 안 골랐다»로 읽히는데, 실제로는
            아직 아무것도 안 가져온 것이다. 둘은 전혀 다른 말이므로 그림을 아예 그리지 않는다.
            «비어 있다»는 아래 표가 한 번만 말한다.
          */}
          {sessions.length === 0 ? null : (
            <div className="grid gap-lg lg:grid-cols-2">
              <div>
                <p className="text-caption font-semibold text-content">동행</p>
                <BarList
                  className="mt-sm"
                  items={countBy(sessions, (s) => s.conditions.companion as Companion, COMPANION_LABELS)}
                  tone="brand"
                />
              </div>
              <div>
                <p className="text-caption font-semibold text-content">여행기간</p>
                <BarList
                  className="mt-sm"
                  items={countBy(sessions, (s) => s.conditions.duration as Duration, DURATION_LABELS)}
                  tone="brand"
                />
              </div>
              <div>
                <p className="text-caption font-semibold text-content">관심사 (복수 선택)</p>
                <BarList
                  className="mt-sm"
                  items={countBy(sessions, (s) => s.conditions.interests as Interest[], INTEREST_LABELS)}
                  tone="accent"
                />
              </div>
              <div>
                <p className="text-caption font-semibold text-content">이동수단</p>
                <BarList
                  className="mt-sm"
                  items={countBy(sessions, (s) => s.conditions.transport as Transport, TRANSPORT_LABELS)}
                  tone="accent"
                />
              </div>
              <div className="lg:col-span-2">
                <p className="text-caption font-semibold text-content">재구성 요청</p>
                <p className="mt-2xs text-micro text-content-muted">
                  자주 쓴다면 첫 추천이 덜 맞았다는 뜻일 수 있습니다.
                </p>
                <BarList
                  className="mt-sm"
                  items={[
                    ...new Set(sessions.flatMap((s) => s.refinements.map((r) => r.refinementId))),
                  ].map((id) => ({
                    key: id,
                    label: REFINEMENT_DEFINITIONS[id]?.label ?? id,
                    value: sessions.reduce(
                      (sum, session) =>
                        sum + session.refinements.filter((r) => r.refinementId === id).length,
                      0,
                    ),
                    unit: '회',
                  }))}
                  tone="caution"
                />
              </div>
            </div>
          )}

          {sessions.length === 0 ? null : (
            <hr className="my-lg border-0 border-t border-line-subtle" />
          )}

          <h3 className="text-subhead font-bold text-content">세션별 선택</h3>
          <div className="mt-md">{list.node}</div>
          <DataTable
            className="mt-md"
            columns={PATTERN_COLUMNS}
            rows={list.rows}
          emptyAction={'키오스크 세션 로그가 들어와야 채워집니다.'}
            rowKey={(row) => row.sessionId}
            onRowClick={(row) => route.open(row.sessionId)}
          />
          {list.pager}
        </>
      )}
    </LogShell>
  );
}

/* ── 7.2 QR 전환률 ────────────────────────────────────────────── */

const QR_COLUMNS: DataTableColumn<SessionLog>[] = [
  SESSION_COLUMN,
  {
    key: 'title',
    header: '일정',
    cell: (row) => row.finalItinerary.title,
  },
  {
    key: 'stops',
    header: '방문지',
    align: 'right',
    numeric: true,
    width: '6rem',
    cell: (row) => `${row.finalItinerary.stopAttractionIds.length}곳`,
  },
  {
    key: 'generated',
    header: 'QR 생성',
    align: 'center',
    width: '7rem',
    cell: (row) => (
      <Badge size="sm" tone={row.qrGenerated ? 'positive' : 'neutral'}>
        {row.qrGenerated ? '생성' : '안 함'}
      </Badge>
    ),
  },
  {
    key: 'opened',
    header: '휴대폰에서 열림',
    align: 'center',
    width: '9rem',
    cell: (row) =>
      // 만들지도 않은 세션에 «안 열림»이라 적으면 열어 볼 기회가 있었던 것처럼 읽힌다.
      row.qrGenerated ? (
        <Badge size="sm" tone={row.qrOpened ? 'positive' : 'caution'}>
          {row.qrOpened ? '열림' : '안 열림'}
        </Badge>
      ) : (
        <span className="text-content-subtle">—</span>
      ),
  },
];

export function FieldQrView() {
  const sessions = useAdminLog((state) => state.sessions);
  const route = useRecordRoute();
  const open = sessions.find((session) => session.sessionId === route.recordId);

  const list = useListControls({
    rows: sessions,
    searchIn: (session) => `${session.sessionId} ${session.finalItinerary.title}`,
    placeholder: '세션·일정명 검색',
    pageSize: 10,
    sorts: [
      RECENT_SORT,
      {
        value: 'dropped',
        // 안 가져간 세션이 먼저 보여야 «어디서 끊겼나»를 볼 수 있다.
        label: '안 가져간 것 먼저',
        compare: (a, b) => Number(a.qrGenerated) - Number(b.qrGenerated),
      },
    ],
  });

  if (open) {
    return (
      <SessionDetail
        title="전환 상세"
        description={
          open.qrGenerated
            ? open.qrOpened
              ? 'QR 을 만들고 휴대폰에서 열어 본 세션입니다.'
              : 'QR 을 만들었지만 휴대폰에서 열지 않은 세션입니다.'
            : '일정을 받고도 QR 을 만들지 않은 세션입니다.'
        }
        session={open}
        onBack={route.close}
      />
    );
  }

  return (
    <LogShell
      title="QR 전환률"
      description="만든 일정을 실제로 가져갔는지. 전시에서 끝나지 않고 여행으로 이어졌는지를 보는 지표입니다."
    >
      {() => {
        const generated = sessions.filter((session) => session.qrGenerated).length;
        const opened = sessions.filter((session) => session.qrOpened).length;
        const rate = sessions.length === 0 ? 0 : (generated / sessions.length) * 100;
        const openRate = generated === 0 ? 0 : (opened / generated) * 100;

        return (
          <>
            {/* 0% 는 «아무도 안 가져갔다»는 측정값이다. 안 가져온 것을 그렇게 적으면 거짓이 된다. */}
            {sessions.length === 0 ? null : (
              <>
                <div className="grid gap-md sm:grid-cols-3">
                  <Stat label="QR 생성" value={generated} unit="건" />
                  <Stat label="휴대폰에서 열림" value={opened} unit="건" />
                  <Stat
                    label="생성 비율"
                    value={rate.toFixed(1)}
                    unit="%"
                    tone={rate >= 50 ? 'positive' : 'caution'}
                  />
                </div>

                <div className="mt-md flex flex-col gap-md">
                  <Meter
                    label="일정을 QR 로 만든 비율"
                    value={rate}
                    unit="%"
                    tone={rate >= 50 ? 'positive' : 'caution'}
                    description="전체 세션 대비"
                  />
                  <Meter
                    label="만든 QR 이 실제로 열린 비율"
                    value={openRate}
                    unit="%"
                    tone={openRate >= 50 ? 'positive' : 'caution'}
                    description="QR 을 만든 세션 대비. 만들고 안 열었다면 화면 안내를 손볼 지점입니다."
                  />
                </div>
              </>
            )}

            {sessions.length === 0 ? null : (
              <hr className="my-lg border-0 border-t border-line-subtle" />
            )}

            <h3 className="text-subhead font-bold text-content">세션별 전환</h3>
            <div className="mt-md">{list.node}</div>
            <DataTable
              className="mt-md"
              columns={QR_COLUMNS}
              rows={list.rows}
          emptyAction={'키오스크 세션 로그가 들어와야 채워집니다.'}
              rowKey={(row) => row.sessionId}
              onRowClick={(row) => route.open(row.sessionId)}
            />
            {list.pager}
          </>
        );
      }}
    </LogShell>
  );
}
