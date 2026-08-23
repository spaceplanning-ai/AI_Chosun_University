'use client';

import { getAttraction, getDocument } from '@namdo-prism/core/data';
import type { SessionLog } from '@namdo-prism/core/lib';
import { Badge, DataTable, type DataTableColumn } from '@namdo-prism/core/ui';
import { LogShell } from '@/components/LogShell';
import { SessionDetail } from '@/components/SessionDetail';
import { useListControls } from '@/components/useListControls';
import { useRecordRoute } from '@/state/recordRoute';
import { useAdminLog } from '@/state/logs';

/**
 * 검색 로그 · 추천 로그 (6.2–6.3).
 *
 * ── 왜 한 파일에 모았는가 ──────────────────────────────────────────
 * 두 화면 모두 같은 세션 로그에서 서로 다른 조각을 꺼내 표로 만든다.
 * 파일을 나누면 «어느 조각을 어디서 꺼내는가»가 흩어져,
 * 로그 스키마가 바뀔 때 고칠 곳을 찾기 어려워진다. 한곳에 두면 함께 고친다.
 *
 * ── 왜 목록과 상세로 나누는가 ──────────────────────────────────────
 * 목록의 한 줄은 «이 세션에서 이런 일이 있었다»는 요약일 뿐이다.
 * 이상한 줄을 찾았을 때 정작 필요한 것은 그 세션의 전모다 —
 * 어떤 조건이었고, 무엇을 회수했고, 무엇이 밀렸는지.
 * 그것을 목록에 다 펼치면 표를 훑을 수 없으므로, 줄을 누르면 상세로 들어간다.
 *
 * 값은 모두 실제 로그에서 나온다 — 예시 줄을 넣지 않는다.
 */

/** 세션 하나를 여러 줄로 펼칠 때 쓰는 키. 같은 세션의 여러 항목을 구분한다. */
const rowKey = (sessionId: string, index: number) => `${sessionId}_${index}`;

/** 문서 id 를 사람이 읽는 이름으로. 색인에서 빠진 문서는 id 를 그대로 보인다. */
const documentName = (documentId: string) => getDocument(documentId)?.title ?? documentId;

/* ── 6.2 검색 로그 ────────────────────────────────────────────── */

interface RetrievalRow {
  key: string;
  sessionId: string;
  terms: string;
  found: number;
  topScore: number;
  topDocument: string;
  session: SessionLog;
}

const RETRIEVAL_COLUMNS: DataTableColumn<RetrievalRow>[] = [
  { key: 'session', header: '세션', width: '11rem', cell: (row) => row.sessionId },
  { key: 'terms', header: '검색어 분해', cell: (row) => row.terms },
  {
    key: 'found',
    header: '회수',
    align: 'right',
    numeric: true,
    width: '6rem',
    cell: (row) => (
      // 한 건도 못 찾은 질의가 곧 색인을 보강할 지점이다.
      <span className={row.found === 0 ? 'text-critical' : 'text-content-secondary'}>
        {row.found}건
      </span>
    ),
  },
  {
    key: 'score',
    header: '최고 점수',
    align: 'right',
    numeric: true,
    width: '8rem',
    cell: (row) => row.topScore.toFixed(3),
  },
  { key: 'top', header: '1위 문서', cell: (row) => row.topDocument },
];

/** 상세에서 펼치는 회수 문서. 목록의 «1위 문서» 뒤에 무엇이 더 있었는지를 본다. */
interface RetrievedRow {
  documentId: string;
  rank: number;
  similarity: number;
  matchedTerms: string[];
}

