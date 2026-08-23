'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  MultiSelectField,
  NumberField,
  Pagination,
  Panel,
  SearchField,
  SectionNav,
  SelectInput,
  Sheet,
  Tabs,
  TemplateField,
  TextField,
  ToggleField,
  Toolbar,
  useToast,
  type DataTableColumn,
} from '@namdo-prism/core/ui';
import { PARTICLES, endsWithFinalConsonant, withParticle } from '@namdo-prism/core/lib';
import { useResourceStore } from '@/state/resources';
import { useRecordRoute } from '@/state/recordRoute';
import { newIdFor, type ResourceField, type ResourceRecord, type ResourceSchema } from '@/config/resourceSchemas';

/**
 * 자료 관리 화면 틀 — 목록 · 조회 · 수정 · 삭제.
 *
 * ── 왜 화면마다 만들지 않는가 ──────────────────────────────────────
 * 어드민에는 «목록 보고 하나 고치는» 화면이 여럿이다. 각각 만들면 삭제 확인이
 * 어떤 화면에는 있고 어떤 화면에는 없는 식으로 갈린다. 여기서 한 번만 정한다.
 * 화면마다 다른 것은 «어떤 필드를 갖는가»뿐이므로 그것만 스키마로 받는다.
 *
 * ── 목록과 상세를 왜 나눴는가 ──────────────────────────────────────
 * 창 하나에 필드를 다 밀어 넣으면 값이 예닐곱만 넘어도 창이 화면을 덮는다.
 * 목록에서 줄을 누르면 **조회**로 열리고, 「수정」을 눌러야 고칠 수 있다.
 * 훑어보다 실수로 값을 바꾸는 일이 없고, 취소하면 통째로 없던 일이 된다.
 * 관광지·공식문서 화면이 이미 그렇게 생겼다 — 어드민 안에서 모양이 갈리지 않는다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 편집 중인 값. 필드마다 타입이 달라 좁은 유니온으로 받는다. */
type DraftValue = string | number | boolean | string[] | undefined;
type Draft = Record<string, DraftValue>;

/** 한 쪽에 두는 줄 수. */
const PAGE_SIZE = 10;

/** 상세를 나누는 구역. 필수인지 아닌지로 가른다 — 스키마가 알려 주는 유일한 구분이다. */
const SECTIONS = [
  { id: 'resource-required', label: '필수 정보' },
  { id: 'resource-optional', label: '세부 정보' },
] as const;

/** 저장된 값에서 편집용 사본을 뜬다. 스키마에 있는 칸만 담는다. */
function toDraft(schema: ResourceSchema, record: ResourceRecord): Draft {
  const draft: Draft = {};
  for (const field of schema.fields) draft[field.key] = record[field.key] as DraftValue;
  return draft;
}

/** 새 항목의 초기값. 필드 종류마다 «비어 있음»의 모양이 다르다. */
function emptyDraft(fields: readonly ResourceField[]): Draft {
  const draft: Draft = {};
  for (const field of fields) {
    if (field.kind === 'multiselect') draft[field.key] = [];
    else if (field.kind === 'toggle') draft[field.key] = field.defaultValue === true;
    else if (field.kind === 'number') draft[field.key] = field.defaultValue as number | undefined;
    else draft[field.key] = (field.defaultValue as string | undefined) ?? '';
  }
  return draft;
}

/** 표 한 칸을 그린다. 값의 모양이 종류마다 달라 여기서 한 번에 맞춘다. */
function renderCell(value: DraftValue, field: ResourceField) {
  if (field.kind === 'toggle') {
    return (
      <Badge size="sm" tone={value === true ? 'positive' : 'neutral'}>
        {value === true ? (field.onLabel ?? '사용') : (field.offLabel ?? '중지')}
      </Badge>
    );
  }

  if (field.kind === 'multiselect' && Array.isArray(value)) {
    if (value.length === 0) return <span className="text-content-subtle">—</span>;
    return (
      <span className="flex flex-wrap gap-2xs">
        {value.map((entry) => (
          <Badge key={entry} size="sm" tone="brand">
            {field.options?.find((option) => option.value === entry)?.label ?? entry}
          </Badge>
        ))}
      </span>
    );
  }

  if (field.kind === 'select') {
    const label = field.options?.find((option) => option.value === value)?.label;
    return label ?? <span className="text-content-subtle">—</span>;
  }

  if (value === undefined || value === '') return <span className="text-content-subtle">—</span>;
  return String(value);
}

