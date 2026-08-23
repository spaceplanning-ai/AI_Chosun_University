'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { SelectMenu } from './SelectMenu';

/**
 * 입력 폼 부품.
 *
 * 등록·수정 화면이 여럿이라 «라벨 + 입력칸 + 설명 + 오류»의 배치를 각 화면이
 * 따로 짜면 화면마다 간격과 오류 표시가 달라진다. 여기서 한 번만 정한다.
 *
 * 라벨은 `<label>` 로 감싸 입력칸과 묶는다 — 라벨을 눌러도 초점이 가야
 * 손가락으로 조작할 때 실수가 줄고, 스크린리더가 무엇을 묻는지 읽을 수 있다.
 */

export interface FieldFrameProps {
  label: string;
  /** 입력칸 아래 한 줄. 무엇을 넣어야 하는지 알린다. */
  hint?: string;
  /** 채워야 하는 칸인지. 별표가 아니라 글자로 알린다 — 별표는 뜻이 학습되어야 보인다. */
  required?: boolean;
  /** 검증에 걸렸을 때의 문구. 있으면 hint 대신 이것을 보여 준다. */
  error?: string;
  children: ReactNode;
  className?: string;
  /** 감쌀 요소. 입력칸이 여럿인 칸은 `div` 를 넘긴다. */
  as?: 'label' | 'div';
}

/**
 * 라벨·설명·오류의 자리를 정하는 틀. 입력칸 종류와 무관하게 같은 모양이 되도록.
 *
 * ── `as` 를 둔 이유 ────────────────────────────────────────────────
 * 입력칸이 하나면 `<label>` 로 감싸야 라벨을 눌러도 초점이 간다.
 * 그런데 여러 개를 고르는 칸은 안에 버튼이 여럿이라, `<label>` 로 감싸면
 * 라벨을 눌렀을 때 **첫 버튼이 눌린다** — 「문화·예술」이 저절로 켜지는 식이다.
 * 스크린리더도 묶음 전체를 한 입력칸으로 잘못 읽는다.
 * 그런 칸은 `<div>` 로 감싸고 묶음에 따로 이름을 붙인다.
 */
export function FieldFrame({
  label,
  hint,
  required,
  error,
  children,
  className,
  as: Wrapper = 'label',
}: FieldFrameProps) {
  return (
    <Wrapper className={cn('flex min-w-0 flex-col gap-2xs', className)}>
      <span className="flex items-baseline gap-xs">
        <span className="text-caption font-semibold text-content">{label}</span>
        {required ? <span className="text-micro text-content-subtle">필수</span> : null}
      </span>

      {children}

      {error ? (
        <span className="text-micro text-critical" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-micro text-content-subtle">{hint}</span>
      ) : null}
    </Wrapper>
  );
}

/**
 * 읽기 전용일 때 값을 보여 주는 자리.
 *
 * ── 왜 폼을 두 벌 만들지 않는가 ────────────────────────────────────
 * 「조회」와 「수정」을 각각 그리면 칸 하나를 더할 때마다 두 군데를 고쳐야 하고,
 * 한쪽만 고쳐 둔 채 잊으면 조회에는 없는 값이 수정에만 생긴다.
 * 입력칸 자체가 두 모습을 갖게 하면 폼 구조는 한 벌로 끝난다.
 *
 * 테두리를 지우고 배경만 남긴다 — 눌러도 아무 일이 없는 칸이 입력칸처럼
 * 보이면 사람이 눌러 보고 «고장 났나» 한다.
 */
export function ReadonlyValue({ children }: { children: ReactNode }) {
  const empty = children === undefined || children === null || children === '';
  return (
    <p
      className={cn(
        'flex min-h-control-sm items-center rounded-control bg-surface-sunken px-md py-xs text-caption',
        empty ? 'text-content-subtle' : 'text-content',
      )}
    >
      {empty ? '—' : children}
    </p>
  );
}

/** 모든 입력칸이 같은 테두리·높이를 갖도록 한곳에 모아 둔다. */
const CONTROL_CLASS =
  'min-h-control-sm w-full rounded-control bg-surface-card px-md text-caption text-content surface-outline placeholder:text-content-subtle';

export interface TextFieldProps extends Omit<FieldFrameProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 여러 줄 입력. 본문·메모처럼 길이를 예측할 수 없는 값에 쓴다. */
  multiline?: boolean;
  rows?: number;
  /** 조회 상태. 값만 보여 주고 고칠 수 없다. */
  readOnly?: boolean;
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 4,
  readOnly = false,
  ...frame
}: TextFieldProps) {
  return (
    <FieldFrame {...frame} as={readOnly ? 'div' : 'label'}>
      {readOnly ? (
        <ReadonlyValue>{value}</ReadonlyValue>
      ) : multiline ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={frame.error !== undefined}
          className={cn(CONTROL_CLASS, 'py-sm leading-relaxed')}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={frame.error !== undefined}
          className={CONTROL_CLASS}
        />
      )}
    </FieldFrame>
  );
}

