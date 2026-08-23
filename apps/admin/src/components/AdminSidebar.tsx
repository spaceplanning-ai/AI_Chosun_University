'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ADMIN_NAVIGATION, findNavItem, type AdminViewId } from '@/config/navigation';

/**
 * 어드민 좌측 메뉴.
 *
 * 묶음을 접어 둔다. 59개를 다 펼치면 목록이 화면을 넘겨 스크롤해야 하고,
 * 스크롤하는 순간 «지금 어디에 있는지»가 화면 밖으로 사라진다.
 *
 * 한 번에 하나만 펼친다. 여럿을 열어 두면 결국 다시 스크롤이 생겨 접은 의미가 없어진다.
 *
 * 다만 항목이 하나뿐인 묶음은 접지 않는다 — 펼쳐 봐야 같은 이름이 한 번 더 나올 뿐이고,
 * 두 번 눌러야 닿는 화면이 된다. 그런 묶음은 바로 여는 버튼으로 둔다.
 */

export interface AdminSidebarProps {
  current: AdminViewId;
  onSelect: (id: AdminViewId) => void;
}

export function AdminSidebar({ current, onSelect }: AdminSidebarProps) {
  const currentGroup = findNavItem(current).group.label;

  /** 펼쳐 둔 묶음 하나. 같은 것을 다시 누르면 접는다. */
  const [opened, setOpened] = useState<string | undefined>(currentGroup);

  const toggle = (label: string) =>
    setOpened((current) => (current === label ? undefined : label));

  return (
    <nav
      aria-label="관리 메뉴"
      className="w-[15rem] shrink-0 border-r border-line-subtle bg-surface-page"
    >
      <div className="flex h-svh flex-col gap-2xs overflow-y-auto px-sm py-md">
        <div className="px-sm pb-sm">
          <p className="text-label font-bold text-content">AI 남도 프리즘</p>
        </div>

        {ADMIN_NAVIGATION.map((group) => {
          const isOpen = opened === group.label;

          /*
            항목이 하나뿐인 묶음은 그 항목 자체가 곧 묶음이다.
            접었다 펴는 대신 한 번에 열리는 버튼으로 그린다.
          */
          const only = group.items.length === 1 ? group.items[0] : undefined;
          if (only) {
            const isActive = only.id === current;
            return (
              <button
                key={group.label}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(only.id)}
                className={[
                  'flex w-full items-center gap-xs rounded-control px-sm py-[0.4rem] text-left text-caption font-semibold',
                  'transition-colors duration-(--motion-fast)',
                  isActive
                    ? 'bg-brand-soft text-brand'
                    : 'text-content-secondary hover:bg-surface-sunken',
                ].join(' ')}
              >
                <group.icon className="size-[1.1em] shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{group.label}</span>
              </button>
            );
          }

          return (
            <section key={group.label}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(group.label)}
                className="flex w-full items-center gap-xs rounded-control px-sm py-[0.4rem] text-left text-caption font-semibold text-content-secondary transition-colors duration-(--motion-fast) hover:bg-surface-sunken"
              >
                <group.icon className="size-[1.1em] shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{group.label}</span>
                <ChevronDown
                  className={[
                    'ml-auto size-[1em] shrink-0 transition-transform duration-(--motion-fast)',
                    isOpen ? '' : '-rotate-90',
                  ].join(' ')}
                  aria-hidden
                />
              </button>

              {isOpen ? (
                <ul className="animate-accordion-in flex flex-col pb-2xs">
                  {group.items.map((item) => {
                    const isActive = item.id === current;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => onSelect(item.id)}
                          className={[
                            'flex w-full items-center gap-xs py-[0.4rem] pe-sm ps-lg text-left text-caption',
                            'transition-colors duration-(--motion-fast)',
                            // 선택 표시는 모서리를 굴리지 않고 왼쪽 선으로만 준다.
                            // 목록이 길수록 알약 모양이 겹겹이 쌓여 어수선해진다.
                            'border-s-2',
                            isActive
                              ? 'border-brand bg-brand-soft font-semibold text-brand'
                              : 'border-transparent text-content-muted hover:bg-surface-sunken',
                          ].join(' ')}
                        >
                          <span className="min-w-0 truncate">{item.label}</span>
                          {item.status === 'planned' ? (
                            // 눌러 봐야 아는 구조면 빈 화면을 하나씩 확인하며 돌아다니게 된다.
                            <span
                              className="ml-auto size-[0.4rem] shrink-0 rounded-pill bg-caution"
                              aria-label="연결 대기"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </nav>
  );
}
