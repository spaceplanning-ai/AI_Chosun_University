import { getDocument } from '../../data/officialDocuments';
import type { RetrievalResult } from '../../domain/types/evidence';
import { formatElapsed, formatIsoDate } from '../../lib/time';
import { Badge } from '../ui/Badge';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { Meter } from '../ui/Meter';
import type { RetrievedDocument } from '../../domain/types/evidence';

/**
 * RAG 검색 결과표.
 *
 * 피드백 3.2의 "간이 연구자 화면에서 검색문서, 문서별 검색점수를 확인" 요구에 대응한다.
 * 검색어와 문서별 일치 어휘를 함께 보여 주어, 점수가 어디서 왔는지 되짚을 수 있게 한다.
 */

const COLUMNS: DataTableColumn<RetrievedDocument>[] = [
  {
    key: 'rank',
    header: '순위',
    align: 'right',
    numeric: true,
    width: '3.5rem',
    cell: (row) => row.rank,
  },
  {
    key: 'document',
    header: '검색된 공식문서',
    cell: (row) => {
      const document = getDocument(row.documentId);
      return (
        <div className="min-w-0">
          <p className="font-semibold text-content">{document?.title ?? row.documentId}</p>
          <p className="mt-2xs text-micro text-content-muted">
            {document?.issuer ?? '-'}
            {document ? ` · 갱신 ${formatIsoDate(document.updatedAt)}` : ''}
          </p>
        </div>
      );
    },
  },
  {
    key: 'similarity',
    header: '검색점수',
    width: '11rem',
    cell: (row) => (
      <Meter size="sm" label="유사도" value={row.similarity * 100} unit="%" tone="brand" />
    ),
  },
  {
    key: 'terms',
    header: '일치 검색어',
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
];

export interface RetrievalTableProps {
  retrieval: RetrievalResult;
  className?: string;
}

export function RetrievalTable({ retrieval, className }: RetrievalTableProps) {
  return (
    <div className={className}>
      <div className="mb-sm rounded-card bg-surface-sunken p-sm surface-outline">
        <p className="text-caption text-content-muted">검색질의</p>
        <p className="mt-2xs text-label text-content">{retrieval.query.text}</p>
        <p className="mt-xs flex flex-wrap items-center gap-x-sm gap-y-2xs text-micro text-content-subtle">
          <span data-numeric="">
            색인 {retrieval.corpusSize}건 중 {retrieval.documents.length}건 회수
          </span>
          <span data-numeric="">검색 소요 {formatElapsed(retrieval.elapsedMs)}</span>
        </p>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={retrieval.documents}
        rowKey={(row) => row.documentId}
        emptyMessage="검색된 공식문서가 없습니다."
      />
    </div>
  );
}
