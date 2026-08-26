'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  MultiSelectField,
  NumberField,
  Panel,
  SelectInput,
  TemplateField,
  TextField,
  ToggleField,
} from '@namdo-prism/core/ui';
import { useResourceStore } from '@/state/resources';
import type { ResourceField, ResourceRecord, ResourceSchema } from '@/config/resourceSchemas';

/**
 * 설정 화면 틀 — 값 한 벌을 고친다.
 *
 * ── 목록 관리와 무엇이 다른가 ──────────────────────────────────────
 * 프롬프트나 시나리오는 여럿을 등록해 두고 고르는 자료다.
 * 반면 «지금 쓰는 모델», «검색 판정 기준» 같은 것은 한 벌뿐이라
 * 목록·등록·삭제가 있으면 오히려 «여러 벌 중 하나»라는 잘못된 인상을 준다.
 * 그래서 같은 스키마를 쓰되 화면은 폼 하나로 둔다.
 *
 * 저장 위치는 목록 관리와 같다 — 브라우저에만 남고, 반영은 사람이 한다.
 * 다만 여기서는 내보낼 파일이 한 줄짜리라 «지금 값»과 «저장된 값»의 차이를
 * 눈에 보이게 하는 편이 더 쓸모 있어, 바뀐 항목 수를 머리말에 적는다.
 * ──────────────────────────────────────────────────────────────────
 */

type DraftValue = string | number | boolean | string[] | undefined;
type Draft = Record<string, DraftValue>;

/** 저장된 값에서 편집용 사본을 뜬다. 없으면 스키마의 기본값을 쓴다. */
function toDraft(fields: readonly ResourceField[], record: ResourceRecord | undefined): Draft {
  const draft: Draft = {};
  for (const field of fields) {
    const saved = record?.[field.key];
    if (saved !== undefined) {
      draft[field.key] = saved;
      continue;
    }
    if (field.kind === 'multiselect') draft[field.key] = [];
    else if (field.kind === 'toggle') draft[field.key] = field.defaultValue === true;
    else if (field.kind === 'number') draft[field.key] = field.defaultValue as number | undefined;
    else draft[field.key] = (field.defaultValue as string | undefined) ?? '';
  }
  return draft;
}

