import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * 아무것도 없을 때 그 자리에 놓는 말.
 *
 * ── 왜 한 벌로 두는가 ──────────────────────────────────────────────
 * 화면마다 「가져온 로그가 없습니다」·「조건에 맞는 세션이 없습니다」·
 * 「세션마다 …가 쌓입니다」처럼 다르게 적으면, 같은 사정(줄이 없다)이 화면마다
 * 다른 일처럼 읽힌다. 읽는 사람은 그 차이가 뜻이 있는 줄 알고 한 번 더 들여다본다.
 *
 * 그래서 말은 한 벌로 못 박고, 그림표 하나를 함께 둔다 —
 * 글자를 읽기 전에 «비어 있다»가 먼저 보여야 화면이 고장 난 것으로 보이지 않는다.
 */

/** 어느 화면에서나 같은 말. 여기서만 바꾼다. */
export const EMPTY_MESSAGE = '등록된 내역이 없습니다.';

export interface EmptyStateProps {
  /** 자리에 맞는 그림표. 기본은 «담긴 것이 없는 상자»다. */
  icon?: LucideIcon;
  /**
   * 공통 문구 대신 쓸 말.
   *
   * 관람객이 보는 화면처럼 «등록»이라는 말 자체가 어울리지 않는 자리에만 쓴다.
   * 어드민 목록에서는 쓰지 않는다 — 그러라고 공통으로 둔 것이다.
   */
  message?: string;
  /**
   * 다음에 무엇을 하면 되는지 한 줄.
   *
   * 「비어 있다」만 적으면 읽는 사람은 그것이 정상인지 고장인지 모른 채 화면을 떠난다.
   * 등록할 수 있는 자리에서는 그 단추를 가리키고, 자료가 들어와야 채워지는 자리에서는
   * 무엇이 들어와야 하는지 적는다. 없는 행동을 지어내지 않는다.
   */
  action?: string;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, message = EMPTY_MESSAGE, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-xs py-xl text-caption text-content-muted',
        className,
      )}
    >
      <Icon className="size-8 text-content-subtle" aria-hidden />
      <p>{message}</p>
      {action === undefined ? null : <p className="text-content-subtle">{action}</p>}
    </div>
  );
}
