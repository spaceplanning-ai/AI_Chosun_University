'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { OFFICIAL_DOCUMENTS, validateDataset } from '@namdo-prism/core/data';
import {
  DISTRICTS_BY_REGION,
  INTERESTS,
  INTEREST_LABELS,
  REGION_LABELS,
  districtLabel,
} from '@namdo-prism/core/domain';
import type { Attraction, Region } from '@namdo-prism/core/domain';
import { withParticle } from '@namdo-prism/core/lib';
import {
  BarList,
  Badge,
  Button,
  Callout,
  DataTable,
  FilterChips,
  Panel,
  SectionNav,
  SelectInput,
  Sheet,
  Tabs,
  useToast,
  type DataTableColumn,
} from '@namdo-prism/core/ui';
import { useAttractionEditor } from '@/state/attractions';
import { districtId, useCoveredDistricts, type CoveredDistrict } from '@/state/districts';
import { useRecordRoute } from '@/state/recordRoute';
import { useListControls } from './useListControls';

/**
 * 관광지 관리 (1.2).
 *
 * 「등록」이 한 곳을 고치는 자리라면, 여기는 **전체가 쓸 만한 상태인가**를 보는 자리다.
 * 값이 빠졌는지(검증), 자원이 한쪽에 쏠렸는지(분포), 그리고 고친 것을 저장소로 꺼내는 일.
 *
 * 검증은 「등록」에서 고친 값을 그대로 본다 — 자료가 한 곳에 있기 때문이다.
 */

/** 체류시간을 묶는 구간. 하루 일정을 짜려면 길이가 고르게 있어야 한다. */
const STAY_BUCKETS = [
  { label: '60분 미만', test: (minutes: number) => minutes < 60 },
  { label: '60–89분', test: (minutes: number) => minutes >= 60 && minutes < 90 },
  { label: '90–119분', test: (minutes: number) => minutes >= 90 && minutes < 120 },
  { label: '120분 이상', test: (minutes: number) => minutes >= 120 },
];

/**
 * 관광유형 분포.
 *
 * 전체에서도 쓰고 구역 하나에서도 쓴다 — 한 함수로 두어야 «전체는 이 기준,
 * 구역은 저 기준»으로 갈리지 않는다. 자원이 없는 유형도 0 으로 남겨 둔다.
 * 빠뜨린 유형이 목록에서 사라지면 «없다»는 사실 자체가 안 보인다.
 */
