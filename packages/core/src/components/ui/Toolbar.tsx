'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { SelectMenu } from './SelectMenu';

/**
 * 목록 화면 상단 도구줄.
 *
 * 칩 필터 → 검색·정렬 → 우측 건수 순서로 둔다.
 * «무엇을 좁혔는가»를 먼저 보고, 그 결과가 몇 건인지 오른쪽에서 확인하는 흐름이다.
 */

export interface FilterChip {
  id: string;
  label: string;
  /** 이 조건에 해당하는 건수. 누르기 전에 결과 규모를 알 수 있다. */
  count: number;
}

export interface FilterChipsProps {
  chips: readonly FilterChip[];
  selected: string;
  onSelect: (id: string) => void;
  className?: string;
}

/** 칩 필터. 선택지가 적고 서로 배타적일 때 쓴다. */
export function FilterChips({ chips, selected, onSelect, className }: FilterChipsProps) {
  return (
    <div className={cn('flex flex-wrap gap-xs', className)} role="group" aria-label="목록 필터">
      {chips.map((chip) => {
        const isActive = chip.id === selected;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(chip.id)}
            className={cn(
              'inline-flex items-center gap-xs rounded-pill px-md py-2xs text-caption font-semibold',
              'transition-colors duration-(--motion-fast)',
              isActive
                ? 'bg-brand text-on-brand'
                : 'bg-surface-sunken text-content-muted hover:bg-surface-raised',
            )}
          >
            {chip.label}
            <span
              className={cn('tabular-nums', isActive ? 'opacity-85' : 'text-content-subtle')}
              data-numeric=""
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** 검색 입력. 돋보기를 안에 넣어 «여기가 검색»임을 형태로 알린다. */
export function SearchField({ value, onChange, placeholder, className }: SearchFieldProps) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <Search
        className="pointer-events-none absolute inset-y-0 start-md my-auto size-[1.1em] text-content-subtle"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-control-sm w-full rounded-control bg-surface-card ps-2xl pe-md text-caption text-content surface-outline placeholder:text-content-subtle"
      />
    </div>
  );
}

export interface ToolbarProps {
  /** 검색·정렬 등 왼쪽에 놓이는 조작 요소. */
  children: ReactNode;
  /** 오른쪽 끝 건수 표시. */
  total?: ReactNode;
  className?: string;
}

/** 검색·정렬 줄. 오른쪽 끝에는 지금 몇 건이 걸렸는지만 둔다. */
export function Toolbar({ children, total, className }: ToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-sm', className)}>
      {children}
      {total === undefined ? null : (
        <span className="ms-auto shrink-0 text-caption text-content-muted">{total}</span>
      )}
    </div>
  );
}

export interface SelectFieldProps<TValue extends string> {
  label: string;
  value: TValue;
  options: readonly { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
  className?: string;
}

/**
 * 라벨을 안에 품은 선택 상자.
 *
 * 좁은 줄에서 라벨을 따로 두면 자리를 두 배로 먹는다.
 * 실제 그리기는 `SelectMenu` 가 맡는다 — 브라우저 기본 상자는 펼친 목록의
 * 모양을 손댈 수 없어 어드민의 다른 부분과 따로 논다.
 */
export function SelectField<TValue extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SelectFieldProps<TValue>) {
  return (
    <SelectMenu
      className={className}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
