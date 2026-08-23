'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { usePresentationSync } from '@namdo-prism/core/state';
import { SearchConfigView } from '@/components/DocumentTabViews';
import { RecommenderSettingsView } from '@/components/RecommenderSettingsView';
import { ModelSettingsView } from '@/components/ModelSettingsView';
import { AttractionManageView } from '@/components/AttractionManageView';
import { AttractionRegistryView } from '@/components/AttractionRegistryView';
import { AdminSidebar } from '@/components/AdminSidebar';
import { DashboardView } from '@/components/DashboardView';
import { DocumentsView } from '@/components/DocumentsView';
import { FieldPatternView, FieldQrView } from '@/components/FieldStudyViews';
import { LinkageStatsView } from '@/components/LinkageStatsView';
import { ZoneManagerView } from '@/components/ZoneManagerView';
import { ErrorLogView } from '@/components/ErrorLogView';
import { LogsView } from '@/components/LogsView';
import { ResourceManager } from '@/components/ResourceManager';
import { SettingsForm } from '@/components/SettingsForm';
import { WeightsView } from '@/components/WeightsView';
import {
  RagLogView,
  RecommendationLogView,
} from '@/components/ResearchLogViews';
import { findResourceSchema, findSettingsSchema } from '@/config/resourceSchemas';
import { findNavItem, type AdminViewId } from '@/config/navigation';

export interface AdminShellProps {
  /** 지금 그릴 화면. 주소에서 온다. */
  view: AdminViewId;
}
import { ToastProvider } from '@namdo-prism/core/ui';
import { AdminChromeProvider } from '@/state/adminChrome';
import { usePresentation } from '@/state/presentation';

/**
 * 어드민 진입점.
 *
 * 화면이 열둘이라 가로 탭으로는 «지금 어디에 있는지»가 사라진다.
 * 좌측 메뉴로 두면 항목이 늘어도 위치가 그대로여서 손이 자리를 기억한다.
 *
 * 메뉴 구조와 화면 연결은 `config/navigation.ts` 한곳에서 정한다.
 * 여기서는 «어떤 id 에 어떤 컴포넌트를 붙일지»만 적는다 —
 * 메뉴가 늘 때 고칠 곳이 둘로 갈리지 않게 하기 위함이다.
 */

/**
 * 화면 id → 컴포넌트.
 *
 * 여기에 없는 id 는 「준비 중」 화면이 받는다.
 * 표에 억지로 채워 넣지 않는 이유는, 연결이 없다는 사실 자체가 인계 정보이기 때문이다.
 * `seeInstead` 는 «지금은 다른 화면에서 볼 수 있다»를 알려 주는 길잡이다.
 */
/**
 * 화면 id → 컴포넌트.
 *
 * 컴포넌트는 자기가 어느 메뉴로 열렸는지 알 수 있어야 한다 —
 * 여러 메뉴가 한 화면을 쓰는 경우 «어느 칸을 보러 왔는지»가 달라지기 때문이다.
 * 그 값이 필요 없는 화면은 받지 않고 무시하면 된다.
 */
const VIEWS: Record<string, React.ComponentType<{ view: AdminViewId }>> = {
  dashboard: DashboardView,

  // 관광지 데이터 관리
  'poi-manage': AttractionRegistryView,
  'poi-meta': AttractionManageView,

  // 공식문서 / RAG
  'doc-manage': DocumentsView,
  'rec-model': RecommenderSettingsView,
  'doc-config': SearchConfigView,

  // AI 추천 관리 — 후보 점수·제외 사유·신뢰도·근거가 모두 연구자 화면 한곳에 있다
  // 배점표 세 가지(추천·신뢰도·연계지수)가 한 화면에 있어 4.2 와 5.5 가 같은 곳을 본다
  'rec-weight': WeightsView,

  // 초광역 연계지수 — 구성요소 배점도 같은 배점 화면에서 조절한다
  'link-stats': LinkageStatsView,
  'poi-region': ZoneManagerView,
  // 4개 구성요소 배점은 배점 화면이 이미 다룬다. 같은 값을 두 곳에서 고치게 두지 않는다

  // 일정 재구성 연구

  // 연구 / 실험

  // 연구 로그
  'log-session': LogsView,
  'log-rag': RagLogView,
  'log-rec': RecommendationLogView,
  'log-error': ErrorLogView,

  // 사용자 / 현장 실증 — 모두 가져온 세션 로그에서 계산한다
  'field-pattern': FieldPatternView,
  'field-qr': FieldQrView,

  // 검수

  // 특허 / 기술자료

  'sys-model': ModelSettingsView,
};


export function AdminShell({ view }: AdminShellProps) {
  usePresentationSync(usePresentation);
  const router = useRouter();

  /*
    화면 전환은 주소를 바꾸는 일이다.

    예전에는 `useState` 로만 바꿨는데, 그러면 주소가 늘 `/` 라
    즐겨찾기도 뒤로가기도 새로고침도 지금 보던 화면으로 돌아오지 못한다.
    어드민에서 «이 화면 좀 봐 달라»고 링크를 건넬 수도 없었다.
  */
  const navigate = useCallback(
    // 화면 id 가 곧 경로다. 메뉴 설정에서 오므로 빌드 시점 문자열이 아니다.
    (next: AdminViewId) => router.push(`/${next}` as Route),
    [router],
  );

  const { group, item } = findNavItem(view);
  const Current = VIEWS[view];
  const resourceSchema = findResourceSchema(view);
  const settingsSchema = findSettingsSchema(view);

  return (
    // 알림은 화면 전체를 덮는 자리에 뜨므로 가장 바깥에서 공급한다.
    <ToastProvider>
    <div className="flex min-h-svh bg-surface-page">
      <AdminSidebar current={view} onSelect={navigate} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          본문 머리말 — 지금 어디에 있는지만 알린다.
          제목과 설명은 아래 판이 들고 있으므로 여기서 되풀이하지 않는다.
        */}
        <header className="border-b border-line-subtle bg-surface-page px-xl py-lg">
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div className="min-w-0">
              {/*
                지금 어디에 있는지만 적는다.

                묶음 이름과 화면 이름이 같으면(대시보드처럼 항목이 하나뿐인 묶음)
                한 번만 쓴다 — 「대시보드 | 대시보드」는 아무것도 더 알려 주지 않는다.
              */}
              <p className="flex flex-wrap items-baseline gap-xs text-caption">
                {group.label === item.label ? null : (
                  <>
                    <span className="text-content-muted">{group.label}</span>
                    <span className="text-content-subtle" aria-hidden>
                      |
                    </span>
                  </>
                )}
                <span className="font-semibold text-content">{item.label}</span>
              </p>
            </div>

          </div>
        </header>

        <main className="min-w-0 flex-1 bg-surface-page px-xl py-xl">
          <AdminChromeProvider navigate={navigate}>
          {/*
            화면을 고르는 순서.
              1. 전용 화면이 있으면 그것
              2. 값이 한 벌뿐인 설정이면 설정 폼
              3. 등록·수정·삭제로 다루는 자료면 공통 관리 틀
              4. 아직 아무것도 없으면 설계도만 그리는 준비중 화면
          */}
          {Current ? (
            <Current view={view} />
          ) : settingsSchema ? (
            <SettingsForm schema={settingsSchema} />
          ) : resourceSchema ? (
            <ResourceManager schema={resourceSchema} />
          ) : null}

          </AdminChromeProvider>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
