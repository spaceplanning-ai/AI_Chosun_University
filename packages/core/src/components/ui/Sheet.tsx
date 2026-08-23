'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

/**
 * 오버레이 시트.
 *
 * 추천 근거·변경 전후 비교처럼 "결과를 가리지 않고 덧붙여 보여 줘야 하는" 정보에 쓴다.
 * 세로형 키오스크에서는 아래에서 올라오는 형태가 손이 닿는 위치와 맞는다.
 *
 * 네이티브 `<dialog>` 를 쓰는 이유는 포커스 가둠과 Esc 닫기를 브라우저가 처리해 주기 때문이다.
 * 직접 구현하면 전시장에서 키보드 접근성이 조용히 깨진다.
 */

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * 어디에 뜰지.
   *
   * `bottom` 은 세로형 키오스크에 맞춘 기본값 — 아래에서 올라와 손이 닿는 자리에 선다.
   * `center` 는 마우스로 쓰는 어드민에서, 밖에서 불러온 창(주소 찾기처럼)을
   * 화면 한가운데 놓아 시선이 화면 아래로 쏠리지 않게 할 때 쓴다.
   */
  placement?: 'bottom' | 'center';
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  placement = 'bottom',
  className,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 백드롭(다이얼로그 자신)을 눌렀을 때만 닫는다. 내용 클릭은 통과시킨다.
        if (event.target === dialogRef.current) onClose();
      }}
      className={cn(
        'max-h-svh w-full max-w-none border-0 bg-transparent p-0',
        'backdrop:bg-scrim backdrop:backdrop-blur-sm',
        // 가운데는 위아래 여백을 두어야 한다. 붙여 두면 화면이 낮을 때 잘린다.
        placement === 'center' ? 'm-auto py-lg' : 'm-0 mt-auto',
        placement === 'center' ? 'open:animate-rise-in' : 'open:animate-scene-in',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-h-[88svh] w-full max-w-stage flex-col bg-surface-raised shadow-overlay surface-outline',
          placement === 'center' ? 'rounded-panel' : 'rounded-t-panel',
        )}
      >
        <header className="flex items-start justify-between gap-md border-b border-line-subtle p-lg">
          <div className="min-w-0">
            <h2 className="text-title font-bold text-content text-balance-safe">{title}</h2>
            {description ? (
              <p className="mt-2xs text-body text-content-muted">{description}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={X}
            onClick={onClose}
            aria-label="닫기"
          />
        </header>

        <div className="scrollable-y flex-1 p-lg">{children}</div>

        {footer ? <footer className="border-t border-line-subtle p-lg">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
