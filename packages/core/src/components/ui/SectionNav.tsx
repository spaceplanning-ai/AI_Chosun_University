'use client';

import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * 긴 화면의 구역 목차.
 *
 * ── 왜 두는가 ──────────────────────────────────────────────────────
 * 등록 폼처럼 한 화면이 길어지면 «지금 어디쯤인지»와 «무엇이 더 남았는지»를
 * 스크롤바 말고는 알 길이 없다. 왼쪽에 구역 이름을 세워 두면 둘 다 보인다.
 *
 * ── 왜 탭이 아니라 목차인가 ────────────────────────────────────────
 * 탭으로 나누면 한 번에 한 구역만 보여 저장 전에 전체를 훑을 수 없다.
 * 목차는 눌러서 건너뛰되 훑어 내리는 길도 막지 않는다.
 *
 * 지금 보고 있는 구역은 스크롤을 지켜보고 표시한다 —
 * 눌러서 온 경우가 아니라 굴려 내려온 경우에도 맞아야 하기 때문이다.
 */

export interface SectionNavItem {
  /** 대상 구역의 `id`. 눌렀을 때 여기로 옮긴다. */
  id: string;
  label: string;
}

export interface SectionNavProps {
  items: readonly SectionNavItem[];
  /** 목차 전체를 읽어 줄 이름. */
  label: string;
  className?: string;
}

export function SectionNav({ items, label, className }: SectionNavProps) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null);
    if (targets.length === 0) return;

    /*
      화면 위쪽 1/3 지점을 기준선으로 삼는다.
      한가운데로 잡으면 마지막 구역이 짧을 때 끝까지 내려도 활성화되지 않는다.
    */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top ? entry : closest,
        );
        setActive(top.target.id);
      },
      { rootMargin: '0px 0px -66% 0px', threshold: 0 },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className={cn('flex flex-col gap-2xs', className)}>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            /*
              누른 즉시 표시를 옮긴다.
              스크롤을 지켜보는 쪽에만 맡기면, 마지막 구역처럼 짧아서 기준선까지
              올라오지 못하는 곳은 눌러도 표시가 안 바뀐다.
            */
            onClick={() => setActive(item.id)}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'rounded-control px-md py-xs text-caption font-semibold',
              'transition-colors duration-(--motion-fast)',
              current
                ? 'bg-brand-soft text-brand-text'
                : 'text-content-muted hover:bg-surface-sunken hover:text-content',
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
