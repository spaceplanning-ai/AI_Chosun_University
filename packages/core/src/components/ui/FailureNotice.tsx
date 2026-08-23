'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

/**
 * 오류 안내화면 (제안서 13.4 "오류 발생 시 안내화면").
 *
 * 전시장에서 관람객이 스택 트레이스를 보게 해서는 안 되고, 동시에 진행자는
 * 무슨 일이 일어났는지 즉시 알 수 있어야 한다. 그래서 두 층으로 나눈다.
 *   ① 관람객용 — 무엇을 하면 되는지만 한 문장
 *   ② 진행자용 — 접힌 상태의 기술 상세 (펼쳐야 보인다)
 *
 * 검수기준의 "치명적 오류 0건"은 오류가 나지 않는다는 뜻이 아니라
 * 오류가 시연을 중단시키지 않는다는 뜻으로 구현했다.
 */

export interface FailureNoticeProps {
  title?: string;
  description?: string;
  /** 진행자용 기술 상세. 관람객에게는 접힌 상태로 노출된다. */
  detail?: string;
  actionLabel?: string;
  onRecover: () => void;
  className?: string;
}

export function FailureNotice({
  title = '화면을 불러오지 못했습니다',
  description = '잠시 후 처음 화면에서 다시 시도해 주세요. 이용에 불편을 드려 죄송합니다.',
  detail,
  actionLabel = '처음 화면으로',
  onRecover,
  className,
}: FailureNoticeProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex w-full max-w-stage flex-col items-start gap-md rounded-panel bg-surface-card p-xl shadow-raised surface-outline',
        className,
      )}
    >
      <span className="grid size-[3rem] place-items-center rounded-pill bg-critical-soft text-critical">
        <TriangleAlert className="size-[1.6rem]" aria-hidden />
      </span>

      <h1 className="text-title font-bold text-content text-balance-safe">{title}</h1>
      <p className="text-body text-content-muted text-balance-safe">{description}</p>

      <Button variant="accent" size="md" iconLeft={RotateCcw} onClick={onRecover}>
        {actionLabel}
      </Button>

      {detail ? (
        <div className="w-full">
          <Button variant="ghost" size="sm" onClick={() => setDetailOpen((open) => !open)}>
            {detailOpen ? '기술 상세 접기' : '진행자용 기술 상세 보기'}
          </Button>
          {detailOpen ? (
            <pre className="scrollable-y mt-xs max-h-[14rem] w-full rounded-card bg-surface-sunken p-md text-micro whitespace-pre-wrap text-content-muted">
              {detail}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
