import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { DEFAULT_ADMIN_VIEW } from '@/config/navigation';

/**
 * 어드민 진입점.
 *
 * 화면마다 주소가 따로 있으므로 루트에서는 기본 화면으로 보낸다.
 * 여기서 대시보드를 직접 그리면 같은 화면이 두 주소(`/` 와 `/dashboard`)를 갖게 되어,
 * 사이드바의 선택 표시가 한쪽에서만 켜지는 식으로 어긋난다.
 */
export default function AdminRootPage() {
  // 경로는 메뉴 설정에서 오므로 빌드 시점에 문자열이 정해지지 않는다.
  redirect(`/${DEFAULT_ADMIN_VIEW}` as Route);
}
