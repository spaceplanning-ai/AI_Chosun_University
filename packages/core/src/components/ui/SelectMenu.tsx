'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * 직접 그린 선택 메뉴.
 *
 * ── 왜 기본 `<select>` 를 안 쓰는가 ────────────────────────────────
 * 브라우저 기본 선택 상자는 펼친 목록의 모양을 손댈 수 없다. 글꼴도 간격도
 * 고른 항목 표시도 운영체제가 정한다. 어드민의 다른 부분과 눈에 띄게 따로 논다.
 *
 * ── 직접 그리면 무엇을 스스로 해야 하는가 ──────────────────────────
 * 기본 상자가 공짜로 해 주던 것들을 여기서 다시 갖춰야 한다. 안 그러면
 * «보기 좋지만 키보드로는 못 쓰는» 물건이 된다.
 *
 *   · 위·아래 화살표로 옮기고 Enter 로 고르기
 *   · Esc 로 닫고 원래 버튼으로 초점 돌리기
 *   · Home·End 로 처음·끝으로
 *   · 바깥을 누르면 닫기
 *   · 스크린리더가 «목록 상자»로 읽도록 role 과 aria 를 붙이기
 *
 * ── 왜 목록을 화면 맨 끝으로 옮겨 그리는가 ─────────────────────────
 * 펼친 목록을 버튼 옆에 그대로 두면, 위쪽 어딘가에 «넘치면 자르는» 상자가 하나만
 * 있어도 잘린다. 실제로 시트(팝업) 본문이 스크롤 영역이라 그 안에서 목록이 잘렸다.
 * 자르는 상자를 하나하나 찾아 고치는 대신, 목록만 `body` 끝에 그리고 자리는
 * 버튼의 화면 좌표로 잡는다. 어디에 놓인 선택 상자든 같은 방식으로 동작한다.
 */

/** 버튼과 목록 사이 틈. 붙여 두면 어느 쪽이 눌린 것인지 눈으로 갈리지 않는다. */
const GAP = 4;

export interface SelectMenuOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface SelectMenuProps<TValue extends string> {
  /**
   * 무엇을 고르는 칸인지. 스크린리더가 읽는 이름이기도 하다.
   *
   * `showLabel` 이 참이면 버튼 안 왼쪽에도 그대로 나온다(툴바의 「정렬」처럼).
   * 폼에서는 위쪽 라벨이 이미 같은 말을 하므로 끄고 이름으로만 쓴다.
   */
  label: string;
  value: TValue;
  options: readonly SelectMenuOption<TValue>[];
  onChange: (value: TValue) => void;
  /** 버튼 안에 이름을 함께 보일지. 기본은 보인다. */
  showLabel?: boolean;
  /** 아직 고르지 않았을 때 자리에 놓을 문구. */
  placeholder?: string;
  /**
   * 폭을 어떻게 잡을지.
   * `auto` 는 고른 값 길이에 맞춰 줄어든다(툴바), `full` 은 칸을 다 채운다(폼).
   */
  width?: 'auto' | 'full';
  /** 검증에 걸린 칸. 테두리 대신 `aria-invalid` 로 알린다. */
  invalid?: boolean;
  className?: string;
}

