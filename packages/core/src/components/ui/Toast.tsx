'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * 작업이 끝났음을 알리는 짧은 알림.
 *
 * ── 왜 화면 아래 가운데인가 ────────────────────────────────────────
 * 방금 누른 버튼은 대개 화면 위쪽이나 오른쪽에 있다. 알림을 그 근처에 띄우면
 * 손이나 커서에 가려진다. 아래 가운데는 어느 버튼을 눌렀든 시선이 닿고,
 * 표나 폼을 가리지 않는다.
 *
 * ── 왜 스스로 사라지는가 ───────────────────────────────────────────
 * 「저장했습니다」는 읽고 나면 쓸모가 없다. 닫기 버튼을 두면 지우는 일이
 * 사람 몫으로 남아, 쌓인 알림이 화면을 덮는다.
 *
 * 다만 스크린리더에는 사라지기 전에 읽혀야 하므로 `role="status"` 로 알린다.
 * 오류는 `alert` 로 올려 하던 일을 끊고 먼저 읽게 한다.
 */

export type ToastTone = 'positive' | 'critical' | 'neutral';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

/** 알림이 머무는 시간. 한 문장을 읽고도 남을 만큼만 둔다. */
const TOAST_MS = 2600;

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | undefined>(
  undefined,
);

const TONE_CLASS: Record<ToastTone, string> = {
  positive: 'bg-positive-soft text-positive',
  critical: 'bg-critical-soft text-critical',
  neutral: 'bg-surface-inverse text-surface-page',
};

const TONE_ICON = {
  positive: CircleCheck,
  critical: TriangleAlert,
  neutral: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  /** 알림마다 다른 키를 준다. 같은 문구를 잇달아 띄워도 각각 사라진다. */
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'positive') => {
    const id = (nextId.current += 1);
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, TOAST_MS);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        `pointer-events-none` 을 둔 이유 — 알림이 떠 있는 동안에도
        그 아래 버튼을 누를 수 있어야 한다. 알림은 알릴 뿐 막지 않는다.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-xl z-50 flex flex-col items-center gap-xs px-lg">
        {items.map((item) => {
          const Icon = TONE_ICON[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === 'critical' ? 'alert' : 'status'}
              className={cn(
                'animate-toast-in flex max-w-full items-center gap-xs rounded-pill px-lg py-sm',
                'text-caption font-semibold shadow-overlay',
                TONE_CLASS[item.tone],
              )}
            >
              <Icon className="size-[1.2em] shrink-0" aria-hidden />
              <span className="min-w-0">{item.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * 알림을 띄운다.
 *
 * 공급자 밖에서 부르면 아무 일도 하지 않는다 — 알림 하나 때문에
 * 화면이 통째로 죽는 편보다 조용히 넘어가는 편이 낫다.
 */
export function useToast(): (message: string, tone?: ToastTone) => void {
  const show = useContext(ToastContext);
  return show ?? (() => {});
}