function interestBarsOf(list: readonly Attraction[]) {
  const counts = new Map<string, number>();
  for (const attraction of list) {
    for (const category of attraction.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return INTERESTS.map((interest) => ({
    key: interest,
    label: INTEREST_LABELS[interest],
    value: counts.get(interest) ?? 0,
    unit: '곳',
  })).sort((a, b) => b.value - a.value);
}

/** 체류시간 분포. 구간은 고정이라 «없는 구간»도 0 으로 자리를 지킨다. */
function stayBarsOf(list: readonly Attraction[]) {
  return STAY_BUCKETS.map((bucket) => ({
    key: bucket.label,
    label: bucket.label,
    value: list.filter((attraction) => bucket.test(attraction.averageStayMinutes)).length,
    unit: '곳',
  }));
}

/** 구역 상세의 검증 탭에 붙는 한 줄. 어느 관광지에서 걸렸는지까지 보여 준다. */
interface ZoneIssueRow {
  key: string;
  name: string;
  severity: 'error' | 'warning';
  message: string;
}

const ZONE_ISSUE_COLUMNS: DataTableColumn<ZoneIssueRow>[] = [
  { key: 'name', header: '관광지', rowHeader: true, cell: (row) => row.name },
  { key: 'message', header: '내용', cell: (row) => row.message },
  {
    key: 'severity',
    header: '등급',
    align: 'center',
    width: '7rem',
    cell: (row) => (
      <Badge size="sm" tone={row.severity === 'error' ? 'critical' : 'caution'}>
        {row.severity === 'error' ? '오류' : '경고'}
      </Badge>
    ),
  },
];

/** 구역 상세에 붙는 관광지 표. 고치는 자리가 아니라 «무엇이 딸려 있나»를 보는 자리다. */
const ZONE_ATTRACTION_COLUMNS: DataTableColumn<Attraction>[] = [
  { key: 'name', header: '명칭', rowHeader: true, cell: (row) => row.name },
  {
    key: 'categories',
    header: '유형',
    cell: (row) => (
      <span className="flex flex-wrap gap-2xs">
        {row.categories.map((category) => (
          <Badge key={category} size="sm" tone="brand">
            {INTEREST_LABELS[category]}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    key: 'stay',
    header: '평균 체류시간',
    align: 'right',
    width: '9rem',
    cell: (row) => `${row.averageStayMinutes}분`,
  },
];

/** 취급 시·군·구 표의 한 줄. 「등록 관광지」는 이 소재지를 쓰는 관광지 수다. */
interface DistrictRow extends CoveredDistrict {
  count: number;
}

export function AttractionManageView() {
  const { attractions, update: updateAttraction } = useAttractionEditor();
  const { districts, add: addDistrict, remove: removeDistrict } = useCoveredDistricts();
  const toast = useToast();

  /** 시·군·구를 새로 넣는 창. 열려 있으면 고르는 중이다. */
  const [adding, setAdding] = useState(false);
  const [draftRegion, setDraftRegion] = useState<Region>('jeonnam');
  const [draftCity, setDraftCity] = useState('');
  const [pendingDistrict, setPendingDistrict] = useState<DistrictRow>();
  /** 위쪽 탭에서 고른 지역. 「전체」면 거르지 않는다. */
  const [regionTab, setRegionTab] = useState('all');
  /** 체크한 줄. 여럿을 한 번에 뺄 때 쓴다. */
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  /**
   * 상세에서 고치는 중인 구역.
   *
   * `original` 은 열 때의 소재지 표기다. 이름을 고치면 관광지가 들고 있는
   * 소재지도 함께 옮겨야 하는데, 무엇을 옮길지는 «고치기 전 이름»으로만 알 수 있다.
   */
  const [editingZone, setEditingZone] = useState<{
    original: string;
    region: Region;
    city: string;
  }>();
  /** 어느 구역을 보고 있는지는 주소가 안다 — 새로고침해도, 링크로 받아도 같은 자리가 열린다. */
  const route = useRecordRoute();
  /** 구역 상세에서 보고 있는 갈래. 구역을 열 때마다 「정보」로 돌아온다. */
  const [zoneTab, setZoneTab] = useState('info');
  const [confirmZoneSave, setConfirmZoneSave] = useState(false);
  const [confirmZoneCancel, setConfirmZoneCancel] = useState(false);

  const covered = useMemo(() => new Set(districts.map((entry) => entry.id)), [districts]);

  /*
    아직 안 넣은 시·군·구만 고르게 한다.
    이미 있는 곳을 다시 고르게 두면 「이미 있습니다」를 눌러 본 뒤에야 알게 된다.
  */
  const addableCities = DISTRICTS_BY_REGION[draftRegion].filter(
    (city) => !covered.has(districtLabel(draftRegion, city)),
  );

  /*
    취급 목록에 없는 소재지를 쓰는 관광지.
    「전남 담양군」을 「전남 담양」으로 잘못 쳐도 형식은 멀쩡하므로 검증기가 못 잡는다.
    다루기로 한 곳을 적어 두면 그때 비로소 드러난다.
  */
  const outsiders = useMemo(
    () => attractions.filter((attraction) => !covered.has(attraction.district)),
    [attractions, covered],
  );

  const districtRows: DistrictRow[] = useMemo(
    () =>
      districts.map((entry) => ({
        ...entry,
        count: attractions.filter((attraction) => attraction.district === entry.id).length,
      })),
    [districts, attractions],
  );

  /** 탭에 붙는 건수. 고르기 전에 어느 쪽이 몇 곳인지 보인다. */
  const regionTabs = [
    { id: 'all', label: '전체', count: districtRows.length },
    ...(Object.keys(REGION_LABELS) as Region[]).map((region) => ({
      id: region,
      label: REGION_LABELS[region],
      count: districtRows.filter((row) => row.region === region).length,
    })),
  ];

  const districtList = useListControls<DistrictRow>({
    rows: districtRows.filter((row) => regionTab === 'all' || row.region === regionTab),
    searchIn: (row) => `${row.id} ${row.city}`,
    placeholder: '시·군·구 검색',
    unit: '곳',
    // 한 쪽에 열 줄. 화면을 채우지 않으면서도 훑기에 충분한 양이다.
    pageSize: 10,
    sorts: [
      { value: 'name', label: '이름순', compare: (a, b) => a.id.localeCompare(b.id, 'ko') },
      { value: 'count', label: '관광지 많은순', compare: (a, b) => b.count - a.count },
      { value: 'empty', label: '관광지 없는순', compare: (a, b) => a.count - b.count },
    ],
  });

  const toggleChecked = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const DISTRICT_COLUMNS: DataTableColumn<DistrictRow>[] = [
    {
      key: 'check',
      header: '',
      align: 'center',
      width: '3rem',
      cell: (row) => (
        <input
          type="checkbox"
          className="size-[1.05em] accent-[var(--color-accent)]"
          checked={checked.has(row.id)}
          onChange={() => toggleChecked(row.id)}
          aria-label={`${row.id} 선택`}
        />
      ),
    },
    {
      key: 'index',
      header: '순번',
      align: 'center',
      width: '4rem',
      cell: (_row, index) => index + 1,
    },
    { key: 'region', header: '지역', width: '6rem', cell: (row) => REGION_LABELS[row.region] },
    { key: 'city', header: '시·군·구', rowHeader: true, cell: (row) => row.city },
    {
      key: 'count',
      header: '등록 관광지',
      align: 'right',
      width: '8rem',
      cell: (row) =>
        row.count === 0 ? (
          <span className="text-content-subtle">없음</span>
        ) : (
          `${row.count}곳`
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
            aria-label={`${row.id} 수정`}
            onClick={() => {
              route.open(row.id);
              setEditingZone({ original: row.id, region: row.region, city: row.city });
              setZoneTab('info');
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={Trash2}
            aria-label={`${row.id} 삭제`}
            onClick={() => setPendingDistrict(row)}
          />
        </span>
      ),
    },
  ];

  const issues = useMemo(
    () => validateDataset(attractions, OFFICIAL_DOCUMENTS),
    [attractions],
  );



  /*
    ── 구역 상세 ───────────────────────────────────────────────────
    고치는 중이면 초안을, 아니면 주소가 가리키는 구역을 그대로 읽는다.
    초안이 없으면 조회다 — 훑어보다 실수로 값을 바꾸는 일이 없다.
  */
  const storedZone = districtRows.find((row) => row.id === route.recordId);
  const zone =
    editingZone ??
    (storedZone === undefined
      ? undefined
      : { original: storedZone.id, region: storedZone.region, city: storedZone.city });

  if (zone) {
    const editingZoneNow = editingZone;
    const nextId = districtId(zone.region, zone.city);
    const renamed = nextId !== zone.original;
    /* 이 구역에 속한 관광지. 이름을 고치면 이들의 소재지도 함께 옮긴다. */
    const inZone = attractions.filter((attraction) => attraction.district === zone.original);
    const nameFilled = zone.city.trim().length > 0;

    /*
      이 구역 관광지들의 검증 결과.
      검증기는 「관광지 {id}」 형식으로 어디서 걸렸는지 적어 두므로,
      이 구역에 속한 관광지의 id 로 골라내면 구역 단위로 볼 수 있다.
    */
    const zoneIssues: ZoneIssueRow[] = inZone.flatMap((attraction) =>
      issues
        .filter((issue) => issue.scope === `관광지 ${attraction.id}`)
        .map((issue, index) => ({
          key: `${attraction.id}_${index}`,
          name: attraction.name,
          severity: issue.severity,
          message: issue.message,
        })),
    );
    const zoneErrors = zoneIssues.filter((issue) => issue.severity === 'error');

    /* 구역 하나만 놓고 본 분포. 전체와 같은 함수를 쓴다. */
    const zoneInterestBars = interestBarsOf(inZone);
    const zoneStayBars = stayBarsOf(inZone);

    /** 왼쪽 목차에 세울 구역. 본문에 실제로 그려진 것만 넣는다. */
    const zoneSections =
      zoneTab === 'info'
        ? [
            { id: 'zone-basics', label: '구역 정보' },
            { id: 'zone-places', label: '이 구역의 관광지' },
          ]
        : [
            { id: 'zone-check', label: '검증 결과' },
            { id: 'zone-interest', label: '관광유형 분포' },
            { id: 'zone-stay', label: '체류시간 분포' },
          ];
    const collides = renamed && districts.some((entry) => entry.id === nextId);
    const closeZone = () => {
      setEditingZone(undefined);
      route.close();
    };
    /** 조회 중인가. 이 값 하나로 모든 칸이 읽기 전용이 된다. */
    const viewingZone = editingZoneNow === undefined;

    return (
      <div className="flex flex-col gap-lg">
        <Panel
          title={zone.original}
          description={`이 구역의 관광지 ${inZone.length}곳`}
          action={
            <span className="flex flex-wrap items-center gap-xs">
              <Button
                size="sm"
                variant="quiet"
                iconLeft={ArrowLeft}
                onClick={() => (viewingZone || !renamed ? closeZone() : setConfirmZoneCancel(true))}
              >
                {viewingZone ? '목록으로' : '취소'}
              </Button>
              {viewingZone ? (
                <Button
                  size="sm"
                  variant="accent"
                  iconLeft={Pencil}
                  onClick={() =>
                    setEditingZone({ original: zone.original, region: zone.region, city: zone.city })
                  }
                >
                  수정
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="accent"
                  iconLeft={Check}
                  onClick={() => setConfirmZoneSave(true)}
                >
                  저장
                </Button>
              )}
            </span>
          }
        >
          {/*
            카드는 하나로 두고 안에서 탭으로 나눈다.
            「정보」와 「검증」은 같이 볼 일이 드물고 각각은 통째로 봐야 하므로 탭이 맞다.
            반면 탭 안의 구역들은 이어서 훑어야 하므로 구분선으로만 나눈다.
          */}
          <Tabs
            label="구역 상세"
            value={zoneTab}
            onChange={setZoneTab}
            items={[
              { id: 'info', label: '정보' },
              // 0 은 붙이지 않는다. 안내문이 이미 «걸린 것이 없다»고 말한다.
              { id: 'check', label: '검증', count: zoneIssues.length || undefined },
            ]}
          >
            {/*
              탭 안에서 다시 구역을 나눈다.
              탭은 «성격이 다른 갈래»를, 왼쪽 목차는 «한 갈래 안에서 어디쯤인지»를 맡는다.
              목차는 지금 편 탭의 구역만 세운다 — 안 보이는 구역을 가리키면 눌러도 안 움직인다.
            */}
            <div className="grid gap-lg pt-lg lg:grid-cols-[11rem_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-lg lg:self-start">
                <SectionNav label="구역 상세 구성" items={zoneSections} />
              </aside>

              <div className="min-w-0">
                {zoneTab === 'info' ? (
                  <>
                    <section id="zone-basics" aria-labelledby="zone-basics-title">
                      <h3 id="zone-basics-title" className="text-subhead font-bold text-content">
                        구역 정보
                      </h3>

                      <div className="mt-md grid gap-md">
                        <SelectInput
                          readOnly={viewingZone}
                          label="지역"
                          required
                          options={(Object.keys(REGION_LABELS) as Region[]).map((region) => ({
                            value: region,
                            label: REGION_LABELS[region],
                          }))}
                          value={zone.region}
                          onChange={(value) =>
                            setEditingZone((current) => {
                              if (!current) return current;
                              const region = value as Region;
                              // 「광주 담양군」 같은 조합이 생기지 않도록 시·군·구를 비운다.
                              const keep = DISTRICTS_BY_REGION[region].includes(current.city);
                              return { ...current, region, city: keep ? current.city : '' };
                            })
                          }
                        />
                        <SelectInput
                          readOnly={viewingZone}
                          label="시·군·구"
                          required
                          options={DISTRICTS_BY_REGION[zone.region].map((city) => ({
                            value: city,
                            label: city,
                          }))}
                          value={zone.city}
                          onChange={(value) =>
                            setEditingZone((current) =>
                              current ? { ...current, city: value } : current,
                            )
                          }
                        />
                      </div>
                    </section>

                    <hr className="my-lg border-0 border-t border-line-subtle" />

                    <section id="zone-places" aria-labelledby="zone-places-title">
                      <h3 id="zone-places-title" className="text-subhead font-bold text-content">
                        이 구역의 관광지
                      </h3>
                      <DataTable
                        className="mt-md"
                        columns={ZONE_ATTRACTION_COLUMNS}
                        rows={inZone}
                        rowKey={(row) => row.id}
                      />
                    </section>
                  </>
                ) : (
                  <>
                    <section id="zone-check" aria-labelledby="zone-check-title">
                      <h3 id="zone-check-title" className="text-subhead font-bold text-content">
                        검증 결과
                      </h3>

                      <div className="mt-md">
                        {inZone.length === 0 ? (
                          <Callout tone="caution" size="sm" icon={TriangleAlert}>
                            이 구역에 등록된 관광지가 없습니다. 구역만 있고 자원이 없으면 관람객이 이
                            지역을 골라도 내놓을 것이 없습니다.
                          </Callout>
                        ) : zoneIssues.length === 0 ? (
                          <Callout tone="positive" size="sm" icon={CircleCheck}>
                            이 구역의 관광지 {inZone.length}곳 모두 기준을 지키고 있습니다.
                          </Callout>
                        ) : (
                          <Callout
                            tone={zoneErrors.length > 0 ? 'critical' : 'caution'}
                            size="sm"
                            icon={TriangleAlert}
                          >
                            이 구역에서 {zoneIssues.length}건이 걸렸습니다
                            {zoneErrors.length > 0 ? ` (오류 ${zoneErrors.length}건)` : ''}.
                          </Callout>
                        )}
                      </div>
                    </section>

                    {/* 걸린 것이 없으면 표를 두지 않는다. 위 안내문과 같은 말이 두 번 된다. */}
                    {zoneIssues.length > 0 ? (
                      <DataTable
                        className="mt-md"
                        columns={ZONE_ISSUE_COLUMNS}
                        rows={zoneIssues}
                        rowKey={(row) => row.key}
                      />
                    ) : null}

                    <hr className="my-lg border-0 border-t border-line-subtle" />

                    <section id="zone-interest" aria-labelledby="zone-interest-title">
                      <h3 id="zone-interest-title" className="text-subhead font-bold text-content">
                        관광유형 분포
                      </h3>
                      <BarList className="mt-md" items={zoneInterestBars} tone="brand" />
                    </section>

                    <hr className="my-lg border-0 border-t border-line-subtle" />

                    <section id="zone-stay" aria-labelledby="zone-stay-title">
                      <h3 id="zone-stay-title" className="text-subhead font-bold text-content">
                        체류시간 분포
                      </h3>
                      <BarList className="mt-md" items={zoneStayBars} tone="brand" />
                    </section>
                  </>
                )}
              </div>
            </div>
          </Tabs>
        </Panel>

        <Sheet
          open={confirmZoneSave}
          onClose={() => setConfirmZoneSave(false)}
          placement="center"
          title="구역 저장"
          description={renamed ? `${zone.original} → ${nextId}` : '고친 내용이 없습니다.'}
          footer={
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setConfirmZoneSave(false)}>
                더 고치기
              </Button>
              <Button
                variant="accent"
                iconLeft={Check}
                disabled={!nameFilled || collides}
                onClick={() => {
                  if (renamed) {
                    removeDistrict(zone.original);
                    addDistrict(zone.region, zone.city);
                    /*
                      관광지가 들고 있는 소재지도 같이 옮긴다.
                      안 옮기면 이 관광지들이 그대로 「취급 목록 밖」으로 떨어진다.
                    */
                    for (const attraction of inZone) {
                      updateAttraction(attraction.id, {
                        district: nextId,
                        region: zone.region,
                      });
                    }
                  }
                  setConfirmZoneSave(false);
                  closeZone();
                  toast(
                    renamed
                      ? `${nextId} 으로 바꾸고 관광지 ${inZone.length}곳을 함께 옮겼습니다.`
                      : '고친 내용이 없습니다.',
                    renamed ? 'positive' : 'neutral',
                  );
                }}
              >
                저장
              </Button>
            </span>
          }
        >
          <p className="text-body text-content-secondary">
            {!nameFilled ? (
              <strong className="text-critical">시·군·구를 채워야 저장할 수 있습니다.</strong>
            ) : collides ? (
              <>
                <strong className="text-critical">{nextId} 는 이미 목록에 있습니다.</strong> 다른
                이름으로 바꾸거나, 원래 이름 그대로 두세요.
              </>
            ) : renamed ? (
              <>
                이 구역의 관광지 <strong className="text-content">{inZone.length}곳</strong>의 소재지도
                함께 <strong className="text-content">{nextId}</strong> 로 바뀝니다.
              </>
            ) : (
              <>바뀐 값이 없어 저장해도 달라지는 것이 없습니다.</>
            )}
          </p>
        </Sheet>

        <Sheet
          open={confirmZoneCancel}
          onClose={() => setConfirmZoneCancel(false)}
          placement="center"
          title="변경 취소"
          description="고친 내용은 저장되지 않습니다."
          footer={
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setConfirmZoneCancel(false)}>
                계속 고치기
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  setConfirmZoneCancel(false);
                  closeZone();
                  toast('고친 내용을 되돌렸습니다.', 'neutral');
                }}
              >
                되돌리기
              </Button>
            </span>
          }
        >
          <p className="text-body text-content-secondary">
            이 화면에서 고친 값이 저장 전 상태로 돌아갑니다.
          </p>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title="관광지 구역"
        action={
          <span className="flex flex-wrap items-center gap-xs">
            {checked.size > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                iconLeft={Trash2}
                onClick={() => setConfirmBulk(true)}
              >
                {checked.size}곳 삭제
              </Button>
            ) : null}
            <Button size="sm" variant="accent" iconLeft={Plus} onClick={() => setAdding(true)}>
              시·군·구 추가
            </Button>
          </span>
        }
      >
        {/* 간격은 「관광지 목록」과 같은 값을 쓴다 — 두 게시판이 따로 놀면 눈에 띈다. */}
        <FilterChips chips={regionTabs} selected={regionTab} onSelect={setRegionTab} />
        <div className="mt-sm">{districtList.node}</div>
        <DataTable
          className="mt-md"
          columns={DISTRICT_COLUMNS}
          rows={districtList.rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            route.open(row.id);
            setEditingZone(undefined);
            setZoneTab('info');
          }}
        />
        {districtList.pager}

        {outsiders.length > 0 ? (
          <Callout className="mt-md" tone="caution" size="sm" icon={TriangleAlert}>
            <p className="font-semibold">
              취급 목록에 없는 소재지를 쓰는 관광지가 {outsiders.length}곳 있습니다.
            </p>
            <p className="mt-2xs leading-relaxed">
              {outsiders
                .slice(0, 5)
                .map((attraction) => `${attraction.name}(${attraction.district})`)
                .join(' · ')}
              {outsiders.length > 5 ? ` 외 ${outsiders.length - 5}곳` : ''}
            </p>
            <p className="mt-2xs leading-relaxed">
              소재지를 잘못 적었거나, 이 지역을 아직 취급 목록에 넣지 않은 것입니다.
            </p>
          </Callout>
        ) : null}
      </Panel>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        placement="center"
        title="시·군·구 추가"
        description="관광지의 소재지 표기와 글자 그대로 같아야 합니다."
        footer={
          <span className="flex items-center justify-between gap-sm">
            <strong className="text-subhead font-bold text-content">
              {draftCity.length === 0 ? '—' : districtId(draftRegion, draftCity)}
            </strong>
            <span className="flex gap-sm">
              <Button variant="quiet" onClick={() => setAdding(false)}>
                취소
              </Button>
              <Button
                variant="accent"
                disabled={draftCity.length === 0}
                onClick={() => {
                  const id = districtId(draftRegion, draftCity);
                  addDistrict(draftRegion, draftCity);
                  setAdding(false);
                  setDraftCity('');
                  toast(`${withParticle(id, '목적격')} 추가했습니다.`);
                }}
              >
                추가
              </Button>
            </span>
          </span>
        }
      >
        <div className="grid gap-md sm:grid-cols-2">
          <SelectInput
            label="지역"
            options={(Object.keys(REGION_LABELS) as Region[]).map((region) => ({
              value: region,
              label: REGION_LABELS[region],
            }))}
            value={draftRegion}
            onChange={(value) => {
              setDraftRegion(value as Region);
              // 지역이 바뀌면 고른 시·군·구는 그 지역에 없는 곳이 된다. 비운다.
              setDraftCity('');
            }}
          />
          <SelectInput
            label="시·군·구"
            placeholder={addableCities.length === 0 ? '이미 다 넣었습니다' : '고르세요'}
            options={addableCities.map((city) => ({ value: city, label: city }))}
            value={draftCity}
            onChange={setDraftCity}
          />
        </div>
      </Sheet>

      <Sheet
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        placement="center"
        title="고른 시·군·구 삭제"
        description="다루는 지역에서 한꺼번에 뺍니다."
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
                for (const id of checked) removeDistrict(id);
                setChecked(new Set());
                setConfirmBulk(false);
                toast(`${count}곳을 목록에서 뺐습니다.`, 'neutral');
              }}
            >
              {checked.size}곳 삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          {[...checked].join(' · ')} 를 다루는 지역에서 뺍니다.
        </p>
      </Sheet>

      <Sheet
        open={pendingDistrict !== undefined}
        onClose={() => setPendingDistrict(undefined)}
        placement="center"
        title="시·군·구 삭제"
        description="다루는 지역에서 뺍니다."
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setPendingDistrict(undefined)}>
              취소
            </Button>
            <Button
              variant="accent"
              iconLeft={Trash2}
              onClick={() => {
                const target = pendingDistrict;
                if (target) removeDistrict(target.id);
                setPendingDistrict(undefined);
                if (target) toast(`${withParticle(target.id, '목적격')} 목록에서 뺐습니다.`, 'neutral');
              }}
            >
              삭제
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          <strong className="text-content">{pendingDistrict?.id}</strong>
          {pendingDistrict !== undefined && pendingDistrict.count > 0 ? (
            <>
              {' '}이 소재지를 쓰는 관광지가 <strong className="text-critical">{pendingDistrict.count}곳</strong>{' '}
              있습니다. 빼면 그 관광지들이 「취급 목록 밖」으로 잡힙니다.
            </>
          ) : (
            <> 이 소재지를 쓰는 관광지는 없습니다.</>
          )}
        </p>
      </Sheet>

    </div>
  );
}
