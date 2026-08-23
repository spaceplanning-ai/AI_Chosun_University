'use client';

import { useState } from 'react';
import { Tabs } from '@namdo-prism/core/ui';
import { SearchIndexView } from './SearchIndexView';
import { SearchMethodView } from './SearchMethodView';

/**
 * 문서 메뉴의 묶음 화면.
 *
 * ── 왜 묶었는가 ────────────────────────────────────────────────────
 * 문서 아래에 화면이 여럿이면 사이드바에서 «어디를 눌러야 하는지»부터 고민이 된다.
 * 둘은 «지금 무엇을 하려는가»로 갈린다 — 자료를 고치거나(관리),
 * 검색이 어떻게 도는지 정하거나(검색 설정).
 *
 * 화면 자체는 하나도 버리지 않는다. 각 화면은 그대로 두고 탭으로만 모은다 —
 * 「검색 방식」과 「색인」은 따로 볼 일이 드물고, 볼 때는 둘 다 보게 된다.
 */

/** 검색 설정 (2.2). 검색이 어떻게 도는지를 정하고 확인하는 자리. */
export function SearchConfigView() {
  const [tab, setTab] = useState('method');

  return (
    <Tabs
      label="검색 설정"
      value={tab}
      onChange={setTab}
      items={[
        { id: 'method', label: '검색 방식' },
        { id: 'index', label: '키워드 분석' },
      ]}
    >
      <div className="pt-lg">{tab === 'method' ? <SearchMethodView /> : <SearchIndexView />}</div>
    </Tabs>
  );
}
