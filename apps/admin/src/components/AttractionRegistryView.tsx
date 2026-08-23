'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { OFFICIAL_DOCUMENTS, validateDataset } from '@namdo-prism/core/data';
import {
  PARTICLES,
  endsWithFinalConsonant,
  resolveDistrict,
  withParticle,
} from '@namdo-prism/core/lib';
import {
  ALL_DISTRICTS,
  ATTRACTION_FIELD_LABELS,
  INTERESTS,
  INTEREST_LABELS,
  REGION_LABELS,
  type Attraction,
  type Interest,
  type LabelledAttractionField,
} from '@namdo-prism/core/domain';
import {
  AddressField,
  Badge,
  Button,
  ChooserField,
  DataTable,
  FilterChips,
  NumberField,
  Panel,
  SelectInput,
  SectionNav,
  Sheet,
  TextField,
  TimeField,
  WeekdayField,
  type DataTableColumn,
} from '@namdo-prism/core/ui';
import { useToast } from '@namdo-prism/core/ui';
import { useAttractionEditor } from '@/state/attractions';
import { useRecordRoute } from '@/state/recordRoute';
import { useListControls } from '@/components/useListControls';

/**
 * 관광지 등록 (1.1).
 *
 * ── 왜 목록과 상세를 나눴는가 ──────────────────────────────────────
 * 관광지 하나가 가진 값이 스무 개가 넘는다. 목록 옆에 상세를 나란히 두면
 * 둘 다 좁아져 이름은 잘리고 슬라이더는 손이 안 닿는다.
 * 목록에서 고를 때는 «어느 것을 고를까»만, 상세에서는 «이 값을 어떻게 할까»만 본다.
 *
 * 고친 값은 「관리」 화면의 검증이 그대로 본다 — 자료는 한 곳(`state/attractions`)에 있다.
 */

/** 목록에서 보여 줄 값. 상세로 넘어가기 전에 «이게 맞나»를 가리는 데 필요한 것만 둔다. */
interface ListRow {
  id: string;
  name: string;
  district: string;
  region: string;
  categories: Interest[];
  stayMinutes: number;
  walkingLoad: number;
  /** 검증에 걸린 항목 수. 목록에서 바로 눈에 띄어야 고치러 들어간다. */
  issues: number;
}

