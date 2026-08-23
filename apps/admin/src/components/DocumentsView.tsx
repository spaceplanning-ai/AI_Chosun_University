'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { ATTRACTIONS, validateDataset } from '@namdo-prism/core/data';
import {
  DOCUMENT_FIELDS,
  DOCUMENT_FIELD_LABELS,
  ISSUER_TYPES,
  ISSUER_TYPE_LABELS,
  type DocumentField,
  type IssuerType,
  type OfficialDocument,
} from '@namdo-prism/core/domain';
import { PARTICLES, endsWithFinalConsonant, withParticle } from '@namdo-prism/core/lib';
import {
  Badge,
  Button,
  ChooserField,
  DataTable,
  FilterChips,
  Pagination,
  Panel,
  SearchField,
  SectionNav,
  SelectField,
  SelectInput,
  Sheet,
  TextField,
  Toolbar,
  useToast,
  type DataTableColumn,
} from '@namdo-prism/core/ui';
import { useDocumentEditor } from '@/state/documents';
import { useRecordRoute } from '@/state/recordRoute';

/**
 * 공식문서 관리 (3.1).
 *
 * 문서 목록을 그대로 보여 준다. 검색기가 여기서 근거를 찾으므로,
 * «어떤 기관의 자료가 몇 건이고 언제 갱신됐는가»가 곧 추천의 신뢰도가 된다.
 */

/** 한 쪽에 두는 줄 수. */
const PAGE_SIZE = 10;

/** 갱신일이 이보다 오래되면 신뢰도 감점 대상이다. */
const STALE_DAYS = 365;

/** 상세를 나누는 구역. 왼쪽 목차와 본문 제목이 같은 표를 본다. */
const DETAIL_SECTIONS = [
  { id: 'doc-basics', label: '필수 정보' },
  { id: 'doc-scope', label: '근거 범위' },
] as const;

const [DOC_BASICS, DOC_SCOPE] = DETAIL_SECTIONS;

/** 새 문서의 기본값. 비워 두면 검증에 걸리므로 화면이 곧바로 무엇을 채우라고 알린다. */
function emptyDocument(): OfficialDocument {
  return {
    id: `doc_${Math.random().toString(36).slice(2, 9)}`,
    title: '',
    issuer: '',
    issuerType: 'government',
    url: '',
    updatedAt: '',
    coversAttractionIds: [],
    fields: [],
    keywords: [],
    excerpt: '',
  };
}

type SortKey = 'updated' | 'title' | 'coverage';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated', label: '최신 갱신순' },
  { value: 'title', label: '문서명순' },
  { value: 'coverage', label: '근거 제공 많은순' },
];

/** 오늘 기준 며칠 지났는지. */
function daysSince(isoDate: string, today: Date): number {
  const diff = today.getTime() - new Date(isoDate).getTime();
  return Math.floor(diff / 86_400_000);
}