const RETRIEVED_COLUMNS: DataTableColumn<RetrievedRow>[] = [
  { key: 'rank', header: '순위', align: 'center', numeric: true, width: '4.5rem', cell: (row) => row.rank },
  {
    key: 'document',
    header: '문서명',
    rowHeader: true,
    cell: (row) => <span className="font-semibold text-content">{documentName(row.documentId)}</span>,
  },
  {
    key: 'terms',
    header: '걸린 검색어',
    cell: (row) => (
      <span className="flex flex-wrap gap-2xs">
        {row.matchedTerms.map((term) => (
          <Badge key={term} size="sm" tone="brand">
            {term}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    key: 'similarity',
    header: '유사도',
    align: 'right',
    numeric: true,
    width: '7rem',
    cell: (row) => row.similarity.toFixed(3),
  },
];

export function RagLogView() {
  const sessions = useAdminLog((state) => state.sessions);
  /** 상세에서 보고 있는 세션. 주소에 적혀 있으므로 새로고침해도 그대로 열린다. */
  const route = useRecordRoute();
  const open = sessions.find((session) => session.sessionId === route.recordId);

  const rows: RetrievalRow[] = sessions.map((session) => {
    const top = session.retrieval.documents[0];
    return {
      key: session.sessionId,
      sessionId: session.sessionId,
      terms: session.retrieval.query.terms.join(' · '),
      found: session.retrieval.documents.length,
      topScore: top?.similarity ?? 0,
      topDocument: top ? documentName(top.documentId) : '—',
      session,
    };
  });

  const list = useListControls({
    rows,
    searchIn: (row) => `${row.sessionId} ${row.terms} ${row.topDocument}`,
    placeholder: '세션·검색어·문서명 검색',
    pageSize: 10,
    sorts: [
      { value: 'score', label: '점수 낮은순', compare: (a, b) => a.topScore - b.topScore },
      { value: 'found', label: '회수 적은순', compare: (a, b) => a.found - b.found },
      { value: 'session', label: '세션순', compare: (a, b) => a.sessionId.localeCompare(b.sessionId) },
    ],
  });

  if (open) {
    return (
      <SessionDetail
        title="검색 상세"
        description={`«${open.retrieval.query.text}» 로 색인 ${open.retrieval.corpusSize}건 가운데 ${open.retrieval.documents.length}건을 회수했습니다.`}
        session={open}
        onBack={route.close}
      >
        <h3 className="text-subhead font-bold text-content">회수 문서</h3>
        <DataTable
          className="mt-md"
          columns={RETRIEVED_COLUMNS}
          rows={open.retrieval.documents}
          rowKey={(row) => row.documentId}
        />
      </SessionDetail>
    );
  }

  return (
    <LogShell
      title="검색 로그"
      description="세션마다 어떤 낱말로 무엇을 회수했는지. 빈손으로 돌아온 질의가 색인 보강 지점입니다."
      controls={list.node}
    >
      {() => (
        <>
          <DataTable
            columns={RETRIEVAL_COLUMNS}
            rows={list.rows}
            rowKey={(row) => row.key}
            onRowClick={(row) => route.open(row.sessionId)}
          />
          {list.pager}
        </>
      )}
    </LogShell>
  );
}

/* ── 6.3 추천 로그 ────────────────────────────────────────────── */

interface RecommendationRow {
  key: string;
  sessionId: string;
  attraction: string;
  score: number;
  /** 최종 일정에 들어갔는가. */
  selected: boolean;
  session: SessionLog;
}

const SELECTED_COLUMN = {
  key: 'selected',
  header: '채택',
  align: 'center',
  width: '7rem',
} as const;

const RECOMMENDATION_COLUMNS: DataTableColumn<RecommendationRow>[] = [
  { key: 'session', header: '세션', width: '11rem', cell: (row) => row.sessionId },
  { key: 'attraction', header: '관광지', rowHeader: true, cell: (row) => row.attraction },
  {
    key: 'score',
    header: '추천점수',
    align: 'right',
    numeric: true,
    width: '8rem',
    cell: (row) => row.score.toFixed(1),
  },
  {
    ...SELECTED_COLUMN,
    cell: (row) => (
      <Badge size="sm" tone={row.selected ? 'positive' : 'neutral'}>
        {row.selected ? '일정 포함' : '후보'}
      </Badge>
    ),
  },
];

/** 상세에서 펼치는 후보 한 줄. 목록과 달리 자르지 않고 전부 보인다. */
interface CandidateRow {
  attractionId: string;
  rank: number;
  attraction: string;
  score: number;
  trustScore: number;
  selected: boolean;
}

const CANDIDATE_COLUMNS: DataTableColumn<CandidateRow>[] = [
  { key: 'rank', header: '순위', align: 'center', numeric: true, width: '4.5rem', cell: (row) => row.rank },
  {
    key: 'attraction',
    header: '관광지',
    rowHeader: true,
    cell: (row) => <span className="font-semibold text-content">{row.attraction}</span>,
  },
  {
    key: 'score',
    header: '추천점수',
    align: 'right',
    numeric: true,
    width: '8rem',
    cell: (row) => row.score.toFixed(1),
  },
  {
    key: 'trust',
    header: '정보신뢰도',
    align: 'right',
    numeric: true,
    width: '8rem',
    cell: (row) => row.trustScore.toFixed(1),
  },
  {
    ...SELECTED_COLUMN,
    cell: (row) => (
      <Badge size="sm" tone={row.selected ? 'positive' : 'neutral'}>
        {row.selected ? '일정 포함' : '후보'}
      </Badge>
    ),
  },
];

/** 목록에 올릴 상위 후보 수. 세션마다 수십 곳이라 전부 펼치면 훑을 수 없다. */
const TOP_CANDIDATES = 5;

/** 후보를 점수 높은 순으로. 원본 배열을 건드리지 않도록 복사한 뒤 정렬한다. */
const byScore = (session: SessionLog) => [...session.candidates].sort((a, b) => b.total - a.total);

const attractionName = (attractionId: string) =>
  getAttraction(attractionId)?.name ?? attractionId;

export function RecommendationLogView() {
  const sessions = useAdminLog((state) => state.sessions);
  const route = useRecordRoute();
  const open = sessions.find((session) => session.sessionId === route.recordId);

  const rows: RecommendationRow[] = sessions.flatMap((session) => {
    // 스냅샷은 방문 순서를 유지한 관광지 id 목록으로 일정을 담는다.
    const selectedIds = new Set(session.finalItinerary.stopAttractionIds);
    return byScore(session)
      .slice(0, TOP_CANDIDATES)
      .map((candidate, index) => ({
        key: rowKey(session.sessionId, index),
        sessionId: session.sessionId,
        attraction: attractionName(candidate.attractionId),
        score: candidate.total,
        selected: selectedIds.has(candidate.attractionId),
        session,
      }));
  });

  const list = useListControls({
    rows,
    searchIn: (row) => `${row.sessionId} ${row.attraction}`,
    placeholder: '세션·관광지명 검색',
    pageSize: 10,
    sorts: [
      { value: 'score', label: '점수 높은순', compare: (a, b) => b.score - a.score },
      {
        value: 'dropped',
        label: '밀린 것 먼저',
        compare: (a, b) => Number(a.selected) - Number(b.selected),
      },
      { value: 'name', label: '관광지명순', compare: (a, b) => a.attraction.localeCompare(b.attraction) },
    ],
  });

  if (open) {
    const selectedIds = new Set(open.finalItinerary.stopAttractionIds);
    const candidates: CandidateRow[] = byScore(open).map((candidate, index) => ({
      attractionId: candidate.attractionId,
      // 로그의 `rank` 는 엔진이 매긴 순위다. 점수로 다시 줄 세운 이 표의 자리와 같아야 한다.
      rank: index + 1,
      attraction: attractionName(candidate.attractionId),
      score: candidate.total,
      trustScore: candidate.trustScore,
      selected: selectedIds.has(candidate.attractionId),
    }));

    return (
      <SessionDetail
        title="추천 상세"
        description={`후보 ${candidates.length}곳 가운데 ${open.finalItinerary.stopAttractionIds.length}곳이 일정에 들어갔습니다.`}
        session={open}
        onBack={route.close}
      >
        <h3 className="text-subhead font-bold text-content">후보 전체</h3>
        <p className="mt-2xs text-caption text-content-muted">
          목록에서는 상위 {TOP_CANDIDATES}곳만 보이지만, 여기서는 자르지 않습니다.
        </p>
        <DataTable
          className="mt-md"
          columns={CANDIDATE_COLUMNS}
          rows={candidates}
          rowKey={(row) => row.attractionId}
        />
      </SessionDetail>
    );
  }

  return (
    <LogShell
      title="추천 로그"
      description={`세션마다 점수 상위 ${TOP_CANDIDATES}곳과 채택 여부입니다. 무엇이 왜 빠졌는지가 설명가능성의 핵심 기록입니다.`}
      controls={list.node}
    >
      {() => (
        <>
          <DataTable
            columns={RECOMMENDATION_COLUMNS}
            rows={list.rows}
            rowKey={(row) => row.key}
            onRowClick={(row) => route.open(row.sessionId)}
          />
          {list.pager}
        </>
      )}
    </LogShell>
  );
}
