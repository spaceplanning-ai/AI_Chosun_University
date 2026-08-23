'use client';

import { useId, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * 탭.
 *
 * ── 언제 쓰는가 ────────────────────────────────────────────────────
 * 한 대상에 대해 **성격이 다른 두세 갈래**를 보여 줄 때 쓴다.
 * 「정보」와 「검증」처럼, 같이 봐야 할 일은 드물고 각각은 통째로 봐야 하는 경우다.
 * 이어서 훑어 내려야 하는 것들(폼의 구역들)은 탭 대신 구분선과 목차로 나눈다 —
 * 탭으로 나누면 저장 전에 전체를 훑을 수 없다.
 *
 * ── 직접 그리면 무엇을 갖춰야 하는가 ───────────────────────────────
 * 스크린리더가 「탭 2개 중 1번째」로 읽으려면 role 이 맞물려야 하고,
 * 키보드에서는 화살표로 옮겨야 한다. 탭 안에서 Tab 키는 «다음 탭»이 아니라
 * «탭 목록을 빠져나가 내용으로» 가야 하므로, 고르지 않은 탭은 초점 순서에서 뺀다.
 */

export interface TabItem {
  id: string;
  label: string;
  /** 탭 이름 옆 건수. 누르기 전에 규모를 알 수 있다. */
  count?: number;
}

export interface TabsProps {
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** 탭 묶음 전체를 읽어 줄 이름. */
  label: string;
  /** 고른 탭의 내용. 감싸는 일은 여기서 한다. */
  children: ReactNode;
  className?: string;
}

export function Tabs({ items, value, onChange, label, children, className }: TabsProps) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  /** 화살표로 옮긴다. 옮기는 즉시 그 탭을 편다 — 한 번 더 누르게 하지 않는다. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const current = items.findIndex((item) => item.id === value);
    if (current === -1) return;

    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'Home' ? -current : event.key === 'End' ? items.length - 1 - current : 0;
    if (step === 0) return;

    event.preventDefault();
    const next = items[(current + step + items.length) % items.length];
    if (!next) return;
    onChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(next.id))}`)?.focus();
  };

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-2xs border-b border-line"
      >
        {items.map((item) => {
          const current = item.id === value;
          return (
            <button
              key={item.id}
              id={tabId(item.id)}
              type="button"
              role="tab"
              aria-selected={current}
              aria-controls={panelId(item.id)}
              // 고르지 않은 탭은 Tab 키 순서에서 뺀다. 화살표로만 옮긴다.
              tabIndex={current ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={cn(
                'relative -mb-px flex items-center gap-xs px-md py-sm text-caption font-semibold',
                'transition-colors duration-(--motion-fast)',
                current
                  ? 'border-b-2 border-accent text-content'
                  : 'border-b-2 border-transparent text-content-muted hover:text-content',
              )}
            >
              {item.label}
              {item.count === undefined ? null : (
                <span
                  className={cn(
                    'rounded-pill px-xs py-[0.1em] text-micro font-bold tabular-nums',
                    current ? 'bg-accent-soft text-accent-text' : 'bg-surface-sunken text-content-muted',
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id={panelId(value)} role="tabpanel" aria-labelledby={tabId(value)} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
