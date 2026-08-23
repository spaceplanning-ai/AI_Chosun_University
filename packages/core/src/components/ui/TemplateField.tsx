'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { FieldFrame, type FieldFrameProps } from './Form';

/**
 * 변수를 끼워 넣는 본문 편집칸.
 *
 * ── 왜 그냥 여러 줄 입력칸이 아닌가 ────────────────────────────────
 * 프롬프트 본문에는 실행 시점에 값이 채워지는 자리가 있다 — `{{documents}}` 처럼.
 * 이걸 사람이 손으로 적으면 «{{document}}» 처럼 한 글자 틀려도 화면에서는 똑같아 보이고,
 * 실행할 때는 아무 값도 안 채워진 채로 모델에 넘어간다. 조용히 잘못되는 종류의 오류다.
 *
 * 그래서 넣을 수 있는 변수를 **목록으로 주고 눌러서 끼워 넣게** 한다.
 * 손으로 적는 길도 막지 않되(그냥 글자다), 지금 본문이 어떤 변수를 쓰고 있는지와
 * 목록에 없는 변수를 적었는지를 아래에 그대로 보여 준다.
 *
 * ── 왜 서식 편집기(리치 에디터)가 아닌가 ───────────────────────────
 * 이 본문은 모델에 그대로 넘어가는 **글자**다. 굵게·색깔 같은 서식은 넘어갈 곳이 없고,
 * 편집기가 만들어 넣는 태그가 오히려 프롬프트를 더럽힌다.
 * 필요한 것은 서식이 아니라 «변수를 정확히 끼워 넣는 일»이므로 거기까지만 한다.
 */

export interface TemplateVariable {
  /** 중괄호 안에 들어가는 이름. `documents` 를 주면 `{{documents}}` 가 끼워진다. */
  token: string;
  label: string;
  /** 실행 시점에 무엇이 채워지는지. 버튼에 겹쳐 뜬다. */
  hint?: string;
}

/** 본문에서 `{{...}}` 자리를 찾는다. 앞뒤 공백은 허용한다 — 사람이 적으면 흔히 넣는다. */
const TOKEN_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** 본문이 실제로 쓰고 있는 변수 이름. 중복은 한 번만 센다. */
export function usedTokens(value: string): string[] {
  const found = new Set<string>();
  for (const match of value.matchAll(TOKEN_PATTERN)) found.add(match[1]!);
  return [...found];
}

export interface TemplateFieldProps extends Omit<FieldFrameProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  /** 끼워 넣을 수 있는 변수. 비어 있으면 그냥 여러 줄 입력칸과 같다. */
  variables: readonly TemplateVariable[];
}

export function TemplateField({
  value,
  onChange,
  placeholder,
  rows = 8,
  readOnly = false,
  variables,
  ...frame
}: TemplateFieldProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** 끼워 넣은 직후 글자 커서를 둘 자리. 그 자리에서 이어 쓰게 한다. */
  const caretRef = useRef<number>(undefined);

  /*
    값이 바뀐 뒤에야 커서를 옮길 수 있다 — 입력칸의 값은 부모가 들고 있어서
    onChange 를 부른 시점에는 아직 옛 글자가 들어 있기 때문이다.
  */
  useEffect(() => {
    const caret = caretRef.current;
    if (caret === undefined) return;
    caretRef.current = undefined;
    const area = areaRef.current;
    if (area === null) return;
    area.focus();
    area.setSelectionRange(caret, caret);
  });

  const insert = (token: string) => {
    const marker = `{{${token}}}`;
    const area = areaRef.current;
    // 아직 한 번도 안 눌렀으면 커서가 없다. 그때는 맨 뒤에 붙인다.
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    caretRef.current = start + marker.length;
    onChange(value.slice(0, start) + marker + value.slice(end));
  };

  const used = usedTokens(value);
  const known = new Set(variables.map((variable) => variable.token));
  /** 목록에 없는 변수. 실행할 때 아무 값도 안 채워지므로 알려 줘야 한다. */
  const unknown = used.filter((token) => !known.has(token));

  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <div className="rounded-control bg-surface-sunken px-md py-sm text-caption leading-relaxed whitespace-pre-wrap text-content">
          {/* 조회할 때도 변수 자리는 눈에 띄어야 «여기가 채워지는 자리»임이 읽힌다. */}
          {value.length === 0 ? <span className="text-content-subtle">—</span> : highlight(value)}
        </div>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame} as="div">
      {/*
        변수 줄을 입력칸 «위»에 둔다.
        아래에 두면 본문을 다 쓰고 나서야 눈에 들어와, 이미 손으로 적은 뒤가 된다.
      */}
      {variables.length > 0 ? (
        <span className="flex flex-wrap items-center gap-xs">
          <span className="text-micro text-content-muted">변수 넣기</span>
          {variables.map((variable) => (
            <button
              key={variable.token}
              type="button"
              onClick={() => insert(variable.token)}
              title={variable.hint}
              className={cn(
                'inline-flex items-center gap-2xs rounded-pill px-xs py-2xs text-micro font-semibold transition-colors duration-(--motion-fast)',
                used.includes(variable.token)
                  ? 'bg-brand-soft text-brand-text'
                  : 'bg-surface-sunken text-content-muted hover:bg-surface-raised',
              )}
            >
              <Plus className="size-[1em] shrink-0" aria-hidden />
              {variable.label}
            </button>
          ))}
        </span>
      ) : null}

      <textarea
        ref={areaRef}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={frame.error !== undefined}
        spellCheck={false}
        className="min-h-control-sm w-full rounded-control bg-surface-card px-md py-sm font-mono text-caption leading-relaxed text-content surface-outline placeholder:text-content-subtle"
      />

      {unknown.length > 0 ? (
        <span className="flex items-start gap-2xs text-micro text-caution">
          <AlertTriangle className="mt-[0.15em] size-[1.1em] shrink-0" aria-hidden />
          <span>
            {unknown.map((token) => `{{${token}}}`).join(' · ')} 는 채울 값이 없습니다. 이름이 틀렸는지
            확인하세요.
          </span>
        </span>
      ) : null}
    </FieldFrame>
  );
}

/** 본문을 글자와 변수 자리로 쪼개 변수만 다른 색으로 그린다. */
function highlight(value: string) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const at = match.index;
    if (at > cursor) parts.push(value.slice(cursor, at));
    parts.push(
      <span key={`${at}_${match[1]}`} className="rounded-pill bg-brand-soft px-xs font-semibold text-brand-text">
        {match[0]}
      </span>,
    );
    cursor = at + match[0].length;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}
