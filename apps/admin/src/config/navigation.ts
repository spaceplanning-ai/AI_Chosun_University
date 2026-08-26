import {
  ChartColumn,
  Cpu,
  Database,
  FileSearch,
  Gauge,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * 어드민 좌측 메뉴.
 *
 * 화면 목록을 컴포넌트가 아니라 **데이터로** 둔다.
 * 메뉴는 사이드바·본문 전환·머리말 경로에서 각각 쓰이는데, 세 곳에 따로 적으면
 * 항목을 하나 더할 때 한 곳을 빠뜨려 «메뉴에는 있는데 안 열리는» 화면이 생긴다.
 *
 * ── `status` 를 둔 이유 ────────────────────────────────────────────
 * 요청받은 화면 중 상당수는 **백엔드가 있어야 채울 수 있다**(임베딩·프롬프트·외부 API).
 * 이 저장소는 프런트엔드 전용이므로 그런 화면에 그럴듯한 숫자를 채워 두면,
 * 검수·논문 자료로 그대로 캡처되어 «있는 기능»으로 오해된다.
 *
 * 그래서 화면마다 지금 상태를 명시한다.
 *   ready   — 지금 저장소의 자료·엔진으로 실제 값을 보여 준다
 *   planned — 아직 붙일 것이 없다. 무엇이 들어갈지와 무엇이 필요한지를 화면에 적는다
 * ──────────────────────────────────────────────────────────────────
 */

export type AdminViewStatus = 'ready' | 'planned';

export interface AdminNavItem {
  id: string;
  label: string;
  /** 사이드바 항목 아래 한 줄. 열기 전에 무엇을 하는 화면인지 알린다. */
  hint: string;
  status: AdminViewStatus;
  /** `planned` 인 화면에만. 이 화면을 채우려면 무엇이 있어야 하는가. */
  needs?: string;
}

export interface AdminNavGroup {
  label: string;
  icon: LucideIcon;
  items: readonly AdminNavItem[];
}

export const ADMIN_NAVIGATION: readonly AdminNavGroup[] = [
  {
    label: '대시보드',
    icon: ChartColumn,
    items: [
      { id: 'dashboard', label: '대시보드', hint: '오늘 지표와 검수 기준 충족 여부', status: 'ready' },
    ],
  },
  {
    label: '관광지',
    icon: Database,
    items: [
      { id: 'poi-manage', label: '등록', hint: '관광지 목록에서 골라 값을 고칩니다', status: 'ready' },
      { id: 'poi-meta', label: '관리', hint: '값이 빠졌는지·자원이 쏠렸는지 보고 내보냅니다', status: 'ready' },
    ],
  },
  {
    /*
      «지금 무엇을 하려는가»로 갈린다 — 자료를 고치거나(관리),
      검색이 어떻게 도는지 정하거나(검색 설정).
    */
    label: '문서',
    icon: FileSearch,
    items: [
      { id: 'doc-manage', label: '관리', hint: '어떤 기관 자료가 언제 갱신됐는지', status: 'ready' },
      {
        id: 'doc-config',
        label: '검색 설정',
        hint: '점수를 어떻게 매기는지, 색인에 무엇이 들었는지',
        status: 'ready',
      },
    ],
  },
  {
    label: '추천 엔진',
    icon: Cpu,
    items: [
      { id: 'rec-model', label: '설정', hint: '후보를 몇 개까지 보고 어디서 자를지', status: 'ready' },
      { id: 'rec-weight', label: '관리', hint: '무엇을 얼마나 볼지 정하는 배점표', status: 'ready' },
    ],
  },
  {
    label: '초광역 연계지수',
    icon: Gauge,
    items: [
      { id: 'poi-region', label: '권역', hint: '시군구를 묶어 부르는 단위', status: 'ready' },
      /*
        「권역 관리」·「지수 계산」은 값을 정하고 재는 자리, 「통계」는 나온 결과를
        놓고 보는 자리다. 하는 일이 갈리므로 메뉴에서도 갈라 둔다.
      */
      { id: 'link-stats', label: '통계', hint: '지역을 고르게 다녔는지, 무엇끼리 이어졌는지', status: 'ready' },
    ],
  },
  {
    label: '로그',
    icon: ScrollText,
    items: [
      { id: 'log-session', label: '세션 로그', hint: '키오스크에서 가져온 이용 기록', status: 'ready' },
      { id: 'log-rag', label: '검색 로그', hint: '어떤 낱말로 무엇을 찾았는지', status: 'ready' },
      { id: 'log-rec', label: '추천 로그', hint: '무엇이 뽑히고 무엇이 밀렸는지', status: 'ready' },
      /*
        예외 스택이 아니라 «결과가 기준을 못 지킨 순간»을 모은다.
        이 시스템은 멈추는 대신 조용히 나쁜 결과를 내므로, 그것을 봐야 한다.
      */
      { id: 'log-error', label: '에러 로그', hint: '검색 실패·재구성 미달성·응답 지연', status: 'ready' },
    ],
  },
  {
    label: '사용자',
    icon: Users,
    items: [
      { id: 'field-pattern', label: '이용 패턴', hint: '관람객이 실제로 무엇을 골랐는지', status: 'ready' },
      { id: 'field-qr', label: 'QR 전환률', hint: '만든 일정을 실제로 가져갔는지', status: 'ready' },
      {
        id: 'field-survey',
        label: '만족도 조사',
        hint: '현장에서 받은 응답을 옮겨 적습니다',
        status: 'ready',
        needs: '설문으로만 얻을 수 있는 값입니다(제안서 10.5). 시스템이 만들어 낼 수 없어 비워 둡니다.',
      },
    ],
  },
  {
    label: '시스템 설정',
    icon: Settings,
    items: [
      {
        id: 'sys-model',
        label: 'AI 모델',
        hint: '어떤 모델을 어떻게 부를지',
        status: 'ready',
        needs: '추천 이유는 생성모델이 아니라 점수 계산에서 파생됩니다. LLM 호출 자체가 없습니다.',
      },
      {
        id: 'sys-prompt',
        label: '프롬프트',
        hint: '답변 형식을 정하는 문구',
        status: 'ready',
        needs: 'LLM 을 쓰지 않으므로 프롬프트가 없습니다. 백엔드에 생성모델이 붙으면 생깁니다.',
      },
    ],
  },
];

export type AdminViewId = string;

/** 첫 화면. 메뉴 첫 항목을 따라가므로 순서를 바꾸면 시작 화면도 함께 바뀐다. */
export const DEFAULT_ADMIN_VIEW: AdminViewId = ADMIN_NAVIGATION[0]!.items[0]!.id;

export interface AdminNavLocation {
  group: AdminNavGroup;
  item: AdminNavItem;
  /** 「2.3」 같은 목차 번호. 화면 사이 대화에서 이 번호로 서로를 가리킨다. */
  number: string;
}

/** 화면 id 로 «묶음 › 항목»과 번호를 찾는다. */
/**
 * 화면을 찾되 없으면 undefined 를 준다.
 *
 * 길 안내처럼 «있으면 그리고 없으면 만다»가 맞는 자리에 쓴다.
 * 본문 전환에는 쓰지 않는다 — 거기서 조용히 넘어가면 빈 화면이 뜬다.
 */
export function findNavItemSafe(id: AdminViewId): AdminNavLocation | undefined {
  for (const [groupIndex, group] of ADMIN_NAVIGATION.entries()) {
    const itemIndex = group.items.findIndex((entry) => entry.id === id);
    if (itemIndex >= 0) {
      return {
        group,
        item: group.items[itemIndex]!,
        number: `${groupIndex + 1}.${itemIndex + 1}`,
      };
    }
  }
  return undefined;
}

export function findNavItem(id: AdminViewId): AdminNavLocation {
  const found = findNavItemSafe(id);
  if (found) return found;
  // 목록에 없는 화면은 열 수 없다. 조용히 첫 화면으로 넘기면 «눌렀는데 딴 데로 간다»가 된다.
  throw new Error(`알 수 없는 어드민 화면입니다: ${id}`);
}

