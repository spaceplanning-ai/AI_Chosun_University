'use client';

import { useState } from 'react';

import { getAttraction } from '@namdo-prism/core/data';
import { REFINEMENT_DEFINITIONS } from '@namdo-prism/core/config';
import { formatElapsed, formatTimestamp, type SessionLog } from '@namdo-prism/core/lib';
import {
  Badge,
  DataTable,
  FilterChips,
  Panel,
  SearchField,
  SelectField,
  Toolbar,
  type DataTableColumn,
} from '@namdo-prism/core/ui';
import { SessionDetail } from '@/components/SessionDetail';
import { useRecordRoute } from '@/state/recordRoute';
import { useAdminLog } from '@/state/logs';

/**
 * 세션 로그 (6.1).
 *
 * 키오스크와 어드민은 별도 리포·별도 오리진으로 배포되므로 저장소를 공유할 수 없다.
 * 지금은 이 화면에 «가져오기»가 없다 — 요청에 따라 걷어냈다.
 * 따라서 백엔드가 붙어 세션을 내려주기 전까지 이 표를 채우는 길은 없다.
 *
 * ── 왜 목록과 상세로 나누는가 ──────────────────────────────────────
 * 한 세션에는 여행조건·회수 문서·후보 점수·재구성 이력이 모두 들어 있다.
 * 그것을 표 한 줄에 담을 수는 없으므로, 목록에는 훑어보는 값만 두고
 * 줄을 누르면 그 세션의 전모를 보는 상세로 들어간다.
 */

const COLUMNS: DataTableColumn<SessionLog>[] = [
  {
    key: 'session',
    header: '세션',
    rowHeader: true,
    cell: (row) => (
      <div>
        <p className="font-semibold text-content" data-numeric="">
          {row.sessionId}
        </p>
        <p className="mt-2xs text-micro text-content-muted">{formatTimestamp(row.startedAt)}</p>
      </div>
    ),
  },
  {
    key: 'kiosk',
    header: '기기',
    width: '11rem',
    cell: (row) => (
      <span className="text-micro text-content-muted">
        {row.kioskId} · {row.kioskLocation}
      </span>
    ),
  },
  {
    key: 'mode',
    header: 'UI 모드',
    width: '7rem',
    cell: (row) => (
      <Badge size="sm" tone={row.uiMode === 'large' ? 'accent' : 'neutral'}>
        {row.uiMode === 'large' ? '큰 글씨' : '일반'}
      </Badge>
    ),
  },
  {
    key: 'conditions',
    header: '여행조건',
    cell: (row) => (
      <span className="text-micro text-content-muted">
        {row.conditions.companion} / {row.conditions.duration} /{' '}
        {row.conditions.interests.join('·') || '미선택'}
      </span>
    ),
  },
  {
    key: 'linkage',
    header: '연계지수',
    align: 'right',
    numeric: true,
    width: '6rem',
    cell: (row) => row.finalItinerary.metrics.linkageScore,
  },
  {
    key: 'refinements',
    header: '수정요청',
    align: 'right',
    numeric: true,
    width: '6rem',
    cell: (row) => row.refinements.length,
  },
  {
    key: 'elapsed',
    header: '생성 시간',
    align: 'right',
    numeric: true,
    width: '7rem',
    cell: (row) => formatElapsed(row.generationMs),
  },
  {
    // 재구성까지 포함한 시간. 「이 세션이 통틀어 얼마나 걸렸나」를 본다.
    key: 'total',
    header: '누적 처리',
    align: 'right',
    numeric: true,
    width: '7rem',
    cell: (row) => formatElapsed(row.totalProcessingMs),
  },
  {
    key: 'qr',
    header: 'QR',
    align: 'center',
    width: '4.5rem',
    cell: (row) => (row.qrGenerated ? '생성' : '-'),
  },
];

/** 상세에 펼치는 재구성 한 줄. 이용자가 무엇을 눌렀고 그래서 얼마나 바뀌었는지. */
interface RefinementRow {
  key: string;
  request: string;
  changeRatio: number;
  elapsedMs: number;
  satisfied: boolean;
}

const REFINEMENT_COLUMNS: DataTableColumn<RefinementRow>[] = [
  {
    key: 'request',
    header: '요청',
    rowHeader: true,
    cell: (row) => <span className="font-semibold text-content">{row.request}</span>,
  },
  {
    key: 'change',
    header: '변경 비율',
    align: 'right',
    numeric: true,
    width: '8rem',
    // `changeRatio` 는 엔진이 이미 0–100 백분율로 준다.
    cell: (row) => `${row.changeRatio.toFixed(1)}%`,
  },
  {
    key: 'elapsed',
    header: '소요',
    align: 'right',
    numeric: true,
    width: '7rem',
    cell: (row) => formatElapsed(row.elapsedMs),
  },
  {
    key: 'satisfied',
    header: '판정',
    align: 'center',
    width: '7rem',
    cell: (row) => (
      <Badge size="sm" tone={row.satisfied ? 'positive' : 'critical'}>
        {row.satisfied ? '달성' : '미달'}
      </Badge>
    ),
  },
];

