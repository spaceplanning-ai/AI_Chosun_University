'use client';

import { useMemo, useState } from 'react';
import { OFFICIAL_DOCUMENTS } from '@namdo-prism/core/data';
import { buildDocumentIndex } from '@namdo-prism/core/domain/linkage-recommendation';
import {
  BarList,
  Badge,
  DataTable,
  Pagination,
  Panel,
  SearchField,
  Stat,
  Toolbar,
  type DataTableColumn,
} from '@namdo-prism/core/ui';

/**
 * 검색 인덱스 관리 (3.4).
 *
 * 색인은 «무엇이 들어 있는가»보다 «어디가 비어 있는가»가 중요하다.
 * 키워드가 적은 문서는 검색에 걸리지 않아 사실상 없는 자료가 되므로,
 * 이 화면은 규모 자랑 대신 얇은 지점을 먼저 드러낸다.
 */

/** 키워드가 이보다 적으면 질의와 겹칠 확률이 낮아 회수되기 어렵다. */
const THIN_KEYWORD_COUNT = 4;
/** 한 쪽에 두는 줄 수. */const PAGE_SIZE = 10;

/** 키워드 분포 막대에 올릴 상위 개수. 전부 그리면 꼬리가 화면을 먹는다. */
const TOP_KEYWORDS = 12;

/** 문서 한 건의 색인 항목. 사람이 적은 것과 자동으로 붙은 것을 나눠 본다. */
interface IndexRow {
  id: string;
  title: string;
  own: string[];
  derived: string[];
}

const INDEX_COLUMNS: DataTableColumn<IndexRow>[] = [
  {
    key: 'title',
    header: '문서',
    cell: (row) => <span className="font-semibold text-content">{row.title}</span>,
  },
  {
    key: 'own',
    header: '문서 키워드',
    cell: (row) => (
      <span className="flex flex-wrap gap-2xs">
        {row.own.map((keyword) => (
          <Badge key={keyword} size="sm" tone="brand">
            {keyword}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    key: 'derived',
    header: '관광지에서 파생',
    cell: (row) => (
      <span className="flex flex-wrap gap-2xs">
        {row.derived.map((keyword) => (
          <Badge key={keyword} size="sm" tone="neutral">
            {keyword}
          </Badge>
        ))}
      </span>
    ),
  },
];

export function SearchIndexView() {
  const [query, setQuery] = useState('');
  /** 지금 보고 있는 쪽. 검색을 바꾸면 처음으로 돌아간다. */
  const [page, setPage] = useState(1);

  /*
    색인 계산은 엔진에서 그대로 꺼내 쓴다.
    화면이 같은 계산을 베껴 쓰면 엔진이 바뀔 때 조용히 어긋난다.
  */
  const indexRows = useMemo<IndexRow[]>(
    () =>
      buildDocumentIndex(OFFICIAL_DOCUMENTS).map((entry) => {
        const own = new Set(entry.document.keywords);
        return {
          id: entry.document.id,
          title: entry.document.title,
          own: entry.keywords.filter((keyword) => own.has(keyword)),
          derived: entry.keywords.filter((keyword) => !own.has(keyword)),
        };
      }),
    [],
  );

  const summary = useMemo(() => {
    /** 키워드 → 이 키워드를 가진 문서 수. */
    const frequency = new Map<string, number>();
    for (const document of OFFICIAL_DOCUMENTS) {
      for (const keyword of document.keywords) {
        frequency.set(keyword, (frequency.get(keyword) ?? 0) + 1);
      }
    }

    const thin = OFFICIAL_DOCUMENTS.filter(
      (document) => document.keywords.length < THIN_KEYWORD_COUNT,
    );

    const totalKeywords = OFFICIAL_DOCUMENTS.reduce(
      (sum, document) => sum + document.keywords.length,
      0,
    );

    // 한 문서에만 붙은 키워드. 회수 폭이 좁다는 뜻이라 따로 센다.
    const singletons = [...frequency.values()].filter((count) => count === 1).length;

    return {
      frequency,
      thin,
      totalKeywords,
      singletons,
      uniqueKeywords: frequency.size,
    };
  }, []);

  const topKeywords = [...summary.frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_KEYWORDS)
    .map(([keyword, count]) => ({
      key: keyword,
      label: keyword,
      value: count,
      unit: '건',
    }));


  const average = summary.totalKeywords / OFFICIAL_DOCUMENTS.length;

  const filteredIndexRows = indexRows.filter((row) => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return true;
    return (
      row.title.toLowerCase().includes(needle) ||
      [...row.own, ...row.derived].some((keyword) => keyword.toLowerCase().includes(needle))
    );
  });

  /* 한 쪽에 열 줄. 마흔 건이 한 줄로 이어지면 표 아래에 있는 것이 화면 밖으로 밀린다. */
  const pageCount = Math.max(1, Math.ceil(filteredIndexRows.length / PAGE_SIZE));
  // 검색으로 줄이 줄면 지금 쪽이 없어질 수 있다. 빈 표 대신 마지막 쪽으로 당긴다.
  const safePage = Math.min(page, pageCount);
  const pagedIndexRows = filteredIndexRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-lg">
      <Panel title="색인 규모" description="검색기가 실제로 뒤지는 대상의 크기입니다.">
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="색인 문서" value={OFFICIAL_DOCUMENTS.length} unit="건" />
          <Stat label="고유 키워드" value={summary.uniqueKeywords} unit="개" />
          <Stat label="문서당 평균 키워드" value={average.toFixed(1)} unit="개" />
          <Stat
            label="단독 키워드"
            value={summary.singletons}
            unit="개"
          />
        </div>
      </Panel>

      <Panel
        title="자주 쓰인 키워드"
        description={`상위 ${TOP_KEYWORDS}개입니다. 한쪽에 몰리면 그 주제 밖의 질의가 빈손으로 돌아옵니다.`}
      >
        <BarList items={topKeywords} tone="brand" />
      </Panel>

      <Panel
        title="문서별 색인 항목"
      >
        <Toolbar
          total={
            <>
              <span data-numeric="">{filteredIndexRows.length}</span>건
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
            placeholder="문서명·키워드 검색"
          />
        </Toolbar>

        <DataTable
          className="mt-md"
          columns={INDEX_COLUMNS}
          rows={pagedIndexRows}
          rowKey={(row) => row.id}
        />
        <Pagination className="mt-md" page={safePage} pageCount={pageCount} onChange={setPage} />
      </Panel>
    </div>
  );
}
