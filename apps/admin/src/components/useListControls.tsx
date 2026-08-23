'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Pagination, SearchField, SelectField, Toolbar } from '@namdo-prism/core/ui';

/**
 * 목록 화면의 검색·정렬.
 *
 * ── 왜 한곳에 두는가 ───────────────────────────────────────────────
 * 표가 있는 화면마다 검색칸과 정렬 상자를 따로 붙이면, 어떤 화면은 대소문자를
 * 가리고 어떤 화면은 안 가리는 식으로 동작이 갈린다. 건수를 어디에 적을지도 달라진다.
 * 화면이 정하는 것은 «무엇을 훑을지»와 «어떤 순서가 있는지»뿐이고,
 * 나머지 동작은 여기서 한 번만 정한다.
 *
 * 정렬은 비교 함수를 그대로 받는다. 문자열 키로 받으면 «내림차순인가 오름차순인가»를
 * 화면마다 다시 적어야 하고, 숫자와 글자를 섞어 다루기 어렵다.
 */

export interface SortOption<T> {
  value: string;
  label: string;
  compare: (a: T, b: T) => number;
}

export interface ListControlsConfig<T> {
  rows: readonly T[];
  /**
   * 검색어가 훑을 글자.
   * 행 하나를 한 줄로 이어 붙여 돌려주면, 어느 칸에 있든 걸린다.
   */
  searchIn?: (row: T) => string;
  placeholder?: string;
  sorts?: readonly SortOption<T>[];
  /** 건수 뒤에 붙는 단위. 「건」이 어색한 목록이 있다. */
  unit?: string;
  /**
   * 한 쪽에 몇 줄을 둘지. 주면 쪽이 나뉜다.
   *
   * 자료는 늘기만 하는데 한 화면에 다 뿌리면 표 아래에 있는 것이 화면 밖으로 밀린다.
   */
  pageSize?: number;
}

export interface ListControls<T> {
  /** 검색·정렬·쪽 넘김을 거친 행. 표에는 이것을 넘긴다. */
  rows: T[];
  /** 화면 위에 그대로 놓는 조작줄. */
  node: ReactNode;
  /** 표 아래에 놓는 쪽 넘김. 나눌 것이 없으면 `null`. */
  pager: ReactNode;
}

export function useListControls<T>({
  rows,
  searchIn,
  placeholder = '검색',
  sorts,
  unit = '건',
  pageSize,
}: ListControlsConfig<T>): ListControls<T> {
  const [query, setQuery] = useState('');
  const [sortValue, setSortValue] = useState(sorts?.[0]?.value ?? '');
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered =
      needle.length === 0 || !searchIn
        ? [...rows]
        : rows.filter((row) => searchIn(row).toLowerCase().includes(needle));

    const sort = sorts?.find((option) => option.value === sortValue);
    // 원본 배열을 건드리지 않도록 이미 복사한 뒤 정렬한다.
    return sort ? filtered.sort(sort.compare) : filtered;
  }, [rows, query, searchIn, sorts, sortValue]);

  const hasControls = searchIn !== undefined || (sorts?.length ?? 0) > 0;

  const pageCount = pageSize ? Math.max(1, Math.ceil(visible.length / pageSize)) : 1;
  /*
    검색으로 줄이 줄면 지금 쪽이 없어질 수 있다.
    그때 빈 표를 보여 주는 대신 마지막 쪽으로 당긴다 — 상태를 고치지 않고 읽을 때만 잡는다.
  */
  const safePage = Math.min(page, pageCount);
  const paged = pageSize ? visible.slice((safePage - 1) * pageSize, safePage * pageSize) : visible;

  return {
    rows: paged,
    pager: pageSize ? (
      <Pagination
        className="mt-md"
        page={safePage}
        pageCount={pageCount}
        onChange={setPage}
      />
    ) : null,
    node: hasControls ? (
      <Toolbar
        total={
          <>
            <span data-numeric="">{visible.length}</span>
            {unit}
          </>
        }
      >
        {searchIn ? (
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              // 3쪽을 보다 검색하면 결과의 3쪽이 아니라 처음부터 봐야 한다.
              setPage(1);
            }}
            placeholder={placeholder}
          />
        ) : null}
        {sorts && sorts.length > 0 ? (
          <SelectField
            label="정렬"
            value={sortValue}
            options={sorts.map((option) => ({ value: option.value, label: option.label }))}
            onChange={(value) => {
              setSortValue(value);
              setPage(1);
            }}
          />
        ) : null}
      </Toolbar>
    ) : null,
  };
}