/** 새로 넣을 때의 빈 값. 필수 항목은 사람이 채우게 비워 둔다. */
function emptyAttraction(): Attraction {
  return {
    id: `att_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    region: 'gwangju',
    district: '광주 동구',
    address: '',
    coordinates: { lat: 35.15, lng: 126.9 },
    categories: [],
    audiences: [],
    openingHours: { open: '09:00', close: '18:00' },
    closedDays: [],
    averageStayMinutes: 60,
    setting: 'indoor',
    walkingLoad: 30,
    familyScore: 50,
    seniorScore: 50,
    rainySuitability: 50,
    transitAccess: 50,
    costLevel: 30,
    adjacentIds: [],
    summary: '',
    highlight: '',
    motif: 'city',
  };
}

/**
 * 0–100 값들. 상세에서 한 묶음으로 다룬다.
 *
 * 이름은 검증 문구와 같은 표를 본다 — 「보행부담을 고치라」는 안내를 받고
 * 화면에서 그 칸을 못 찾는 일이 없도록.
 */
const SCORE_FIELDS = [
  { key: 'walkingLoad' },
  { key: 'familyScore' },
  { key: 'seniorScore' },
  { key: 'rainySuitability', hint: '비 오는 날 대안이 되는 정도' },
  { key: 'transitAccess' },
  { key: 'costLevel' },
] as const satisfies readonly { key: LabelledAttractionField; hint?: string }[];

/**
 * 상세를 나누는 구역.
 *
 * 왼쪽 목차와 본문 제목이 같은 표를 본다 — 따로 적어 두면 이름을 고칠 때
 * 한쪽만 바뀌어 목차가 없는 곳을 가리킨다.
 */
const DETAIL_SECTIONS = [
  { id: 'detail-basics', label: '필수 정보' },
  { id: 'detail-more', label: '세부 정보' },
  { id: 'detail-scores', label: '점수 항목' },
] as const;

const [BASICS, MORE, SCORES] = DETAIL_SECTIONS;

export function AttractionRegistryView() {
  const { attractions, update, add, remove } = useAttractionEditor();

  const toast = useToast();

  /**
   * 고치는 중인 초안.
   *
   * 있으면 「수정」, 없으면 「조회」다. 어느 관광지를 보고 있는지는 주소가 안다 —
   * 새로고침해도, 링크로 받아도 같은 자리가 열린다.
   * 초안까지 주소에 담지는 않는다. 아직 저장하지 않은 값이라 남에게 건넬 것이 아니다.
   */
  const [editing, setEditing] = useState<{
    id: string;
    draft: Attraction;
    isNew: boolean;
  }>();
  const route = useRecordRoute();
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [regionFilter, setRegionFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState<Attraction>();
  /** 체크한 줄. 여럿을 한 번에 지울 때 쓴다. */
  const [checked, setChecked] = useState<Set<string>>(new Set());
  /** 여러 건을 한꺼번에 지우기 전 확인. */
  const [confirmBulk, setConfirmBulk] = useState(false);

  const isNew = editing?.isNew === true;
  const stored = attractions.find((attraction) => attraction.id === (editing?.id ?? route.recordId));
  // 조회일 때는 저장된 값을 그대로 읽는다. 초안은 「수정」을 눌러야 생긴다.
  const draft = editing?.draft ?? stored;
  const open = draft;

  /** 조회로 연다. 주소가 바뀌므로 뒤로가기로 목록에 돌아올 수 있다. */
  const openDetail = (id: string) => {
    route.open(id);
    setEditing(undefined);
  };

  /** 고치기 시작한다. 저장된 값을 복사해 초안으로 삼는다. */
  const startEdit = (id: string) => {
    const target = attractions.find((attraction) => attraction.id === id);
    if (!target) return;
    route.open(id);
    setEditing({ id, draft: structuredClone(target), isNew: false });
  };

  /** 고친 것이 있는가. 아무것도 안 건드렸으면 나갈 때 묻지 않는다. */
  const isDirty =
    editing !== undefined &&
    stored !== undefined &&
    JSON.stringify(editing.draft) !== JSON.stringify(stored);
  /** 조회 중인가. 이 값 하나로 모든 칸이 읽기 전용이 된다. */
  const viewing = editing === undefined && stored !== undefined;

  /** 상세에서 값 하나를 고친다. 저장소가 아니라 초안을 건드린다. */
  const edit = (patch: Partial<Attraction>) =>
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    );

  const closeDetail = () => {
    setEditing(undefined);
    route.close();
  };

  /**
   * 이름 없이 등록하면 목록에서 빈 줄로만 보여 다시 찾기 어렵다.
   * 나머지 값은 나중에 채울 수 있으므로 이름 하나만 막는다.
   */
  const nameFilled = (draft?.name.trim().length ?? 0) > 0;

  /*
    검증은 초안을 반영한 목록으로 돌린다. 「관리」 화면과 같은 검증기를 쓰므로
    여기서 통과한 값이 저기서 걸리는 일이 없다.

    아직 등록하지 않은 새 관광지는 목록에 없으므로 앞에 붙여서 함께 본다 —
    저장하기 전에도 «지금 값이 통과하는가»를 보여 줘야 고치고 나서 저장할 수 있다.
    `scope` 는 「관광지 {id}」 형식이라 지금 보고 있는 곳의 문제만 골라낼 수 있다.
  */
  const issues = useMemo(() => {
    const target =
      draft === undefined
        ? attractions
        : attractions.some((attraction) => attraction.id === draft.id)
          ? attractions.map((attraction) => (attraction.id === draft.id ? draft : attraction))
          : [draft, ...attractions];
    return validateDataset(target, OFFICIAL_DOCUMENTS);
  }, [attractions, draft]);
  const openIssues =
    open === undefined
      ? []
      : issues.filter((issue) => issue.scope === `관광지 ${open.id}`);
  const issueCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      const id = issue.scope.startsWith('관광지 ') ? issue.scope.slice('관광지 '.length) : undefined;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [issues]);

  const filtered = attractions.filter(
    (attraction) => regionFilter === 'all' || attraction.region === regionFilter,
  );

  const list = useListControls<ListRow>({
    rows: filtered.map((attraction) => ({
      id: attraction.id,
      name: attraction.name,
      district: attraction.district,
      region: attraction.region,
      categories: attraction.categories,
      stayMinutes: attraction.averageStayMinutes,
      walkingLoad: attraction.walkingLoad,
      issues: issueCountById.get(attraction.id) ?? 0,
    })),
    searchIn: (row) => `${row.name} ${row.district}`,
    placeholder: '관광지명·시군구 검색',
    sorts: [
      { value: 'name', label: '이름순', compare: (a, b) => a.name.localeCompare(b.name) },
      { value: 'stay', label: '체류시간 긴순', compare: (a, b) => b.stayMinutes - a.stayMinutes },
      { value: 'walk', label: '보행부담 높은순', compare: (a, b) => b.walkingLoad - a.walkingLoad },
      { value: 'issues', label: '걸린 값 많은순', compare: (a, b) => b.issues - a.issues },
    ],
    unit: '곳',
  });

  const regionChips = [
    { id: 'all', label: '전체', count: attractions.length },
    ...(Object.keys(REGION_LABELS) as (keyof typeof REGION_LABELS)[]).map((region) => ({
      id: region,
      label: REGION_LABELS[region],
      count: attractions.filter((attraction) => attraction.region === region).length,
    })),
  ];

  const toggleOne = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns: DataTableColumn<ListRow>[] = [
    {
      key: 'check',
      // 머리글은 비워 둔다. 여기 체크박스가 있으면 «전체 선택»으로 읽히는데,
      // 필터로 가려진 줄까지 포함되는지 아닌지가 눈에 보이지 않아 헷갈린다.
      header: '',
      align: 'center',
      width: '3rem',
      cell: (row) => (
        <label className="flex items-center justify-center">
          <span className="sr-only-text">{row.name} 선택</span>
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
      key: 'name',
      header: '명칭',
      rowHeader: true,
      cell: (row) => (
        <span className="font-semibold text-content">
          {row.name.length > 0 ? row.name : '(이름 없음)'}
        </span>
      ),
    },
    { key: 'district', header: '소재지', width: '11rem', cell: (row) => row.district },
    {
      key: 'categories',
      header: '유형',
      cell: (row) => (
        <span className="flex flex-wrap gap-2xs">
          {row.categories.length === 0 ? (
            <span className="text-content-subtle">—</span>
          ) : (
            row.categories.map((category) => (
              <Badge key={category} size="sm" tone="brand">
                {INTEREST_LABELS[category]}
              </Badge>
            ))
          )}
        </span>
      ),
    },
    {
      key: 'stay',
      header: '평균 체류시간',
      align: 'right',
      numeric: true,
      width: '9rem',
      cell: (row) => `${row.stayMinutes}분`,
    },
    {
      key: 'walk',
      header: '보행부담',
      align: 'right',
      numeric: true,
      width: '7rem',
      cell: (row) => row.walkingLoad,
    },
    {
      key: 'issues',
      header: '검증',
      align: 'center',
      width: '6.5rem',
      cell: (row) =>
        row.issues === 0 ? (
          <span className="text-content-subtle">—</span>
        ) : (
          <Badge size="sm" tone="critical">
            {row.issues}건
          </Badge>
        ),
    },
    {
      key: 'manage',
      header: '관리',
      align: 'center',
      width: '6.5rem',
      cell: (row) => (
        <span className="flex justify-center gap-2xs">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Pencil}
            aria-label={`${row.name} 수정`}
            onClick={() => startEdit(row.id)}
          />
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Trash2}
            aria-label={`${row.name} 삭제`}
            onClick={() => {
              const target = attractions.find((attraction) => attraction.id === row.id);
              if (target) setPendingDelete(target);
            }}
          />
        </span>
      ),
    },
  ];

  /* ── 상세 ─────────────────────────────────────────────────────── */
  if (open) {
    return (
      <div className="flex flex-col gap-lg">
        <Panel
          title={open.name.length > 0 ? open.name : '새 관광지'}
          description={`${open.district} · ${open.address.length > 0 ? open.address : '주소 미입력'}`}
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
                  onClick={() =>
                    startEdit(stored?.id ?? '')
                  }
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
          {/*
            카드는 하나로 두고 안에서만 나눈다.
            카드를 쪼개면 「저장」 버튼이 첫 카드에만 붙어, 아래 카드를 고치던 사람이
            버튼을 찾아 위로 되돌아가야 한다.
          */}
          <div className="grid gap-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-lg lg:self-start">
              <SectionNav label="상세 구성" items={DETAIL_SECTIONS} />
            </aside>

            <div className="min-w-0">
              <section id={BASICS.id} aria-labelledby={`${BASICS.id}-title`}>
                <h3 id={`${BASICS.id}-title`} className="text-subhead font-bold text-content">
                  {BASICS.label}
                </h3>

                {/* 한 줄에 한 칸씩. 값마다 폭이 제각각이라 두 칸씩 붙이면 눈이 좌우로 튄다. */}
                <div className="mt-md grid gap-md">
                  <TextField
                    readOnly={viewing}
                    label="관광지명"
                    required
                    value={open.name}
                    onChange={(value) => edit({ name: value })}
                  />
                  {/*
                    소재지는 골라서만 넣는다.
                    손으로 치면 「전남 담양군」과 「전남 담양」이 섞이는데, 형식은 둘 다
                    멀쩡해서 검증에 안 걸린 채로 지역 분포와 구역에서 조용히 빠진다.
                    지역도 같이 맞춘다 — 같은 것을 두 번 적게 하면 결국 둘이 어긋난다.
                  */}
                  <SelectInput
                    readOnly={viewing}
                    label="소재지"
                    required
                    placeholder="고르세요"
                    options={ALL_DISTRICTS.map((entry) => ({
                      value: entry.label,
                      label: entry.label,
                    }))}
                    value={open.district}
                    onChange={(value) => {
                      const entry = ALL_DISTRICTS.find((candidate) => candidate.label === value);
                      edit(entry ? { district: entry.label, region: entry.region } : { district: value });
                    }}
                  />
                  <AddressField
                    readOnly={viewing}
                    label="주소"
                    value={open.address}
                    onChange={(value) => edit({ address: value })}
                    onSelect={(result) => {
                      /*
                        주소를 고르면 소재지와 지역도 함께 맞춘다 —
                        같은 곳을 두 번 적게 하면 결국 둘이 어긋난다.
                        광주·전남 밖이면 건드리지 않는다. 사업 범위 밖이라 고를 값이 없다.
                      */
                      const resolved = resolveDistrict(result);
                      if (resolved) edit({ district: resolved.district, region: resolved.region });
                    }}
                  />
                  <TextField
                    readOnly={viewing}
                    label="한 줄 특징"
                    value={open.highlight}
                    onChange={(value) => edit({ highlight: value })}
                  />
                  <TextField
                    readOnly={viewing}
                    label="설명"
                    multiline
                    rows={3}
                    value={open.summary}
                    onChange={(value) => edit({ summary: value })}
                  />
                </div>
              </section>

              <hr className="my-lg border-0 border-t border-line-subtle" />

              <section id={MORE.id} aria-labelledby={`${MORE.id}-title`}>
                <h3 id={`${MORE.id}-title`} className="text-subhead font-bold text-content">
                  {MORE.label}
                </h3>

                <div className="mt-md grid gap-md">
                  <SelectInput
                    readOnly={viewing}
                    label="지역"
                    required
                    options={(Object.keys(REGION_LABELS) as (keyof typeof REGION_LABELS)[]).map(
                      (region) => ({ value: region, label: REGION_LABELS[region] }),
                    )}
                    value={open.region}
                    onChange={(value) => edit({ region: value as Attraction['region'] })}
                  />
                  <SelectInput
                    readOnly={viewing}
                    label="실내외"
                    required
                    options={[
                      { value: 'indoor', label: '실내' },
                      { value: 'outdoor', label: '실외' },
                      { value: 'mixed', label: '실내·실외' },
                    ]}
                    value={open.setting}
                    onChange={(value) => edit({ setting: value as Attraction['setting'] })}
                  />

                  <ChooserField
                    readOnly={viewing}
                    label="관광유형"
                    required
                    options={INTERESTS.map((interest) => ({
                      value: interest,
                      label: INTEREST_LABELS[interest],
                    }))}
                    values={open.categories}
                    onChange={(values) => edit({ categories: values as Interest[] })}
                  />

                  {/*
                    운영시간은 여는 시각과 닫는 시각 두 값이다. 한 칸에 몰아넣으면 다시 쪼개야 한다.
                    다만 둘은 늘 같이 보고 같이 고치므로 한 줄에 나란히 둔다.
                  */}
                  <div className="grid gap-md sm:grid-cols-2">
                    <TimeField
                      readOnly={viewing}
                      label="여는 시각"
                      value={open.openingHours.open}
                      onChange={(value) => edit({ openingHours: { ...open.openingHours, open: value } })}
                    />
                    <TimeField
                      readOnly={viewing}
                      label="닫는 시각"
                      value={open.openingHours.close}
                      onChange={(value) =>
                        edit({ openingHours: { ...open.openingHours, close: value } })
                      }
                    />
                  </div>
                  <WeekdayField
                    readOnly={viewing}
                    label="휴무일"
                    values={open.closedDays}
                    onChange={(values) => edit({ closedDays: values })}
                  />

                  <NumberField
                    readOnly={viewing}
                    label="평균 체류시간"
                    unit="분"
                    min={0}
                    value={open.averageStayMinutes}
                    onChange={(value) => edit({ averageStayMinutes: value ?? 0 })}
                  />
                </div>

              </section>

              <hr className="my-lg border-0 border-t border-line-subtle" />

              <section id={SCORES.id} aria-labelledby={`${SCORES.id}-title`}>
                <h3 id={`${SCORES.id}-title`} className="text-subhead font-bold text-content">
                  {SCORES.label}
                </h3>

                <div className="mt-md grid gap-md">
                  {SCORE_FIELDS.map((field) => (
                    <NumberField
                      key={field.key}
                      readOnly={viewing}
                      label={ATTRACTION_FIELD_LABELS[field.key]}
                      hint={'hint' in field ? field.hint : undefined}
                      min={0}
                      max={100}
                      value={open[field.key]}
                      onChange={(value) => edit({ [field.key]: value ?? 0 })}
                    />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </Panel>

        <Sheet
          open={confirmSave}
          onClose={() => setConfirmSave(false)}
          title={isNew ? '관광지 등록' : '변경 내용 저장'}
          description="저장하면 「관리」의 검증과 분포에 바로 반영됩니다."
          footer={
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setConfirmSave(false)}>
                더 고치기
              </Button>
              <Button
                variant="accent"
                iconLeft={Check}
                disabled={!nameFilled}
                onClick={() => {
                  if (!draft) return;
                  if (isNew) add(draft);
                  else update(draft.id, draft);
                  setConfirmSave(false);
                  closeDetail();
                  toast(`${withParticle(draft.name.trim(), '목적격')} ${isNew ? '등록' : '저장'}했습니다.`);
                }}
              >
                {isNew ? '등록' : '저장'}
              </Button>
            </span>
          }
        >
          <p className="text-body text-content-secondary">
            {!nameFilled ? (
              <>
                <strong className="text-critical">관광지명이 비어 있습니다.</strong> 목록에서 다시
                찾을 수 없게 되므로 이름만은 채우고 등록해 주세요.
              </>
            ) : openIssues.length > 0 ? (
              <>
                걸린 값이 <strong className="text-critical">{openIssues.length}건</strong> 있습니다.
                지금 등록해도 되지만, 「관리」에서 자료를 내려받으려면 결국 고쳐야 합니다.
              </>
            ) : (
              <>검증에 걸린 값이 없습니다. 그대로 저장해도 됩니다.</>
            )}
          </p>
        </Sheet>

        <Sheet
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
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
              ? '지금 만든 관광지는 목록에 남지 않습니다.'
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
        title="관광지 목록"
        action={
          <Button
            size="sm"
            variant="accent"
            iconLeft={Plus}
            onClick={() => {
              const created = emptyAttraction();
              // 아직 넣지 않는다 — 취소하면 목록에 흔적이 남으면 안 된다.
              setEditing({ id: created.id, draft: created, isNew: true });
            }}
          >
            관광지 등록
          </Button>
        }
      >
        {/* 저장 위치 안내는 「관리」가 맡는다 — 내려받기 버튼이 그 화면에 있다. */}
        <FilterChips chips={regionChips} selected={regionFilter} onSelect={setRegionFilter} />

        {/*
          고른 줄이 있을 때만 나온다. 늘 보이면 «지금 무엇이 골라져 있나»가 흐려지고,
          아무것도 안 골랐는데 누를 수 있는 삭제 버튼이 화면에 남는다.
        */}
        {checked.size > 0 ? (
          <div className="mt-sm flex flex-wrap items-center gap-sm rounded-card bg-brand-soft px-md py-sm">
            <span className="text-caption font-semibold text-brand-text">
              <span data-numeric="">{checked.size}</span>곳 선택함
            </span>
            <Button size="sm" variant="quiet" onClick={() => setChecked(new Set())}>
              선택 해제
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto"
              iconLeft={Trash2}
              onClick={() => setConfirmBulk(true)}
            >
              선택 삭제
            </Button>
          </div>
        ) : null}
        <div className="mt-sm">{list.node}</div>

        <DataTable
          className="mt-md"
          columns={columns}
          rows={list.rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => openDetail(row.id)}
        />
        {list.pager}
      </Panel>

      <Sheet
        open={pendingDelete !== undefined}
        onClose={() => setPendingDelete(undefined)}
        title="관광지 삭제"
        description="되돌릴 수 없습니다. 「관리」에서 초기 자료로 되돌리면 전체가 함께 되돌아갑니다."
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setPendingDelete(undefined)}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Trash2}
              onClick={() => {
                const name = pendingDelete?.name;
                if (pendingDelete) remove(pendingDelete.id);
                setPendingDelete(undefined);
                toast(`${withParticle(name ?? '', '목적격')} 삭제했습니다.`, 'neutral');
              }}
            >
              삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          <strong className="text-content">{pendingDelete?.name}</strong>
          {pendingDelete ? PARTICLES.목적격[endsWithFinalConsonant(pendingDelete.name) ? 0 : 1] : ''} 목록에서
          지웁니다.
        </p>
      </Sheet>

      <Sheet
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title="선택한 관광지 삭제"
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
                toast(`${count}곳을 삭제했습니다.`, 'neutral');
              }}
            >
              {checked.size}곳 삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          고른 <strong className="text-content">{checked.size}곳</strong> 을 목록에서 지웁니다.
          이 관광지를 근거로 삼던 공식문서가 있으면 「관리」의 검증에서 걸립니다.
        </p>
      </Sheet>
    </div>
  );
}