export interface NumberFieldProps extends Omit<FieldFrameProps, 'children'> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** 조회 상태. 값만 보여 주고 고칠 수 없다. */
  readOnly?: boolean;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  readOnly = false,
  ...frame
}: NumberFieldProps) {
  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>{value === undefined ? '' : `${value}${unit ? ` ${unit}` : ''}`}</ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame}>
      <span className="flex items-center gap-xs">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          /*
            빈 칸은 0 이 아니라 «아직 안 넣었다»로 다뤄야 한다.
            0 으로 바꿔 버리면 지우자마자 0 이 들어와 값이 조용히 생긴다.
          */
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
          aria-invalid={frame.error !== undefined}
          className={cn(CONTROL_CLASS, 'tabular-nums')}
        />
        {unit ? <span className="shrink-0 text-caption text-content-muted">{unit}</span> : null}
      </span>
    </FieldFrame>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps extends Omit<FieldFrameProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** 아직 고르지 않은 상태를 허용할 때의 안내 문구. */
  placeholder?: string;
  /** 조회 상태. 고른 값만 보여 준다. */
  readOnly?: boolean;
}

/**
 * 하나를 고르는 칸.
 *
 * 브라우저 기본 `<select>` 대신 직접 그린 `SelectMenu` 를 쓴다 —
 * 펼친 목록의 글꼴·간격·고른 표시를 운영체제가 정해 버리면
 * 같은 화면 안의 다른 칸들과 눈에 띄게 따로 논다.
 *
 * 안에 버튼이 들어가므로 `<label>` 이 아니라 `<div>` 로 감싼다.
 * 이름은 `SelectMenu` 가 `aria-label` 로 직접 들고 있다.
 */
export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  readOnly = false,
  ...frame
}: SelectInputProps) {
  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>{options.find((option) => option.value === value)?.label ?? ''}</ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame} as="div">
      <SelectMenu
        label={frame.label}
        showLabel={false}
        width="full"
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        invalid={frame.error !== undefined}
      />
    </FieldFrame>
  );
}

export interface MultiSelectFieldProps extends Omit<FieldFrameProps, 'children'> {
  values: readonly string[];
  onChange: (values: string[]) => void;
  options: readonly SelectOption[];
  /** 조회 상태. 고른 것만 보여 주고 끄고 켤 수 없다. */
  readOnly?: boolean;
}

/**
 * 여러 개를 고르는 칸.
 *
 * 여러 줄 짜리 `<select multiple>` 은 마우스로도 다루기 까다롭고 터치에서는 거의 못 쓴다.
 * 눌러서 켜고 끄는 칩이 «지금 무엇이 켜져 있는지»도 한눈에 보여 준다.
 */
export function MultiSelectField({
  values,
  onChange,
  options,
  readOnly = false,
  ...frame
}: MultiSelectFieldProps) {
  if (readOnly) {
    /* 고르지 않은 것은 아예 그리지 않는다. 회색 칩이 스물몇 개 깔리면 무엇을 골랐는지가 묻힌다. */
    const chosen = options.filter((option) => values.includes(option.value));
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>
          {chosen.length === 0 ? '' : (
            <span className="flex flex-wrap gap-xs">
              {chosen.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex items-center rounded-pill bg-brand-soft px-sm py-2xs text-micro font-semibold text-brand-text"
                >
                  {option.label}
                </span>
              ))}
            </span>
          )}
        </ReadonlyValue>
      </FieldFrame>
    );
  }

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);

  return (
    <FieldFrame {...frame} as="div">
      <span className="flex flex-wrap gap-xs" role="group" aria-label={frame.label}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className={cn(
                'inline-flex items-center gap-2xs rounded-pill px-md py-2xs text-caption font-semibold',
                'transition-colors duration-(--motion-fast)',
                selected
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface-sunken text-content-muted hover:bg-surface-raised',
              )}
            >
              {selected ? <Check className="size-[1em]" strokeWidth={3} aria-hidden /> : null}
              {option.label}
            </button>
          );
        })}
      </span>
    </FieldFrame>
  );
}

export interface ToggleFieldProps extends Omit<FieldFrameProps, 'children'> {
  value: boolean;
  onChange: (value: boolean) => void;
  /** 조회 상태. 켜짐·꺼짐만 보여 준다. */
  readOnly?: boolean;
}

/** 켜고 끄는 칸. 상태가 형태로도 보이도록 손잡이를 옮긴다. */
export function ToggleField({
  value,
  onChange,
  label,
  hint,
  readOnly = false,
  className,
}: ToggleFieldProps) {
  if (readOnly) {
    /* 눌러도 안 바뀌는 스위치를 두면 사람이 눌러 보고 «고장 났나» 한다. 글자로 적는다. */
    return (
      <FieldFrame label={label} hint={hint} as="div" className={className}>
        <ReadonlyValue>{value ? '켜짐' : '꺼짐'}</ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-md', className)}>
      <span className="flex min-w-0 flex-col gap-2xs">
        <span className="text-caption font-semibold text-content">{label}</span>
        {hint ? <span className="text-micro text-content-subtle">{hint}</span> : null}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn(
          'inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-2xs transition-colors duration-(--motion-fast)',
          value ? 'bg-brand' : 'bg-surface-sunken surface-outline',
        )}
      >
        <span
          className={cn(
            'size-4 rounded-pill bg-surface-card shadow-sm transition-transform duration-(--motion-fast)',
            value ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
