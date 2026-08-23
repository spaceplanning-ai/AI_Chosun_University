'use client';

import { Contrast, Moon, Sun, Type } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { PresentationStore } from '../../state/presentationStore';
import { Button } from './Button';

/**
 * 접근성·표시 모드 토글 묶음.
 *
 * "일반 모드 + 큰 글씨·큰 버튼 모드 2종"은 A안 필수 포함 요청 사항이며(피드백 3.2),
 * 그 근거는 "디지털 평등/접근성"이다. 따라서 이 토글은 설정 메뉴 안이 아니라
 * 모든 화면에서 손이 닿는 곳에 상시 노출한다.
 */

export interface AccessibilityControlsProps {
  useStore: PresentationStore;
  /** 고대비 토글 노출 여부. C안 고도화 범위이므로 기본은 숨김. */
  showContrast?: boolean;
  showTheme?: boolean;
  /** 큰 글씨 토글 노출 여부. 관람객용 화면에만 필요하므로 어드민에서는 끈다. */
  showUiMode?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function AccessibilityControls({
  useStore,
  showContrast = false,
  showTheme = true,
  showUiMode = true,
  size = 'sm',
  className,
}: AccessibilityControlsProps) {
  const uiMode = useStore((state) => state.uiMode);
  const theme = useStore((state) => state.theme);
  const contrast = useStore((state) => state.contrast);
  const toggleUiMode = useStore((state) => state.toggleUiMode);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const toggleContrast = useStore((state) => state.toggleContrast);

  const isLarge = uiMode === 'large';

  return (
    <div className={cn('flex items-center gap-xs', className)}>
      {showUiMode ? (
        <Button
          size={size}
          variant={isLarge ? 'accent' : 'quiet'}
          iconLeft={Type}
          onClick={toggleUiMode}
          aria-pressed={isLarge}
        >
          {isLarge ? '일반 글씨로' : '큰 글씨로 보기'}
        </Button>
      ) : null}

      {showTheme ? (
        <Button
          size={size}
          variant="ghost"
          iconOnly
          iconLeft={theme === 'exhibition' ? Sun : Moon}
          onClick={toggleTheme}
          aria-label={theme === 'exhibition' ? '밝은 화면으로 전환' : '전시용 어두운 화면으로 전환'}
        />
      ) : null}

      {showContrast ? (
        <Button
          size={size}
          variant={contrast === 'high' ? 'accent' : 'ghost'}
          iconOnly
          iconLeft={Contrast}
          onClick={toggleContrast}
          aria-pressed={contrast === 'high'}
          aria-label="고대비 화면 전환"
        />
      ) : null}
    </div>
  );
}
