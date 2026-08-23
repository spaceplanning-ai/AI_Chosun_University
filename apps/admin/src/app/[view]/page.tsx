import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { ADMIN_NAVIGATION, findNavItemSafe, type AdminViewId } from '@/config/navigation';

/**
 * 화면 하나의 주소.
 *
 * 주소가 곧 화면이라 즐겨찾기·뒤로가기·새로고침이 모두 제자리를 찾는다.
 * 「이 화면 좀 봐 달라」고 링크를 건넬 수도 있다.
 *
 * 메뉴에 없는 주소는 404 로 보낸다 — 조용히 첫 화면으로 넘기면
 * «주소를 잘못 쳤다»는 사실이 감춰져 오타를 계속 안고 다니게 된다.
 */

/** 빌드 때 메뉴에 있는 화면 주소를 미리 만들어 둔다. */
export function generateStaticParams() {
  return ADMIN_NAVIGATION.flatMap((group) => group.items.map((item) => ({ view: item.id })));
}

export default async function AdminViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!findNavItemSafe(view as AdminViewId)) notFound();
  /*
    주소의 물음표 뒤(지금 열어 둔 항목)는 서버에서 미리 알 수 없다.
    Suspense 로 감싸야 나머지 화면을 먼저 만들어 둘 수 있다.
  */
  return (
    <Suspense>
      <AdminShell view={view as AdminViewId} />
    </Suspense>
  );
}
