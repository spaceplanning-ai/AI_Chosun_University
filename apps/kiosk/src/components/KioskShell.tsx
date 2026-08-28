'use client';

import { useCallback, useState, type ReactNode } from 'react';
import {
  KIOSK_DEPLOYMENT,
  RESEARCHER_UNLOCK_TAPS,
  RESEARCHER_UNLOCK_WINDOW_MS,
} from '@namdo-prism/core/config';
import { House } from 'lucide-react';
import { AccessibilityControls, Button } from '@namdo-prism/core/ui';
import { KioskClock } from '@/components/KioskClock';
import { cn } from '@namdo-prism/core/lib';
import { usePresentation } from '@/state/presentation';

/**
 * 키오스크 외곽 프레임.
 *
 * 세로형 대형 화면을 전제로 하되, 개발용 가로 모니터에서도 같은 비율로 보이도록
 * 중앙에 고정폭 무대(stage)를 둔다. 상단 브랜드 패널과 하단 접근성 버튼은
 * 모든 단계에서 자리를 지킨다 — 큰 글씨 전환은 화면 어디서나 가능해야 한다.
 */

export interface KioskShellProps {
  children: ReactNode;
  /** 좌상단 로고를 연속 터치하면 열리는 숨은 동작. 진행자용 시나리오 패널을 연다. */
  onResearcherUnlock?: () => void;
  footer?: ReactNode;
  /**
   * 본문 폭 제한을 풀지 여부.
   *
   * 읽는 화면(질문·일정)은 한 줄이 너무 길면 눈이 줄을 놓치므로 `--stage-max-width` 로 묶는다.
   * 반면 대기화면의 안내도는 **멀리서 보는 그림**이라 같은 제한을 걸면 화면 절반이 빈다.
   * 성격이 다른 두 화면을 같은 폭에 밀어 넣지 않으려고 예외를 둔다.
   */
  fullWidth?: boolean;
  /**
   * 처음으로 돌아가는 길.
   *
   * 주면 머리말 왼쪽에 단추가 선다. 대기화면처럼 이미 처음인 자리에서는 주지 않는다.
   * 무인정보단말기 UI 가이드는 «과업 진행 중 처음화면으로 가기 위한 컨트롤»을 상단 좌측에
   * 두라고 정한다 — 도중에 그만두려는 사람에게 「이전」을 다섯 번 누르라고 할 수는 없다.
   */
  onHome?: () => void;
}

export function KioskShell({
  children,
  onResearcherUnlock,
  footer,
  fullWidth = false,
  onHome,
}: KioskShellProps) {
  // 연속 터치 상태는 렌더에 영향을 주지 않으므로 setter 만 쓴다.
  const [, setTapState] = useState({ count: 0, firstTapAt: 0 });

  const handleBrandTap = useCallback(() => {
    if (!onResearcherUnlock) return;
    const now = Date.now();
    setTapState((previous) => {
      const withinWindow = now - previous.firstTapAt < RESEARCHER_UNLOCK_WINDOW_MS;
      const count = withinWindow ? previous.count + 1 : 1;
      if (count >= RESEARCHER_UNLOCK_TAPS) {
        onResearcherUnlock();
        return { count: 0, firstTapAt: 0 };
      }
      return { count, firstTapAt: withinWindow ? previous.firstTapAt : now };
    });
  }, [onResearcherUnlock]);

  return (
    /*
      화면 높이에 «딱» 맞춘다.

      `min-h-svh` 는 «적어도 화면만큼»이라 안쪽 내용이 크면 그만큼 자란다.
      키오스크는 스크롤이 없어(`overflow: hidden`) 자란 만큼이 그대로 화면 밖으로 잘린다 —
      지도 아래쪽과 버튼이 사라지던 까닭이 이것이다.
      높이를 못 박아야 안쪽의 `flex-1 min-h-0` 들이 남는 높이를 나눠 갖는다.
    */
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-md px-lg py-md">
        <div className="flex items-center gap-md">
        <button
          type="button"
          onClick={handleBrandTap}
          className="flex items-center gap-sm text-left"
          aria-label="AI 남도 프리즘"
        >
          <span className="grid size-[2.4rem] place-items-center rounded-control bg-prism" aria-hidden>
            <span className="size-[0.9rem] rounded-pill bg-surface-page" />
          </span>
          <span>
            <span className="block text-subhead font-bold text-content">AI 남도 프리즘</span>
          </span>
        </button>

        {/*
          처음으로.

          지침이 상단 «좌측»으로 못 박은 자리다. 도중에 그만두려는 사람이 가장 먼저
          눈을 두는 곳이고, 오른쪽 접근성 조작부와 섞이지 않는다.
        */}
        {onHome ? (
          <Button variant="ghost" size="sm" iconLeft={House} onClick={onHome}>
            처음으로
          </Button>
        ) : null}
        </div>

        <div className="flex items-center gap-sm">
          <KioskClock />
          {/*
            큰 글씨와 고대비를 관람객이 직접 켠다.

            고대비는 만들어 두고도 화면에서 켤 수 없었다 — 지침은 «고대비 화면을 제공하며
            사용자가 이를 쉽게 활성화할 수 있도록» 정한다. 색 조합은 대비검사(npm run contrast)가
            일반·고대비 네 조합 모두 기준을 넘는 것으로 확인한 값이다.

            테마(밝은/어두운)는 감춘다. 접근성 요구가 아니고, 전시장에서 관람객이 화면 색을
            바꿀 이유가 없다. 켜 둔 채 떠나도 다음 사람이 이어받지 않도록, 대기화면으로
            돌아갈 때 표시 모드를 기본으로 되돌린다(page.tsx).
          */}
          <AccessibilityControls useStore={usePresentation} showTheme={false} showContrast />
        </div>
      </header>

      <main
        className={cn(
          'mx-auto flex w-full min-h-0 flex-1 flex-col px-lg pb-lg',
          fullWidth ? 'max-w-none' : 'max-w-stage',
        )}
      >
        {children}
      </main>

      <footer className="border-t border-line-subtle px-lg py-sm">
        {footer ?? (
          <p className="text-micro text-content-subtle">
            {KIOSK_DEPLOYMENT.label} · 개인정보를 수집하지 않으며, 익명 이용기록만 연구 목적으로
            저장됩니다.
          </p>
        )}
      </footer>
    </div>
  );
}
