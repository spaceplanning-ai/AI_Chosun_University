'use client';

import { useMemo } from 'react';
import { ATTRACTIONS, requireAttraction } from '@namdo-prism/core/data';
import { REGION_LABELS, type Itinerary } from '@namdo-prism/core/domain';
import { BarList, Badge, Callout, DataTable, Panel, Stat, type DataTableColumn } from '@namdo-prism/core/ui';
import { findResourceSchema } from '@/config/resourceSchemas';
import { useResourceStore } from '@/state/resources';
import { useAdminNavigate } from '@/state/adminChrome';

/**
 * 지역별 분석 (5.3).
 *
 * «초광역»이라는 이름이 값으로 뒷받침되는지 본다.
 * 일정이 한 지역에만 머물면 이름만 초광역이 되므로, 실제로 어느 시군구가
 * 얼마나 등장하고 경계를 몇 번 넘는지를 센다.
 *
 * 시연 시나리오를 실제 엔진에 넣어 얻은 값이다. 자료가 바뀌면 함께 바뀐다.
 */

/** 한 번도 등장하지 않은 시군구는 추천에서 사실상 없는 지역이다. */
interface DistrictRow {
  district: string;
  region: string;
  /** 등록된 관광지 수. 0 이면 애초에 후보가 없다. */
  attractions: number;
  /** 시연 일정에 등장한 횟수. */
  appearances: number;
}

