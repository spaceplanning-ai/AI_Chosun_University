import { ExternalLink, FileText, TriangleAlert } from 'lucide-react';
import { DOCUMENT_FRESHNESS_DAYS } from '../../config/scoring';
import { getDocument } from '../../data/officialDocuments';
import { DOCUMENT_FIELD_LABELS, ISSUER_TYPE_LABELS } from '../../domain/labels';
import { cn } from '../../lib/cn';
import { daysBetween, formatIsoDate } from '../../lib/time';
import { Badge } from '../ui/Badge';

/**
 * 공식 출처 목록.
 *
 * 검수기준의 "출처 제시율 90% 이상"이 실제로 화면에 구현된 지점이다.
 * 문서명·출처기관·갱신일 세 가지를 항상 함께 보여 준다(제안서 7.3).
 * 갱신일이 오래된 자료는 조용히 넘어가지 않고 눈에 띄게 표시한다.
 */

export interface SourceListProps {
  documentIds: readonly string[];
  /** 갱신 경과일 판정 기준일 (ISO yyyy-mm-dd). */
  referenceDate: string;
  /** 문서가 확인해 주는 정보 항목을 함께 보여 줄지. 모바일에서는 생략한다. */
  showFields?: boolean;
  compact?: boolean;
  className?: string;
}

export function SourceList({
  documentIds,
  referenceDate,
  showFields = true,
  compact = false,
  className,
}: SourceListProps) {
  const documents = documentIds
    .map((id) => getDocument(id))
    .filter((document) => document !== undefined);

  if (documents.length === 0) {
    return (
      <p className="text-caption text-content-muted">
        공식 출처가 확인되지 않아 추천 대상에서 제외되었습니다.
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-col gap-sm', className)}>
      {documents.map((document) => {
        const age = daysBetween(document.updatedAt, referenceDate);
        const isStale = age >= DOCUMENT_FRESHNESS_DAYS.stale;
        const isAging = !isStale && age > DOCUMENT_FRESHNESS_DAYS.fresh;

        return (
          <li
            key={document.id}
            className={cn(
              'rounded-card bg-surface-sunken p-sm surface-outline',
              compact && 'p-xs',
            )}
          >
            <div className="flex items-start gap-sm">
              <FileText className="mt-[0.15em] size-[1.15em] shrink-0 text-content-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-label font-semibold text-content">{document.title}</p>

                <p className="mt-2xs flex flex-wrap items-center gap-x-sm gap-y-2xs text-caption text-content-muted">
                  <span>{document.issuer}</span>
                  <Badge size="sm" tone="neutral">
                    {ISSUER_TYPE_LABELS[document.issuerType]}
                  </Badge>
                  <span data-numeric="">최종 갱신 {formatIsoDate(document.updatedAt)}</span>
                  {isStale ? (
                    <Badge size="sm" tone="excluded" icon={TriangleAlert}>
                      {age}일 경과 · 확인 필요
                    </Badge>
                  ) : null}
                  {isAging ? (
                    <Badge size="sm" tone="caution">
                      {age}일 경과
                    </Badge>
                  ) : null}
                </p>

                {!compact ? (
                  <p className="mt-xs text-caption leading-relaxed text-content-secondary">
                    {document.excerpt}
                  </p>
                ) : null}

                {showFields ? (
                  <p className="mt-xs flex flex-wrap gap-2xs">
                    {document.fields.map((field) => (
                      <Badge key={field} size="sm" tone="brand">
                        {DOCUMENT_FIELD_LABELS[field]}
                      </Badge>
                    ))}
                  </p>
                ) : null}

                <p className="mt-xs flex items-center gap-2xs text-micro text-content-subtle">
                  <ExternalLink className="size-[1.1em]" aria-hidden />
                  <span className="truncate">{document.url}</span>
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
