import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { EmptyState } from './EmptyState';

/**
 * 연구자·검수 화면용 표.
 *
 * 검색문서, 후보 점수, 제외 사유, 기각된 대체안이 모두 같은 표를 쓴다.
 * 열 정의를 데이터로 받으므로 화면마다 `<table>` 마크업을 다시 쓰지 않는다.
 */

export interface DataTableColumn<TRow> {
  key: string;
  header: ReactNode;
  /** 셀 렌더러. 문자열뿐 아니라 뱃지·미터도 넣을 수 있다. */
  cell: (row: TRow, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** 수치 열은 탭 정렬 숫자 서체로 렌더링한다. */
  numeric?: boolean;
  /**
   * 이 칸을 행 머리글(`th scope="row"`)로 쓸지.
   *
   * 아무 데도 지정하지 않으면 첫 칸을 쓴다 — 대개 첫 칸이 이름이기 때문이다.
   * 체크박스나 순번이 맨 앞인 표는 이름 칸에 `true` 를 붙여 옮긴다.
   */
  rowHeader?: boolean;
  width?: string;
}

export interface DataTableProps<TRow> {
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow, index: number) => string;
  caption?: ReactNode;
  /**
   * 줄이 없을 때 쓸 말. 안 주면 공통 문구를 쓴다.
   * 관람객이 보는 화면처럼 «등록»이 어울리지 않는 자리에만 넘긴다.
   */
  emptyMessage?: string;
  /** 비었을 때 다음에 할 일. 등록 단추가 있는 표에는 그 단추를 가리킨다. */
  emptyAction?: string;
  /**
   * 줄을 눌렀을 때. 주면 줄 전체가 눌리는 자리가 된다.
   *
   * 칸 안의 버튼·체크박스를 누른 것은 넘긴다 — 삭제를 누르려다 상세로 들어가면
   * 사람은 «왜 안 지워지지» 하고 다시 누른다.
   */
  onRowClick?: (row: TRow) => void;
  className?: string;
}

const ALIGN_CLASS = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  emptyMessage,
  emptyAction,
  className,
}: DataTableProps<TRow>) {
  /*
    행 머리글로 쓸 칸. 지정이 없으면 첫 칸을 쓴다.
    체크박스가 맨 앞인 표에서는 이름 칸을 지정해야 스크린리더가
    «지금 어느 줄인가»를 이름으로 알린다.
  */
  const explicitRowHeader = (() => {
    const index = columns.findIndex((column) => column.rowHeader === true);
    return index === -1 ? undefined : index;
  })();

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-caption">
        {caption ? (
          <caption className="mb-sm text-left text-caption text-content-muted">{caption}</caption>
        ) : null}
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  'px-sm py-xs align-middle font-semibold text-content-muted whitespace-nowrap',
                  ALIGN_CLASS[column.align ?? 'left'],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/*
            줄이 없어도 열 이름은 남긴다.
            안내문 한 장으로 표를 통째로 갈아 끼우면 «이 게시판이 원래 어떻게 생겼는지»가
            사라져, 처음 여는 사람은 무엇이 쌓이는 자리인지조차 알 수 없다.
          */}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-sm">
                <EmptyState message={emptyMessage} action={emptyAction} />
              </td>
            </tr>
          ) : null}
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={
                onRowClick === undefined
                  ? undefined
                  : (event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('button, input, a, [role="listbox"]')) return;
                      onRowClick(row);
                    }
              }
              className={cn(
                'border-b border-line-subtle last:border-0 hover:bg-surface-sunken',
                onRowClick === undefined ? '' : 'cursor-pointer',
              )}
            >
              {columns.map((column, columnIndex) => {
                /*
                  첫 칸을 행 머리글로 삼는다.

                  열이 예닐곱인 표에서 «지금 어느 줄인가»를 스크린리더가 알리려면
                  행에도 머리글이 있어야 한다. 없으면 «100.0» 만 읽히고
                  그게 어느 시나리오의 값인지 알 수 없다.
                  첫 칸이 이름이 아닌 표는 `rowHeader: false` 로 끈다.
                */
                const isRowHeader =
                  explicitRowHeader === undefined
                    ? columnIndex === 0 && column.rowHeader !== false
                    : columnIndex === explicitRowHeader;
                const Cell = isRowHeader ? 'th' : 'td';
                return (
                  <Cell
                    key={column.key}
                    {...(isRowHeader ? { scope: 'row' as const } : {})}
                    className={cn(
                      'px-sm py-xs align-middle',
                      isRowHeader ? 'font-normal text-content' : 'text-content-secondary',
                      ALIGN_CLASS[column.align ?? 'left'],
                    )}
                    {...(column.numeric ? { 'data-numeric': '' } : {})}
                  >
                    {/*
                      줄을 눌러 상세로 가는 표에서는 행 머리글을 단추로 감싼다.

                      줄 전체에 걸린 `onClick` 은 마우스에만 닿는다 — 키보드로 다니는
                      사람은 `<tr>` 에 초점이 가지 않아 상세를 열 방법이 아예 없었다.
                      `<tr role="button">` 로 만들면 표의 «줄»이라는 뜻이 사라지므로,
                      이름 칸에 진짜 단추를 두어 표는 표대로 두고 길만 낸다.

                      머리글 칸이 이름을 그리는 자리라는 전제를 둔다. 지금 모든 표가
                      그렇다. 그 칸에 단추나 링크를 그리게 되면 단추가 겹치므로,
                      그때는 `rowHeader` 를 다른 칸으로 옮긴다.
                    */}
                    {isRowHeader && onRowClick !== undefined ? (
                      <button
                        type="button"
                        className="w-full rounded-control text-left"
                        onClick={() => onRowClick(row)}
                      >
                        {column.cell(row, index)}
                      </button>
                    ) : (
                      column.cell(row, index)
                    )}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