export function SelectMenu<TValue extends string>({
  label,
  value,
  options,
  onChange,
  showLabel = true,
  placeholder,
  width = 'auto',
  invalid,
  className,
}: SelectMenuProps<TValue>) {
  const [open, setOpen] = useState(false);
  /** 키보드로 짚고 있는 자리. 눌러서 고르기 전까지는 값이 바뀌지 않는다. */
  const [cursor, setCursor] = useState(() => options.findIndex((option) => option.value === value));

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  /** 화면 좌표로 잡은 목록의 자리. 열려 있을 때만 값이 있다. */
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number }>();
  /** 아래가 좁으면 위로 편다. 화면 밖으로 밀려나 안 보이는 것보다 낫다. */
  const [flipped, setFlipped] = useState(false);
  /**
   * 목록을 어디에 그릴지.
   *
   * 보통은 `body` 끝이지만, 시트 안이라면 그 `<dialog>` 안에 그려야 한다.
   * 모달 `<dialog>` 는 브라우저가 «맨 위 층»으로 올려 그리므로, `body` 에 둔 목록은
   * z-index 를 아무리 높여도 시트 뒤로 깔린다.
   *
   * 여는 순간에 정한다 — 그리는 중에 DOM 을 뒤지면 렌더가 순수하지 않다.
   */
  const [host, setHost] = useState<HTMLElement>();

  const selected = options.find((option) => option.value === value);



  // 바깥을 누르면 닫는다. 열려 있을 때만 듣는다.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // 목록은 `body` 끝에 그려져 있어 뿌리 안에 없다. 따로 물어봐야 한다.
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  /*
    그리기 직전에 잰다(`useLayoutEffect`).
    보통 효과로 재면 «자리 없이 한 번» 그려진 뒤 옮겨져, 목록이 왼쪽 위에서 튀어나온다.

    굴림·크기변경은 `capture` 로 듣는다 — 시트 본문처럼 안쪽에서 굴러가는 상자의
    스크롤은 창까지 올라오지 않기 때문이다.
  */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const button = buttonRef.current;
      const list = listRef.current;
      if (!button || !list) return;

      const rect = button.getBoundingClientRect();

      /*
        `fixed` 의 기준점을 실측한다.

        보통은 화면 왼쪽 위가 기준이지만, 조상 중에 `transform` 이 걸린 것이 있으면
        그 상자가 기준이 된다. 시트는 열릴 때 애니메이션으로 `transform` 이 남아 있어,
        화면 좌표를 그대로 넣으면 목록이 엉뚱한 곳에 가서 안 보인다.
        한 번 0,0 에 붙여 보고 그 자리가 화면 어디인지 재면 기준점이 나온다.
      */
      list.style.top = '0px';
      list.style.left = '0px';
      const origin = list.getBoundingClientRect();

      const listHeight = list.offsetHeight;
      const roomBelow = window.innerHeight - rect.bottom;
      const flip = listHeight > 0 && roomBelow < listHeight && rect.top > roomBelow;

      setFlipped(flip);
      setAnchor({
        top: (flip ? rect.top - listHeight - GAP : rect.bottom + GAP) - origin.top,
        left: rect.left - origin.left,
        width: rect.width,
      });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, options.length]);

  /** 목록을 편다. 어디에 그릴지도 이때 정한다. */
  const openMenu = () => {
    setCursor(options.findIndex((option) => option.value === value));
    setHost(buttonRef.current?.closest('dialog') ?? document.body);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((current) => Math.min(current + 1, options.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setCursor(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setCursor(options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(cursor);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn('relative', width === 'full' ? 'w-full min-w-0' : 'shrink-0', className)}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={showLabel ? undefined : label}
        aria-invalid={invalid === true ? true : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          'inline-flex min-h-control-sm w-full items-center gap-xs rounded-control bg-surface-card px-md text-caption surface-outline',
          'transition-colors duration-(--motion-fast) hover:bg-surface-sunken',
          open && 'bg-surface-sunken',
        )}
      >
        {showLabel ? <span className="text-content-muted">{label}</span> : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-start',
            selected === undefined ? 'text-content-subtle' : 'font-semibold text-content',
          )}
        >
          {selected?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          className={cn(
            'size-[1.1em] shrink-0 text-content-subtle transition-transform duration-(--motion-fast)',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && host
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${listId}-${cursor}`}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              style={{
                top: anchor?.top ?? 0,
                left: anchor?.left ?? 0,
                minWidth: anchor?.width ?? 0,
                width: width === 'full' ? anchor?.width : undefined,
                // 자리를 재기 전 한 프레임 동안은 감춰 둔다. 왼쪽 위에서 튀어나오지 않도록.
                visibility: anchor ? 'visible' : 'hidden',
              }}
              className={cn(
                'animate-menu-in fixed z-50 max-h-[16rem] overflow-y-auto',
                'rounded-card bg-surface-card py-2xs shadow-overlay surface-outline',
                flipped ? 'origin-bottom' : 'origin-top',
              )}
            >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isCursor = index === cursor;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                /*
                  화면에는 이름만 보이고 값은 어디에도 드러나지 않는다.
                  점검 스크립트가 「gwangju」 같은 값으로 항목을 짚을 수 있게 붙여 둔다.
                */
                data-value={option.value}
              >
                <button
                  type="button"
                  /*
                    마우스를 올리면 키보드 자리도 함께 옮긴다.
                    안 그러면 마우스로 짚은 곳과 Enter 가 고를 곳이 달라진다.
                  */
                  onPointerEnter={() => setCursor(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    'flex w-full items-center gap-xs whitespace-nowrap px-md py-xs text-start text-caption',
                    'transition-colors duration-(--motion-fast)',
                    isCursor ? 'bg-surface-sunken' : '',
                    isSelected ? 'font-semibold text-brand-text' : 'text-content-muted',
                  )}
                >
                  <Check
                    className={cn('size-[1em] shrink-0', isSelected ? 'text-brand' : 'opacity-0')}
                    aria-hidden
                  />
                  {option.label}
                </button>
              </li>
            );
          })}
            </ul>,
            host,
          )
        : null}
    </div>
  );
}
