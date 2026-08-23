'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { loadPostcode, type PostcodeResult } from '../../lib/postcode';
import { Button } from './Button';
import { Callout } from './Callout';
import { FieldFrame, ReadonlyValue, TextField, type FieldFrameProps } from './Form';
import { Sheet } from './Sheet';

/**
 * 주소 칸.
 *
 * ── 왜 눌러서 고르게 하는가 ────────────────────────────────────────
 * 주소는 손으로 치면 표기가 사람마다 갈린다 —「광주광역시 동구」·「광주 동구」·
 * 「광주시 동구」. 관광지 자료는 소재지 표기로 지역 분포를 나누므로 표기가
 * 흔들리면 「관리」의 분포와 권역이 함께 흔들린다. 골라서 넣으면 한 벌로 맞는다.
 *
 * ── 인터넷이 끊기면 ────────────────────────────────────────────────
 * 우편번호 서비스는 외부에서 내려받는다. 못 불러오면 창 안에서 직접 적을 수 있게
 * 길을 열어 둔다 — 주소 하나 때문에 관광지 등록 자체가 막히면 안 된다.
 */

export interface AddressFieldProps extends Omit<FieldFrameProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  /**
   * 주소를 고른 직후 원본 값을 함께 넘긴다.
   * 시·도와 시·군·구가 들어 있어 소재지·지역을 같이 채울 때 쓴다.
   */
  onSelect?: (result: PostcodeResult) => void;
  placeholder?: string;
  /** 조회 상태. 값만 보여 주고 창을 열지 않는다. */
  readOnly?: boolean;
}

export function AddressField({
  value,
  onChange,
  onSelect,
  placeholder = '눌러서 주소 찾기',
  readOnly = false,
  ...frame
}: AddressFieldProps) {
  const [open, setOpen] = useState(false);
  /** 우편번호 서비스를 못 불러왔을 때의 사유. 있으면 직접 입력으로 바뀐다. */
  const [failure, setFailure] = useState<string>();
  const [typed, setTyped] = useState('');

  const hostRef = useRef<HTMLDivElement>(null);
  /*
    콜백을 상자에 담아 둔다.
    부모가 다시 그릴 때마다 새 함수가 오는데, 그걸 효과가 지켜보면
    우편번호 창이 매번 처음부터 다시 그려져 고르던 중에 화면이 튄다.
  */
  const callbacks = useRef({ onChange, onSelect });
  useEffect(() => {
    callbacks.current = { onChange, onSelect };
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    loadPostcode()
      .then((Postcode) => {
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.replaceChildren();
        new Postcode({
          width: '100%',
          height: '100%',
          oncomplete: (result) => {
            // 도로명이 없는 곳도 있다. 그럴 때는 지번으로 갈음한다.
            callbacks.current.onChange(result.roadAddress || result.jibunAddress);
            callbacks.current.onSelect?.(result);
            setOpen(false);
          },
        }).embed(host, { autoClose: false });
      })
      .catch((error: Error) => {
        if (!cancelled) setFailure(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (readOnly) {
    return (
      <FieldFrame {...frame} as="div">
        <ReadonlyValue>{value}</ReadonlyValue>
      </FieldFrame>
    );
  }

  return (
    <FieldFrame {...frame} as="div">
      <button
        type="button"
        aria-label={frame.label}
        onClick={() => {
          setTyped(value);
          // 지난번에 못 불러왔더라도 다시 시도한다 — 그새 인터넷이 붙었을 수 있다.
          setFailure(undefined);
          setOpen(true);
        }}
        className={cn(
          'inline-flex min-h-control-sm w-full items-center gap-xs rounded-control bg-surface-card px-md text-caption surface-outline',
          'transition-colors duration-(--motion-fast) hover:bg-surface-sunken',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-start',
            value.length === 0 ? 'text-content-subtle' : 'text-content',
          )}
        >
          {value.length === 0 ? placeholder : value}
        </span>
        <Search className="size-[1.1em] shrink-0 text-content-subtle" aria-hidden />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="주소 찾기"
        description="도로명·지번·건물명 무엇으로 찾아도 됩니다."
        placement="center"
        footer={
          failure === undefined ? undefined : (
            <span className="flex justify-end gap-sm">
              <Button variant="quiet" onClick={() => setOpen(false)}>
                닫기
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  onChange(typed.trim());
                  setOpen(false);
                }}
              >
                이 주소로 넣기
              </Button>
            </span>
          )
        }
      >
        {failure === undefined ? (
          /* 우편번호 창이 들어앉을 자리. 높이를 미리 잡아 두어야 열릴 때 덜컹거리지 않는다. */
          <div ref={hostRef} className="h-[26rem] w-full" />
        ) : (
          <div className="flex flex-col gap-md">
            <Callout tone="caution" size="sm">
              {failure} 인터넷이 끊겨 있으면 주소 찾기를 쓸 수 없습니다. 아래에 직접 적어 주세요.
            </Callout>
            <TextField
              label="주소 직접 입력"
              hint="다른 관광지와 표기를 맞춰 주세요"
              value={typed}
              onChange={setTyped}
            />
          </div>
        )}
      </Sheet>
    </FieldFrame>
  );
}
