'use client';

import { findResourceSchema } from '@/config/resourceSchemas';
import { LinkageCalcView } from './LinkageCalcView';
import { ResourceManager } from './ResourceManager';

/**
 * 권역 (4.1).
 *
 * 공통 관리 틀을 그대로 쓰되, 상세에 「지수」 탭 하나를 덧붙인다.
 *
 * ── 왜 여기에 지수를 붙였는가 ──────────────────────────────────────
 * 권역은 «어느 시군구를 한 덩어리로 볼 것인가»를 정하는 자리다.
 * 그 묶음이 잘 잡혔는지는 결국 «이 권역을 지나는 일정의 연계지수»로 드러난다.
 * 정하는 자리와 결과가 갈라져 있으면, 묶음을 바꾼 사람이 효과를 보려고
 * 다른 메뉴를 찾아 들어가야 한다.
 */
export function ZoneManagerView() {
  const schema = findResourceSchema('poi-region');
  if (!schema) return null;

  return (
    <ResourceManager
      schema={schema}
      extraTab={{
        label: '지수',
        render: (record) => (
          <LinkageCalcView
            title={`${String(record.name ?? '')} 연계지수`}
            /* 이 권역에 등록한 시군구를 하나라도 들른 일정만 본다. */
            districts={(record.districts as string[] | undefined) ?? []}
          />
        ),
      }}
    />
  );
}