/** 「담양군 · 장성군」처럼 가운뎃점으로 적힌 시군구 목록을 쪼갠다. */
function splitDistricts(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split('·')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export interface LinkageStatsFilters {
  /**
   * 계산 기준일.
   *
   * 휴무일·운영시간 판정이 이 날짜를 본다. 날짜가 바뀌면 문 닫은 곳이 빠지고
   * 다른 곳이 그 자리에 들어와, 분포 자체가 달라진다.
   */
  referenceDate: string;
  /**
   * 셀 일정. 두 탭이 같은 것을 보므로 부모가 한 번만 만들어 건넨다.
   * 아직 만들기 전(서버 렌더)에는 `undefined` 다.
   */
  itineraries: readonly Itinerary[] | undefined;
}

export function LinkageRegionView({ referenceDate, itineraries }: LinkageStatsFilters) {
  const navigate = useAdminNavigate();

  /*
    등록해 둔 권역을 읽어 «어느 묶음이 일정에 나왔는가»를 센다.
    권역은 사람이 정의하는 값이라, 정의해 두기만 하고 아무도 읽지 않으면
    그 화면은 기록장에 그친다. 여기서 쓰여야 정의할 이유가 생긴다.
  */
  const zoneSchema = findResourceSchema('poi-region')!;
  const { records: zones } = useResourceStore(zoneSchema);

  const analysis = useMemo(() => {
    if (itineraries === undefined) return undefined;

    const appearances = new Map<string, number>();
    let crossings = 0;
    let totalStops = 0;
    const regionStops = new Map<string, number>();

    for (const itinerary of itineraries) {
      // 하루 안에서 지역이 바뀌는 지점을 센다. 날이 바뀌는 것은 이동이 아니다.
      for (const day of itinerary.days) {
        let previousRegion: string | undefined;
        for (const stop of day.stops) {
          const attraction = requireAttraction(stop.attractionId);
          appearances.set(attraction.district, (appearances.get(attraction.district) ?? 0) + 1);
          regionStops.set(attraction.region, (regionStops.get(attraction.region) ?? 0) + 1);
          totalStops += 1;
          if (previousRegion !== undefined && previousRegion !== attraction.region) crossings += 1;
          previousRegion = attraction.region;
        }
      }
    }

    const districts = new Map<string, { region: string; attractions: number }>();
    for (const attraction of ATTRACTIONS) {
      const current = districts.get(attraction.district);
      districts.set(attraction.district, {
        region: attraction.region,
        attractions: (current?.attractions ?? 0) + 1,
      });
    }

    const rows: DistrictRow[] = [...districts.entries()]
      .map(([district, info]) => ({
        district,
        region: info.region,
        attractions: info.attractions,
        appearances: appearances.get(district) ?? 0,
      }))
      .sort((a, b) => b.appearances - a.appearances || b.attractions - a.attractions);

    return { rows, crossings, totalStops, regionStops };
  }, [itineraries]);

  const rows = analysis?.rows ?? [];
  const unusedDistricts = rows.filter((row) => row.appearances === 0);

  const regionBars = [...(analysis?.regionStops.entries() ?? [])]
    .map(([region, count]) => ({
      key: region,
      label: REGION_LABELS[region as keyof typeof REGION_LABELS] ?? region,
      value: count,
      unit: '회',
    }))
    .sort((a, b) => b.value - a.value);

  /** 권역마다 그 안의 시군구 등장 횟수를 합친다. 한 시군구가 여러 권역에 들어가도 각각 센다. */
  const zoneBars = zones
    .map((zone) => {
      const districts = splitDistricts(zone.districts);
      return {
        key: zone.id,
        label: String(zone.name ?? zone.id),
        value: rows
          .filter((row) => districts.includes(row.district))
          .reduce((sum, row) => sum + row.appearances, 0),
        unit: '회',
        hint: districts.join(' · '),
      };
    })
    .sort((a, b) => b.value - a.value);

  /** 한 번이라도 나온 시군구. 위 타일에서 개수만 쓴다. */
  const appearedDistricts = rows.filter((row) => row.appearances > 0);

  const columns: DataTableColumn<DistrictRow>[] = [
    { key: 'district', header: '시군구', cell: (row) => row.district },
    {
      key: 'region',
      header: '지역',
      width: '7rem',
      cell: (row) => (
        <Badge size="sm" tone={row.region === 'gwangju' ? 'gwangju' : 'jeonnam'}>
          {REGION_LABELS[row.region as keyof typeof REGION_LABELS] ?? row.region}
        </Badge>
      ),
    },
    {
      key: 'attractions',
      header: '등록 관광지',
      align: 'right',
      numeric: true,
      width: '8rem',
      cell: (row) => `${row.attractions}곳`,
    },
    {
      key: 'appearances',
      header: '일정 등장',
      align: 'right',
      numeric: true,
      width: '8rem',
      cell: (row) => (
        <span className={row.appearances === 0 ? 'text-critical' : 'text-content-secondary'}>
          {row.appearances}회
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title="초광역 분포"
        description={`시나리오 ${itineraries?.length ?? 0}건의 일정을 모두 펼쳐 세었습니다. 기준일 ${referenceDate}.`}
      >
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="전체 방문지" value={analysis?.totalStops ?? 0} unit="곳" />
          <Stat
            label="경계 이동"
            value={analysis?.crossings ?? 0}
            unit="회"
            hint="하루 안에서 광주↔전남을 오간 횟수"
          />
          <Stat label="등장한 시군구" value={appearedDistricts.length} unit="개" />
          <Stat
            label="한 번도 안 나온 시군구"
            value={unusedDistricts.length}
            unit="개"
            tone={unusedDistricts.length > 0 ? 'critical' : 'positive'}
          />
        </div>
      </Panel>

      {/*
        시군구별 막대는 두지 않는다 — 아래 「시군구 현황」 표가 같은 값을
        등록 자원 수와 나란히 보여 주므로, 막대는 같은 말을 한 번 더 하는 셈이다.
      */}
      <Panel title="지역별 방문 횟수" description="한쪽에 몰리면 지역 균형 점수가 낮게 나옵니다.">
        <BarList items={regionBars} tone="brand" />
      </Panel>

      <Panel
        title="권역별 등장"
        description="등록해 둔 권역 단위로 묶어 셉니다. 시군구보다 큰 덩어리로 봐야 «어디를 이었는가»가 말이 됩니다."
        action={<Badge tone="neutral">등록 권역 {zones.length}개</Badge>}
      >
        {zones.length === 0 ? (
          <Callout tone="caution">
            등록된 권역이 없습니다.{' '}
            <button
              type="button"
              onClick={() => navigate('poi-region')}
              className="font-semibold text-brand underline underline-offset-2"
            >
              2.3 지역/권역 관리
            </button>{' '}
            에서 시군구를 묶어 두면 여기서 그 단위로 집계됩니다.
          </Callout>
        ) : (
          <BarList items={zoneBars} tone="brand" emptyMessage="일정에 등장한 권역이 없습니다." />
        )}
      </Panel>

      <Panel
        title="시군구 현황"
        description="등록된 자원 수와 실제 등장 횟수를 나란히 둡니다. 자원이 있는데 안 나오는 곳이 손볼 지점입니다."
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.district} />
      </Panel>
    </div>
  );
}