/** 목록을 무엇 기준으로 줄 세울지. 무엇을 찾으러 왔느냐에 따라 다르다. */
type SortKey = 'recent' | 'linkage' | 'elapsed' | 'refinements';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: '최근순' },
  { value: 'linkage', label: '연계지수 높은순' },
  { value: 'elapsed', label: '응답시간 긴순' },
  { value: 'refinements', label: '수정요청 많은순' },
];

/** QR 까지 간 세션이 «끝까지 쓴» 세션이다. 이탈 분석의 기준선이 된다. */
const QR_FILTER = 'qr';
const LARGE_FILTER = 'large';
const REFINED_FILTER = 'refined';

export function LogsView() {
  const sessions = useAdminLog((state) => state.sessions);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  /** 상세에서 보고 있는 세션. 주소에 적혀 있으므로 새로고침해도 그대로 열린다. */
  const route = useRecordRoute();
  const open = sessions.find((session) => session.sessionId === route.recordId);

  // 세션이 쌓이면 표를 눈으로 훑기 어렵다. 찾는 조건을 먼저 좁힌다.
  const chips = [
    { id: 'all', label: '전체', count: sessions.length },
    {
      id: QR_FILTER,
      label: 'QR 생성',
      count: sessions.filter((session) => session.qrGenerated).length,
    },
    {
      id: REFINED_FILTER,
      label: '수정요청 있음',
      count: sessions.filter((session) => session.refinements.length > 0).length,
    },
    {
      id: LARGE_FILTER,
      label: '큰 글씨',
      count: sessions.filter((session) => session.uiMode === 'large').length,
    },
  ];

  const filtered = sessions.filter((session) => {
    if (filter === QR_FILTER && !session.qrGenerated) return false;
    if (filter === REFINED_FILTER && session.refinements.length === 0) return false;
    if (filter === LARGE_FILTER && session.uiMode !== 'large') return false;
    const needle = query.trim().toLowerCase();
    return needle.length === 0 || session.sessionId.toLowerCase().includes(needle);
  });

  // 원본 배열을 건드리지 않도록 복사한 뒤 정렬한다.
  const rows = [...filtered].sort((a, b) => {
    if (sort === 'linkage') return b.finalItinerary.metrics.linkageScore - a.finalItinerary.metrics.linkageScore;
    if (sort === 'elapsed') return b.generationMs - a.generationMs;
    if (sort === 'refinements') return b.refinements.length - a.refinements.length;
    return b.startedAt.localeCompare(a.startedAt);
  });

  if (open) {
    const refinements: RefinementRow[] = open.refinements.map((refinement, index) => ({
      key: `${open.sessionId}_${index}`,
      request: REFINEMENT_DEFINITIONS[refinement.refinementId]?.label ?? refinement.refinementId,
      changeRatio: refinement.changeRatio,
      elapsedMs: refinement.elapsedMs,
      satisfied: refinement.objectiveSatisfied,
    }));

    return (
      <SessionDetail
        title={open.finalItinerary.title}
        description="키오스크가 내보낸 그대로입니다. 개인을 식별할 수 있는 항목은 들어 있지 않습니다."
        session={open}
        onBack={route.close}
      >
        <h3 className="text-subhead font-bold text-content">방문 순서</h3>
        <ol className="mt-md flex flex-wrap gap-xs">
          {open.finalItinerary.stopAttractionIds.map((attractionId, index) => (
            <li
              key={attractionId}
              className="flex items-center gap-xs rounded-card bg-surface-sunken px-md py-xs text-caption"
            >
              <span className="text-content-subtle" data-numeric="">
                {index + 1}
              </span>
              <span className="text-content">{getAttraction(attractionId)?.name ?? attractionId}</span>
            </li>
          ))}
        </ol>

        <hr className="my-lg border-0 border-t border-line-subtle" />

        <h3 className="text-subhead font-bold text-content">재구성 이력</h3>
        <p className="mt-2xs text-caption text-content-muted">
          누른 순서 그대로입니다. 자주 눌렀다면 첫 추천이 덜 맞았다는 뜻일 수 있습니다.
        </p>
        <DataTable
          className="mt-md"
          columns={REFINEMENT_COLUMNS}
          rows={refinements}
          rowKey={(row) => row.key}
        />
      </SessionDetail>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title={`보관 세션 ${sessions.length}건`}
        description="개인정보가 포함되지 않은 익명 기록입니다. 줄을 누르면 그 세션의 전모를 봅니다."
      >
        <FilterChips chips={chips} selected={filter} onSelect={setFilter} />
        <Toolbar
          className="mt-sm mb-md"
          total={
            <>
              <span data-numeric="">{rows.length}</span>건
            </>
          }
        >
          <SearchField value={query} onChange={setQuery} placeholder="세션 번호 검색" />
          <SelectField label="정렬" value={sort} options={SORT_OPTIONS} onChange={setSort} />
        </Toolbar>

        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.sessionId}
          onRowClick={(row) => route.open(row.sessionId)}
        />
      </Panel>
    </div>
  );
}