export function DocumentsView() {
  const { documents, update, add, remove } = useDocumentEditor();
  const toast = useToast();

  /** 상세에서 고치는 중인 문서. 「저장」을 눌러야 저장소로 나간다. */
  /**
   * 고치는 중인 초안.
   *
   * 있으면 「수정」, 없으면 「조회」다 — 목록에서 줄을 누르면 조회로 열리고,
   * 「수정」을 눌러야 초안이 생긴다. 열자마자 고칠 수 있으면 훑어보다 값을 바꾼다.
   * 어느 문서를 보고 있는지는 주소가 안다.
   */
  const [editing, setEditing] = useState<{
    id: string;
    draft: OfficialDocument;
    isNew: boolean;
  }>();
  const route = useRecordRoute();
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OfficialDocument>();
  /** 체크한 줄. 여럿을 한 번에 지울 때 쓴다. */
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const [query, setQuery] = useState('');
  /** 지금 보고 있는 쪽. 검색·필터를 바꾸면 처음으로 돌아간다. */
  const [page, setPage] = useState(1);
  const [issuerFilter, setIssuerFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('updated');

  const today = new Date();


  /** 조회로 연다. 주소가 바뀌므로 뒤로가기로 목록에 돌아올 수 있다. */
  const openDetail = (id: string) => {
    route.open(id);
    setEditing(undefined);
  };

  /** 고치기 시작한다. 초안은 저장된 값의 사본이라 취소하면 통째로 없던 일이 된다. */
  const startEdit = (id: string) => {
    const target = documents.find((document) => document.id === id);
    if (!target) return;
    route.open(id);
    setEditing({ id, draft: structuredClone(target), isNew: false });
  };

  const closeDetail = () => {
    setEditing(undefined);
    route.close();
  };

  const toggleOne = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const edit = (patch: Partial<OfficialDocument>) =>
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    );


  const chips = [
    { id: 'all', label: '전체', count: documents.length },
    ...(Object.keys(ISSUER_TYPE_LABELS) as IssuerType[]).map((type) => ({
      id: type,
      label: ISSUER_TYPE_LABELS[type],
      count: documents.filter((entry) => entry.issuerType === type).length,
    })),
  ];

  const filtered = documents.filter((document) => {
    if (issuerFilter !== 'all' && document.issuerType !== issuerFilter) return false;
    if (query.trim().length === 0) return true;
    const needle = query.trim().toLowerCase();
    return (
      document.title.toLowerCase().includes(needle) ||
      document.issuer.toLowerCase().includes(needle) ||
      document.keywords.some((keyword) => keyword.toLowerCase().includes(needle))
    );
  });

  // 원본 배열을 건드리지 않도록 복사한 뒤 정렬한다.
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'coverage') return b.coversAttractionIds.length - a.coversAttractionIds.length;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  /* 한 쪽에 열 줄. 마흔 건이 한 줄로 이어지면 표 아래에 있는 것이 화면 밖으로 밀린다. */
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // 검색으로 줄이 줄면 지금 쪽이 없어질 수 있다. 빈 표 대신 마지막 쪽으로 당긴다.
  const safePage = Math.min(page, pageCount);
  const rows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);


  const columns: DataTableColumn<OfficialDocument>[] = [
    {
      key: 'check',
      // 머리글은 비워 둔다. 여기 체크박스가 있으면 «전체 선택»으로 읽히는데,
      // 필터로 가려진 줄까지 포함되는지 아닌지가 눈에 보이지 않아 헷갈린다.
      header: '',
      align: 'center',
      width: '3rem',
      cell: (row) => (
        <label className="flex items-center justify-center">
          <span className="sr-only-text">{row.title} 선택</span>
          <input
            type="checkbox"
            checked={checked.has(row.id)}
            onChange={() => toggleOne(row.id)}
            className="size-4 accent-brand"
          />
        </label>
      ),
    },
    {
      key: 'index',
      header: '순번',
      align: 'center',
      numeric: true,
      width: '4.5rem',
      // 정렬·필터를 거친 «지금 보이는 순서»다. 자료의 고유 번호가 아니다.
      cell: (_row, index) => index + 1,
    },
    {
      key: 'title',
      header: '문서명',
      rowHeader: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-content">{row.title}</p>
          {/*
            요약문은 두 줄에서 끊는다.
            좁은 화면에서는 네 줄까지 접혀 한 행이 150px 가 되고, 41건이면 표를 훑을 수가 없다.
            여기서 요약문은 «무슨 문서인지» 가늠하는 보조 정보라 두 줄이면 충분하다 —
            전문은 오른쪽 원문 링크로 본다.
          */}
          <p className="mt-2xs line-clamp-2 text-micro text-content-muted" title={row.excerpt}>
            {row.excerpt}
          </p>
        </div>
      ),
    },
    {
      key: 'issuer',
      header: '출처기관',
      width: '13rem',
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-content-secondary">{row.issuer}</p>
          <Badge size="sm" tone="neutral" className="mt-2xs">
            {ISSUER_TYPE_LABELS[row.issuerType]}
          </Badge>
        </div>
      ),
    },
    {
      key: 'fields',
      header: '확인 항목',
      width: '14rem',
      cell: (row) => (
        <span className="flex flex-wrap gap-2xs">
          {row.fields.map((field) => (
            <Badge key={field} size="sm" tone="brand">
              {DOCUMENT_FIELD_LABELS[field]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'coverage',
      header: '근거 제공',
      align: 'right',
      numeric: true,
      width: '7rem',
      cell: (row) => `${row.coversAttractionIds.length}곳`,
    },
    {
      key: 'updated',
      header: '갱신일',
      align: 'right',
      numeric: true,
      width: '9rem',
      cell: (row) => {
        const age = daysSince(row.updatedAt, today);
        const isStale = age > STALE_DAYS;
        return (
          <span className={isStale ? 'text-critical' : 'text-content-secondary'}>
            {row.updatedAt}
            {isStale ? <span className="ml-2xs text-micro">{age}일 경과</span> : null}
          </span>
        );
      },
    },
    {
      key: 'url',
      header: '원문',
      align: 'center',
      width: '5rem',
      cell: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2xs text-brand"
          aria-label={`${row.title} 원문 열기`}
        >
          <ExternalLink className="size-[1.1em]" aria-hidden />
        </a>
      ),
    },
    {
      key: 'manage',
      header: '관리',
      align: 'center',
      width: '7rem',
      cell: (row) => (
        <span className="flex justify-center gap-2xs">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Pencil}
            aria-label={`${row.title} 수정`}
            onClick={() => startEdit(row.id)}
          />
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Trash2}
            aria-label={`${row.title} 삭제`}
            onClick={() => setPendingDelete(row)}
          />
        </span>
      ),
    },
  ];

  /* ── 상세 ─────────────────────────────────────────────────────── */
  const isNew = editing?.isNew === true;
  const stored = documents.find((entry) => entry.id === (editing?.id ?? route.recordId));
  // 조회일 때는 저장된 값을 그대로 읽는다. 초안은 「수정」을 눌러야 생긴다.
  const draft = editing?.draft ?? stored;
  const isDirty =
    editing !== undefined && stored !== undefined && JSON.stringify(editing.draft) !== JSON.stringify(stored);
  /** 조회 중인가. 이 값 하나로 모든 칸이 읽기 전용이 된다. */
  const viewing = editing === undefined && stored !== undefined;

  if (draft) {
    const titleFilled = draft.title.trim().length > 0;
    /* 이 문서에서 걸린 값. 저장 전에도 지금 값으로 검증해 보여 준다. */
    const draftIssues = validateDataset(
      ATTRACTIONS,
      documents.some((entry) => entry.id === draft.id)
        ? documents.map((entry) => (entry.id === draft.id ? draft : entry))
        : [draft, ...documents],
    ).filter((issue) => issue.scope === `공식문서 ${draft.id}`);

    return (
      <div className="flex flex-col gap-lg">
        <Panel
          title={titleFilled ? draft.title : '새 공식문서'}
          description={`${draft.issuer.length > 0 ? draft.issuer : '기관 미입력'} · 근거 제공 ${draft.coversAttractionIds.length}곳`}
          action={
            <span className="flex flex-wrap items-center gap-xs">
              <Button size="sm" variant="quiet" iconLeft={ArrowLeft} onClick={() => (viewing || !(isDirty || isNew) ? closeDetail() : setConfirmCancel(true))}>
                {viewing ? '목록으로' : '취소'}
              </Button>
              {viewing ? (
                <Button
                  size="sm"
                  variant="accent"
                  iconLeft={Pencil}
                  onClick={() => startEdit(stored?.id ?? '')}
                >
                  수정
                </Button>
              ) : (
                <Button size="sm" variant="accent" iconLeft={Check} onClick={() => setConfirmSave(true)}>
                  {isNew ? '등록' : '저장'}
                </Button>
              )}
            </span>
          }
        >
          <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-lg lg:self-start">
              <SectionNav label="상세 구성" items={DETAIL_SECTIONS} />
            </aside>

            <div className="min-w-0">
              <section id={DOC_BASICS.id} aria-labelledby={`${DOC_BASICS.id}-title`}>
                <h3 id={`${DOC_BASICS.id}-title`} className="text-subhead font-bold text-content">
                  {DOC_BASICS.label}
                </h3>

                <div className="mt-md grid gap-md">
                  <TextField
                    readOnly={viewing}
                    label="문서명"
                    required
                    value={draft.title}
                    onChange={(value) => edit({ title: value })}
                  />
                  <TextField
                    readOnly={viewing}
                    label="출처기관"
                    required
                    value={draft.issuer}
                    onChange={(value) => edit({ issuer: value })}
                  />
                  <SelectInput
                    readOnly={viewing}
                    label="기관유형"
                    required
                    options={ISSUER_TYPES.map((type) => ({
                      value: type,
                      label: ISSUER_TYPE_LABELS[type],
                    }))}
                    value={draft.issuerType}
                    onChange={(value) => edit({ issuerType: value as IssuerType })}
                  />
                  <TextField
                    readOnly={viewing}
                    label="원문 주소"
                    required
                    placeholder="https://"
                    value={draft.url}
                    onChange={(value) => edit({ url: value })}
                  />
                  <TextField
                    readOnly={viewing}
                    label="갱신일"
                    required
                    placeholder="2026-01-01"
                    value={draft.updatedAt}
                    onChange={(value) => edit({ updatedAt: value })}
                  />
                  <TextField
                    readOnly={viewing}
                    label="요약"
                    multiline
                    rows={3}
                    value={draft.excerpt}
                    onChange={(value) => edit({ excerpt: value })}
                  />
                </div>
              </section>

              <hr className="my-lg border-0 border-t border-line-subtle" />

              <section id={DOC_SCOPE.id} aria-labelledby={`${DOC_SCOPE.id}-title`}>
                <h3 id={`${DOC_SCOPE.id}-title`} className="text-subhead font-bold text-content">
                  {DOC_SCOPE.label}
                </h3>

                <div className="mt-md grid gap-md">
                  <ChooserField
                    readOnly={viewing}
                    label="확인 항목"
                    required
                    options={DOCUMENT_FIELDS.map((field) => ({
                      value: field,
                      label: DOCUMENT_FIELD_LABELS[field],
                    }))}
                    values={draft.fields}
                    onChange={(values) => edit({ fields: values as DocumentField[] })}
                  />
                  <ChooserField
                    readOnly={viewing}
                    label="근거를 제공하는 관광지"
                    options={ATTRACTIONS.map((attraction) => ({
                      value: attraction.id,
                      label: attraction.name,
                    }))}
                    values={draft.coversAttractionIds}
                    onChange={(values) => edit({ coversAttractionIds: values })}
                  />
                  <TextField
                    readOnly={viewing}
                    label="검색 키워드"
                    placeholder="관람시간, 휴관일"
                    value={draft.keywords.join(', ')}
                    onChange={(value) =>
                      edit({
                        keywords: value
                          .split(',')
                          .map((entry) => entry.trim())
                          .filter((entry) => entry.length > 0),
                      })
                    }
                  />
                </div>
              </section>
            </div>
          </div>
        </Panel>

        <Sheet
          open={confirmSave}
          onClose={() => setConfirmSave(false)}
          placement="center"
          title={isNew ? '공식문서 등록' : '변경 내용 저장'}
          description="저장하면 검색 근거와 신뢰도 계산에 바로 반영됩니다."
          footer={
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setConfirmSave(false)}>
                더 고치기
              </Button>
              <Button
                variant="accent"
                iconLeft={Check}
                disabled={!titleFilled}
                onClick={() => {
                  if (isNew) add(draft);
                  else update(draft.id, draft);
                  setConfirmSave(false);
                  closeDetail();
                  toast(`${withParticle(draft.title.trim(), '목적격')} ${isNew ? '등록' : '저장'}했습니다.`);
                }}
              >
                {isNew ? '등록' : '저장'}
              </Button>
            </span>
          }
        >
          <p className="text-body text-content-secondary">
            {!titleFilled ? (
              <>
                <strong className="text-critical">문서명이 비어 있습니다.</strong> 목록에서 다시 찾을
                수 없게 되므로 이름만은 채우고 등록해 주세요.
              </>
            ) : draftIssues.length > 0 ? (
              <>
                걸린 값이 <strong className="text-critical">{draftIssues.length}건</strong> 있습니다.
                지금 저장해도 되지만, 자료를 내려받으려면 결국 고쳐야 합니다.
              </>
            ) : (
              <>검증에 걸린 값이 없습니다. 그대로 저장해도 됩니다.</>
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
              ? '지금 만든 문서는 목록에 남지 않습니다.'
              : '이 화면에서 고친 값이 저장 전 상태로 돌아갑니다.'}
          </p>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title="공식문서"
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
                const created = emptyDocument();
                // 아직 넣지 않는다 — 취소하면 목록에 흔적이 남으면 안 된다.
                setEditing({ id: created.id, draft: created, isNew: true });
              }}
            >
              문서 등록
            </Button>
          </span>
        }
      >
        <FilterChips
          chips={chips}
          selected={issuerFilter}
          onSelect={(id) => {
            setIssuerFilter(id);
            setPage(1);
          }}
        />

        <Toolbar
          className="mt-sm"
          total={
            <>
              <span data-numeric="">{sorted.length}</span>건
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
            placeholder="문서명·기관·키워드 검색"
          />
          <SelectField
            label="정렬"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          />
        </Toolbar>

        <DataTable
          className="mt-md"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => openDetail(row.id)}
        />
        <Pagination className="mt-md" page={safePage} pageCount={pageCount} onChange={setPage} />
      </Panel>

      <Sheet
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        placement="center"
        title="고른 문서 삭제"
        description="근거를 대던 관광지는 그만큼 근거를 잃습니다."
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
        title="공식문서 삭제"
        description="이 문서를 근거로 삼던 관광지는 근거를 잃습니다."
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setPendingDelete(undefined)}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Trash2}
              onClick={() => {
                const target = pendingDelete;
                if (target) remove(target.id);
                setPendingDelete(undefined);
                if (target) toast(`${withParticle(target.title, '목적격')} 삭제했습니다.`, 'neutral');
              }}
            >
              삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          <strong className="text-content">{pendingDelete?.title}</strong>
          {pendingDelete ? PARTICLES.목적격[endsWithFinalConsonant(pendingDelete.title) ? 0 : 1] : ''}{' '}
          지웁니다. 이 문서가 근거를 대던 관광지가 {pendingDelete?.coversAttractionIds.length ?? 0}곳
          있습니다.
        </p>
      </Sheet>
    </div>
  );
}