export interface ResourceManagerProps {
  schema: ResourceSchema;
  /**
   * 상세에 덧붙일 탭.
   *
   * 자료마다 «그 항목에 딸린 다른 화면»이 있을 수 있다 — 권역이라면 그 권역을
   * 지나는 일정의 연계지수. 틀이 그것까지 알 수는 없으므로 그리는 일은 밖에서 받는다.
   * 안 주면 탭 없이 상세만 보인다.
   */
  extraTab?: {
    label: string;
    render: (record: ResourceRecord) => ReactNode;
  };
}

export function ResourceManager({ schema, extraTab }: ResourceManagerProps) {
  const { records, upsert, remove } = useResourceStore(schema);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  /** 체크한 줄. 여럿을 한 번에 지울 때 쓴다. */
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  /** 지금 무엇을 보고 있는지는 주소가 안다 — 새로고침해도, 링크로 받아도 같은 자리가 열린다. */
  const route = useRecordRoute();

  /**
   * 고치는 중인 초안.
   *
   * 있으면 「수정」, 없으면 「조회」다 — 목록에서 줄을 누르면 조회로 열리고,
   * 「수정」을 눌러야 초안이 생긴다. 열자마자 고칠 수 있으면 훑어보다 값을 바꾼다.
   * 초안을 주소에 담지 않는 이유는, 아직 저장하지 않은 값이라 남에게 건넬 것이 아니기 때문이다.
   */
  const [editing, setEditing] = useState<{ id: string; draft: Draft; isNew: boolean }>();
  /** 상세에서 보고 있는 탭. 덧붙인 탭이 없으면 쓰이지 않는다. */
  const [detailTab, setDetailTab] = useState('info');
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ResourceRecord>();

  /**
   * 사람이 손댄 칸.
   *
   * 새 양식을 열자마자 필수 칸마다 빨간 글씨가 깔리면, 아직 아무것도 하지 않은
   * 사람을 먼저 나무라는 꼴이 된다. 건드린 칸과 저장을 눌러 본 뒤에만 알린다.
   */
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const deleteTitle = pendingDelete === undefined ? '' : String(pendingDelete[schema.titleField]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return records;
    // 글자를 넣는 칸만 훑는다. 숫자·토글은 검색어로 찾을 대상이 아니다.
    const searchable = schema.fields.filter(
      (field) => field.kind === 'text' || field.kind === 'textarea',
    );
    return records.filter((record) =>
      searchable.some((field) =>
        String(record[field.key] ?? '')
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [records, query, schema]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // 검색으로 줄이 줄면 지금 쪽이 없어질 수 있다. 빈 표 대신 마지막 쪽으로 당긴다.
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isNew = editing?.isNew === true;
  const stored = records.find((record) => record.id === (editing?.id ?? route.recordId));
  // 조회일 때는 저장된 값을 그대로 읽는다. 초안은 「수정」을 눌러야 생긴다.
  const draft = editing?.draft ?? (stored === undefined ? undefined : toDraft(schema, stored));
  const viewing = editing === undefined && stored !== undefined;
  const isDirty =
    draft !== undefined && stored !== undefined && schema.fields.some((field) => {
      const before = stored[field.key] as DraftValue;
      const after = draft[field.key];
      return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
    });

  /*
    필수 칸이 비었는지. 비면 그 칸 아래에 문구를 띄운다.

    손으로 외워 두지 않는다 — 조회일 때 초안은 저장된 값에서 매번 새로 뜨므로
    외워 봐야 늘 다시 계산되고, 그 손동 기억 때문에 컴파일러가 이 컴포넌트를
    통째로 최적화에서 제외한다.
  */
  const errors: Record<string, string> = {};
  if (draft) {
    for (const field of schema.fields) {
      if (!field.required) continue;
      const value = draft[field.key];
      const isEmpty =
        value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (isEmpty) errors[field.key] = '이 칸을 채워야 저장할 수 있습니다.';
    }
  }

  const errorFor = (key: string) => (submitted || touched.has(key) ? errors[key] : undefined);

  const closeDetail = () => {
    setEditing(undefined);
    route.close();
    setTouched(new Set());
    setSubmitted(false);
  };

  /** 조회로 연다. 주소가 바뀌므로 뒤로가기로 목록에 돌아올 수 있다. */
  const openDetail = (record: ResourceRecord) => {
    route.open(record.id);
    setEditing(undefined);
    setDetailTab('info');
    setTouched(new Set());
    setSubmitted(false);
  };

  /** 고치기 시작한다. 조회로 열려 있든 목록에서 바로 눌렀든 같은 자리로 온다. */
  const startEdit = (record: ResourceRecord) => {
    route.open(record.id);
    setEditing({ id: record.id, draft: toDraft(schema, record), isNew: false });
    setDetailTab('info');
    setTouched(new Set());
    setSubmitted(false);
  };

  const set = (field: ResourceField) => (value: DraftValue) => {
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, [field.key]: value } } : current,
    );
    setTouched((current) => new Set(current).add(field.key));
  };

  const columns: DataTableColumn<ResourceRecord>[] = [
    {
      key: '__check',
      // 머리글은 비워 둔다. 여기 체크박스가 있으면 «전체 선택»으로 읽히는데,
      // 검색으로 가려진 줄까지 포함되는지 아닌지가 눈에 보이지 않아 헷갈린다.
      header: '',
      align: 'center',
      width: '3rem',
      cell: (row) => (
        <label className="flex items-center justify-center">
          <span className="sr-only-text">{String(row[schema.titleField])} 선택</span>
          <input
            type="checkbox"
            checked={checked.has(row.id)}
            onChange={() =>
              setChecked((current) => {
                const next = new Set(current);
                if (next.has(row.id)) next.delete(row.id);
                else next.add(row.id);
                return next;
              })
            }
            className="size-4 accent-brand"
          />
        </label>
      ),
    },
    {
      key: '__index',
      header: '순번',
      align: 'center',
      numeric: true,
      width: '4.5rem',
      // 검색·쪽 넘김을 거친 «지금 보이는 순서»다. 자료의 고유 번호가 아니다.
      cell: (_row, index) => (safePage - 1) * PAGE_SIZE + index + 1,
    },
    ...schema.fields
      .filter((field) => field.column !== undefined)
      .map((field, index) => ({
        key: field.key,
        header: field.column?.header ?? field.label,
        numeric: field.column?.numeric,
        align: field.column?.numeric === true ? ('right' as const) : undefined,
        width: field.column?.width,
        // 첫 칸이 이름이다. 스크린리더가 «지금 어느 줄인가»를 이름으로 알리게 한다.
        rowHeader: index === 0,
        cell: (row: ResourceRecord) => renderCell(row[field.key] as DraftValue, field),
      })),
    {
      key: '__manage',
      header: '관리',
      align: 'center' as const,
      width: '7rem',
      cell: (row: ResourceRecord) => (
        <span className="flex justify-center gap-2xs">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Pencil}
            aria-label={`${String(row[schema.titleField])} 수정`}
            onClick={() => startEdit(row)}
          />
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Trash2}
            aria-label={`${String(row[schema.titleField])} 삭제`}
            onClick={() => setPendingDelete(row)}
          />
        </span>
      ),
    },
  ];

  const title = String(draft?.[schema.titleField] ?? '').trim();
  const titleFilled = title.length > 0;

  /** 필수인 칸과 그렇지 않은 칸. 상세에서도 창에서도 이 순서로 읽는다. */
  const groups = [
    { section: SECTIONS[0], fields: schema.fields.filter((field) => field.required === true) },
    { section: SECTIONS[1], fields: schema.fields.filter((field) => field.required !== true) },
  ].filter((group) => group.fields.length > 0);

  const renderField = (field: ResourceField) => {
    /*
      `key` 는 여기 담지 않는다.
      `key` 가 든 객체를 `{...}` 로 펼치면 React 가 키로 인정하지 않고 경고한다.
      키는 각 컴포넌트에 직접 붙인다.
    */
    const shared = {
      label: field.label,
      hint: field.hint,
      required: field.required,
      error: errorFor(field.key),
      readOnly: viewing,
    };

    if (field.kind === 'number') {
      return (
        <NumberField
          key={field.key}
          {...shared}
          unit={field.unit}
          min={field.min}
          max={field.max}
          value={draft?.[field.key] as number | undefined}
          onChange={set(field)}
        />
      );
    }

    if (field.kind === 'select') {
      return (
        <SelectInput
          key={field.key}
          {...shared}
          options={field.options ?? []}
          placeholder={field.required === true ? '선택하세요' : '선택 안 함'}
          value={(draft?.[field.key] as string) ?? ''}
          onChange={set(field)}
        />
      );
    }

    if (field.kind === 'multiselect') {
      return (
        <MultiSelectField
          key={field.key}
          {...shared}
          options={field.options ?? []}
          values={(draft?.[field.key] as string[]) ?? []}
          onChange={set(field)}
        />
      );
    }

    if (field.kind === 'toggle') {
      return (
        <ToggleField
          key={field.key}
          label={field.label}
          hint={field.hint}
          readOnly={viewing}
          value={draft?.[field.key] === true}
          onChange={set(field)}
        />
      );
    }

    // 변수를 끼워 넣는 본문은 전용 편집칸을 쓴다. 손으로 적다 틀리는 것을 막는다.
    if (field.variables !== undefined) {
      return (
        <TemplateField
          key={field.key}
          {...shared}
          placeholder={field.placeholder}
          rows={field.rows}
          variables={field.variables}
          value={(draft?.[field.key] as string) ?? ''}
          onChange={set(field)}
        />
      );
    }

    return (
      <TextField
        key={field.key}
        {...shared}
        placeholder={field.placeholder}
        multiline={field.kind === 'textarea'}
        rows={field.rows}
        value={(draft?.[field.key] as string) ?? ''}
        onChange={set(field)}
      />
    );
  };

  const form = draft === undefined ? null : (
        <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
          {/* 구역이 하나뿐이면 목차가 가리킬 곳도 하나다. 자리만 차지하므로 두지 않는다. */}
          {groups.length > 1 ? (
            <aside className="lg:sticky lg:top-lg lg:self-start">
              <SectionNav label="상세 구성" items={groups.map((group) => group.section)} />
            </aside>
          ) : null}

          <div className="min-w-0">
            {groups.map((group, index) => (
              <div key={group.section.id}>
                {index === 0 ? null : (
                  <hr className="my-lg border-0 border-t border-line-subtle" />
                )}

                <section
                  id={group.section.id}
                  aria-labelledby={`${group.section.id}-title`}
                >
                  <h3
                    id={`${group.section.id}-title`}
                    className="text-subhead font-bold text-content"
                  >
                    {group.section.label}
                  </h3>
                  {/* 한 줄에 한 칸씩. 값마다 폭이 제각각이라 두 칸씩 붙이면 눈이 좌우로 튄다. */}
                  <div className="mt-md grid gap-md">{group.fields.map(renderField)}</div>
                </section>
              </div>
            ))}
          </div>
        </div>
  );

  /**
   * 등록을 창에서 받는 자료인가.
   *
   * 고치는 일은 언제나 상세 화면에서 한다 — 이미 있는 값을 곁들여 볼 것들과 함께 봐야 해서.
   * 창은 «처음 적어 넣는» 순간에만 뜬다.
   */
  const createInSheet = isNew && schema.createInSheet === true;

  /** 창을 닫으려 할 때. 적던 것이 있으면 한 번 묻는다 — 실수로 눌러 날리면 안 된다. */
  const requestClose = () => {
    if (touched.size > 0) setConfirmCancel(true);
    else closeDetail();
  };

  /* ── 상세 ─────────────────────────────────────────────────────── */
  if (draft && !createInSheet) {
    /*
      덧붙인 탭이 있으면 「정보」와 나란히 놓는다.
      값을 고치는 자리와 «그래서 어떤 결과가 나오는가»가 한 화면에 있어야,
      값을 바꾼 사람이 효과를 보려고 다른 메뉴를 찾아 들어가지 않는다.
    */
    const detail =
      extraTab && stored ? (
        <Tabs
          label={`${schema.singular} 상세`}
          value={detailTab}
          onChange={setDetailTab}
          items={[
            { id: 'info', label: '정보' },
            { id: 'extra', label: extraTab.label },
          ]}
        >
          <div className="pt-lg">
            {detailTab === 'info' ? form : extraTab.render(stored)}
          </div>
        </Tabs>
      ) : (
        form
      );

    return (
      <div className="flex flex-col gap-lg">
        <Panel
          title={titleFilled ? title : `새 ${schema.singular}`}
          action={
            <span className="flex flex-wrap items-center gap-xs">
              <Button
                size="sm"
                variant="quiet"
                iconLeft={ArrowLeft}
                onClick={() =>
                  viewing || !(isDirty || isNew) ? closeDetail() : setConfirmCancel(true)
                }
              >
                {viewing ? '목록으로' : '취소'}
              </Button>
              {viewing ? (
                <Button
                  size="sm"
                  variant="accent"
                  iconLeft={Pencil}
                  onClick={() => (stored ? startEdit(stored) : undefined)}
                >
                  수정
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="accent"
                  iconLeft={Check}
                  onClick={() => {
                    setSubmitted(true);
                    setConfirmSave(true);
                  }}
                >
                  {isNew ? '등록' : '저장'}
                </Button>
              )}
            </span>
          }
        >
          {detail}
        </Panel>

        <Sheet
          open={confirmSave}
          onClose={() => setConfirmSave(false)}
          placement="center"
          title={`${schema.singular} ${isNew ? '등록' : '저장'}`}
          footer={
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setConfirmSave(false)}>
                더 고치기
              </Button>
              <Button
                variant="accent"
                iconLeft={Check}
                disabled={Object.keys(errors).length > 0}
                onClick={() => {
                  upsert({ ...draft, id: editing?.id ?? newIdFor(schema.id) } as ResourceRecord);
                  setConfirmSave(false);
                  closeDetail();
                  toast(`${withParticle(title, '목적격')} ${isNew ? '등록' : '저장'}했습니다.`);
                }}
              >
                {isNew ? '등록' : '저장'}
              </Button>
            </span>
          }
        >
          <p className="text-body text-content-secondary">
            {Object.keys(errors).length > 0 ? (
              <>
                <strong className="text-critical">
                  채워야 할 칸이 {Object.keys(errors).length}개 있습니다.
                </strong>{' '}
                창을 닫고 빨간 글씨가 붙은 칸을 채워 주세요.
              </>
            ) : (
              <>저장하면 목록에 바로 반영됩니다.</>
            )}
          </p>
        </Sheet>

        <Sheet
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          placement="center"
          title={isNew ? '등록 취소' : '변경 취소'}
          description="고친 내용은 저장되지 않습니다."
          footer={
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setConfirmCancel(false)}>
                계속 고치기
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  setConfirmCancel(false);
                  closeDetail();
                  toast(isNew ? '등록을 취소했습니다.' : '고친 내용을 되돌렸습니다.', 'neutral');
                }}
              >
                {isNew ? '등록 취소' : '되돌리기'}
              </Button>
            </span>
          }
        >
          <p className="text-body text-content-secondary">
            {isNew
              ? `지금 만든 ${schema.singular}은(는) 목록에 남지 않습니다.`
              : '이 화면에서 고친 값이 저장 전 상태로 돌아갑니다.'}
          </p>
        </Sheet>
      </div>
    );
  }

  /* ── 목록 ─────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title={schema.title}
        action={
          <span className="flex flex-wrap items-center gap-xs">
            {checked.size > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                iconLeft={Trash2}
                onClick={() => setConfirmBulk(true)}
              >
                {checked.size}건 삭제
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="accent"
              iconLeft={Plus}
              onClick={() => {
                // 아직 넣지 않는다 — 취소하면 목록에 흔적이 남으면 안 된다.
                setEditing({
                  id: newIdFor(schema.id),
                  draft: emptyDraft(schema.fields),
                  isNew: true,
                });
                setTouched(new Set());
                setSubmitted(false);
              }}
            >
              {schema.singular} 등록
            </Button>
          </span>
        }
      >
        <Toolbar
          total={
            <>
              <span data-numeric="">{filtered.length}</span>건
            </>
          }
        >
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              // 3쪽을 보다 검색하면 결과의 3쪽이 아니라 처음부터 봐야 한다.
              setPage(1);
            }}
            placeholder={schema.searchPlaceholder}
          />
        </Toolbar>

        <DataTable
          className="mt-md"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => openDetail(row)}
        />
        <Pagination className="mt-md" page={safePage} pageCount={pageCount} onChange={setPage} />
      </Panel>

      <Sheet
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        placement="center"
        title={`고른 ${schema.singular} 삭제`}
        description="되돌릴 수 없습니다."
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setConfirmBulk(false)}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Trash2}
              onClick={() => {
                const count = checked.size;
                for (const id of checked) remove(id);
                setChecked(new Set());
                setConfirmBulk(false);
                toast(`${count}건을 삭제했습니다.`, 'neutral');
              }}
            >
              {checked.size}건 삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          고른 <strong className="text-content">{checked.size}건</strong>을 목록에서 지웁니다.
        </p>
      </Sheet>

      <Sheet
        open={pendingDelete !== undefined}
        onClose={() => setPendingDelete(undefined)}
        placement="center"
        title={`${schema.singular} 삭제`}
        description="되돌릴 수 없습니다."
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setPendingDelete(undefined)}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Trash2}
              onClick={() => {
                if (pendingDelete) remove(pendingDelete.id);
                setPendingDelete(undefined);
                toast(`${withParticle(deleteTitle, '목적격')} 삭제했습니다.`, 'neutral');
              }}
            >
              삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          <strong className="text-content">{deleteTitle}</strong>
          {PARTICLES.목적격[endsWithFinalConsonant(deleteTitle) ? 0 : 1]} 목록에서 지웁니다.
        </p>
      </Sheet>

      {/*
        등록 창.

        목록을 그대로 두고 그 위에 뜬다 — 적고 나면 방금 넣은 줄이 바로 눈에 들어온다.
        여기서는 「등록」이 곧 확인이라 확인 창을 한 번 더 띄우지 않는다.
        상세 화면과 달리 창은 이미 «지금 하는 일»을 가두고 있어, 한 번 더 물으면 두 번 묻는 꼴이다.
      */}
      <Sheet
        open={createInSheet}
        onClose={requestClose}
        placement="center"
        title={`${schema.singular} 등록`}
        description={schema.formDescription === '' ? undefined : schema.formDescription}
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={requestClose}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Check}
              onClick={() => {
                setSubmitted(true);
                // 빈 칸이 있으면 닫지 않는다 — 어느 칸이 비었는지 창 안에서 바로 보여야 한다.
                if (Object.keys(errors).length > 0) return;
                upsert({ ...draft, id: editing?.id ?? newIdFor(schema.id) } as ResourceRecord);
                closeDetail();
                toast(`${withParticle(title, '목적격')} 등록했습니다.`);
              }}
            >
              등록
            </Button>
          </span>
        }
      >
        <div className="flex flex-col gap-lg">
          {groups.map((group, index) => (
            <section key={group.section.id} aria-labelledby={`sheet-${group.section.id}`}>
              {/* 구역이 하나뿐이면 제목이 창 머리말과 겹친다. 그때는 칸만 보인다. */}
              {groups.length > 1 ? (
                <h3
                  id={`sheet-${group.section.id}`}
                  className={`text-subhead font-bold text-content ${index === 0 ? '' : 'mt-2xs'}`}
                >
                  {group.section.label}
                </h3>
              ) : null}
              <div className={`grid gap-md ${groups.length > 1 ? 'mt-md' : ''}`}>
                {group.fields.map(renderField)}
              </div>
            </section>
          ))}
        </div>
      </Sheet>

      {/* 창에서 적던 것을 버릴 때. 상세 화면의 「등록 취소」와 같은 물음이다. */}
      <Sheet
        open={createInSheet && confirmCancel}
        onClose={() => setConfirmCancel(false)}
        placement="center"
        title="등록 취소"
        description="적은 내용은 저장되지 않습니다."
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setConfirmCancel(false)}>
              계속 적기
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setConfirmCancel(false);
                closeDetail();
                toast('등록을 취소했습니다.', 'neutral');
              }}
            >
              등록 취소
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          지금 적은 {schema.singular}은(는) 목록에 남지 않습니다.
        </p>
      </Sheet>
    </div>
  );
}