/** 두 값이 같은가. 배열은 순서까지 같아야 «안 바뀐 것»으로 본다. */
function isSame(a: DraftValue, b: DraftValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

export interface SettingsFormProps {
  schema: ResourceSchema;
}

/**
 * 설정 폼의 알맹이.
 *
 * ── 왜 훅으로 내놓는가 ─────────────────────────────────────────────
 * 조작줄(저장·기본값으로)을 카드 **머리말**에 올려야 하는 화면이 있다.
 * 다른 상세 화면들이 그렇게 생겼는데 이 화면만 조작줄이 본문 안에 있으면 따로 논다.
 * 컴포넌트가 카드까지 그려 버리면 그 자리를 밖에서 정할 수 없으므로,
 * 조작줄과 본문을 따로 돌려주고 «어디에 놓을지»는 쓰는 쪽이 정한다.
 */
export function useSettingsForm(schema: ResourceSchema): {
  action: ReactNode;
  /** 저장 위치 안내와 저장 직후 알림. 화면 맨 위에 한 번만 놓는다. */
  notice: ReactNode;
  /**
   * 고른 칸만 그린다. 키를 안 주면 스키마 순서대로 전부 그린다.
   * `readOnly` 면 값만 보여 준다 — 고치는 일은 창 안에서만 하게 할 때 쓴다.
   */
  fields: (keys?: readonly string[], options?: { readOnly?: boolean }) => ReactNode;
  /** 저장한다. 필수 칸이 비어 있으면 아무 일도 하지 않는다. */
  save: () => void;
  /** 고치던 것을 버리고 저장된 값으로 되돌린다. 창의 「취소」가 쓴다. */
  discard: () => void;
  /** 안내와 모든 칸을 한 덩어리로. 구역을 나누지 않는 화면이 쓴다. */
  body: ReactNode;
} {
  const { records, upsert, reset } = useResourceStore(schema);
  // 설정은 한 벌뿐이므로 언제나 첫 줄을 본다.
  const saved = records[0];

  const [draft, setDraft] = useState<Draft>(() => toDraft(schema.fields, saved));
  /** 저장 직후 잠깐 띄우는 확인 문구. 눌렀는데 아무 일도 없어 보이는 것을 막는다. */
  const [justSaved, setJustSaved] = useState(false);

  const changedKeys = useMemo(
    () =>
      schema.fields
        .filter((field) => !isSame(draft[field.key], toDraft(schema.fields, saved)[field.key]))
        .map((field) => field.key),
    [draft, saved, schema],
  );

  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    for (const field of schema.fields) {
      if (!field.required) continue;
      const value = draft[field.key];
      const isEmpty =
        value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (isEmpty) found[field.key] = '이 칸을 채워야 저장할 수 있습니다.';
    }
    return found;
  }, [draft, schema]);

  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const errorFor = (key: string) => (submitted || touched.has(key) ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    upsert({ ...draft, id: saved?.id ?? `${schema.id}_current` } as ResourceRecord);
    setJustSaved(true);
    setSubmitted(false);
    setTouched(new Set());
  };

  const revert = () => {
    reset();
    setDraft(toDraft(schema.fields, schema.seed[0]));
    setSubmitted(false);
    setTouched(new Set());
    setJustSaved(false);
  };

  const set = (field: ResourceField) => (value: DraftValue) => {
    setDraft((current) => ({ ...current, [field.key]: value }));
    setTouched((current) => new Set(current).add(field.key));
    setJustSaved(false);
  };

  const action: ReactNode = (
    <span className="flex flex-wrap items-center gap-xs">
      {/* 바뀐 것이 없을 때는 아무 말도 하지 않는다 — 알릴 일이 없다는 것이 곧 그 상태다. */}
      {changedKeys.length > 0 ? <Badge tone="accent">{changedKeys.length}개 바뀜</Badge> : null}
      <Button size="sm" variant="ghost" iconLeft={RotateCcw} onClick={revert}>
        기본값으로 되돌리기
      </Button>
      <Button size="sm" variant="accent" onClick={save}>
        저장
      </Button>
    </span>
  );

  /*
    저장 직후에만 한 줄 뜬다.
    «어디에 저장되는가»는 화면마다 적어 두지 않는다 — 어드민 전체가 같은 사정이고,
    같은 경고가 화면마다 붙으면 읽히지 않는 배경이 된다.
  */
  const notice: ReactNode = justSaved ? (
    <Callout tone="positive" icon={Check} size="sm" aria-live="polite">
      브라우저에 저장했습니다.
    </Callout>
  ) : null;

  const discard = () => {
    setDraft(toDraft(schema.fields, saved));
    setSubmitted(false);
    setTouched(new Set());
    setJustSaved(false);
  };

  const fields = (keys?: readonly string[], options?: { readOnly?: boolean }): ReactNode => (
    <>
        {/* 한 줄에 한 칸씩. 값마다 폭이 제각각이라 두 칸씩 붙이면 눈이 좌우로 튄다. */}
        <div className="grid gap-md">
          {(keys
            ? keys
                .map((key) => schema.fields.find((field) => field.key === key))
                .filter((field): field is ResourceField => field !== undefined)
            : schema.fields
          ).map((field) => {
            const span = '';
            // 기본값에서 벗어난 항목은 눈에 띄어야 «내가 뭘 건드렸는지» 되짚을 수 있다.
            const moved = changedKeys.includes(field.key);
            const hint = moved ? `${field.hint ?? ''} · 저장된 값과 다릅니다`.trim() : field.hint;

            if (field.kind === 'number') {
              return (
                <NumberField
                  key={field.key}
                  readOnly={options?.readOnly}
                  className={span}
                  label={field.label}
                  hint={hint}
                  required={field.required}
                  error={errorFor(field.key)}
                  unit={field.unit}
                  min={field.min}
                  max={field.max}
                  value={draft[field.key] as number | undefined}
                  onChange={set(field)}
                />
              );
            }

            if (field.kind === 'select') {
              return (
                <SelectInput
                  key={field.key}
                  readOnly={options?.readOnly}
                  className={span}
                  label={field.label}
                  hint={hint}
                  required={field.required}
                  error={errorFor(field.key)}
                  options={field.options ?? []}
                  placeholder={field.required === true ? '선택하세요' : '선택 안 함'}
                  value={(draft[field.key] as string) ?? ''}
                  onChange={set(field)}
                />
              );
            }

            if (field.kind === 'multiselect') {
              return (
                <MultiSelectField
                  key={field.key}
                  readOnly={options?.readOnly}
                  className={span}
                  label={field.label}
                  hint={hint}
                  required={field.required}
                  error={errorFor(field.key)}
                  options={field.options ?? []}
                  values={(draft[field.key] as string[]) ?? []}
                  onChange={set(field)}
                />
              );
            }

            if (field.kind === 'toggle') {
              return (
                <ToggleField
                  key={field.key}
                  readOnly={options?.readOnly}
                  className={span}
                  label={field.label}
                  hint={hint}
                  value={draft[field.key] === true}
                  onChange={set(field)}
                />
              );
            }

            if (field.variables !== undefined) {
              return (
                <TemplateField
                  key={field.key}
                  readOnly={options?.readOnly}
                  className={span}
                  label={field.label}
                  hint={hint}
                  required={field.required}
                  error={errorFor(field.key)}
                  placeholder={field.placeholder}
                  rows={field.rows}
                  variables={field.variables}
                  value={(draft[field.key] as string) ?? ''}
                  onChange={set(field)}
                />
              );
            }

            return (
              <TextField
                key={field.key}
                readOnly={options?.readOnly}
                className={span}
                label={field.label}
                hint={hint}
                required={field.required}
                error={errorFor(field.key)}
                placeholder={field.placeholder}
                multiline={field.kind === 'textarea'}
                rows={field.rows}
                value={(draft[field.key] as string) ?? ''}
                onChange={set(field)}
              />
            );
          })}
        </div>
    </>
  );

  const body: ReactNode = (
    <>
      {notice}
      <div className={justSaved ? 'mt-md' : ''}>{fields()}</div>
    </>
  );

  return { action, notice, fields, body, save, discard };
}

/** 카드 한 장으로 서는 설정 화면. 이 화면만 쓰는 곳이 대부분이다. */
export function SettingsForm({ schema }: SettingsFormProps) {
  const { action, body } = useSettingsForm(schema);

  return (
    <div className="flex flex-col gap-lg">
      <Panel title={schema.title} action={action}>
        {body}
      </Panel>
    </div>
  );
}
