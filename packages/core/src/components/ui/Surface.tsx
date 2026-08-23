import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * 면(surface) 계열 프리미티브 — Card / Panel / Divider.
 * 상호작용이 없으므로 서버 컴포넌트에서도 그대로 쓸 수 있다.
 */

export type CardElevation = 'flat' | 'card' | 'raised';

const ELEVATION_CLASS: Record<CardElevation, string> = {
  flat: 'bg-surface-card',
  card: 'bg-surface-card shadow-card',
  raised: 'bg-surface-raised shadow-raised',
};

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-sm',
  md: 'p-md',
  lg: 'p-lg',
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  elevation?: CardElevation;
  padding?: CardPadding;
  outlined?: boolean;
  children?: ReactNode;
}

export function Card({
  as: Component = 'div',
  elevation = 'card',
  padding = 'md',
  outlined = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cn(
        'rounded-card',
        ELEVATION_CLASS[elevation],
        PADDING_CLASS[padding],
        outlined && 'surface-outline',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface PanelProps extends Omit<CardProps, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** 제목 + 설명 + 우측 액션을 갖춘 구역. 연구자 화면의 표를 감싸는 데 주로 쓴다. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  padding = 'lg',
  ...rest
}: PanelProps) {
  return (
    <Card padding={padding} className={cn('rounded-panel', className)} {...rest}>
      {/* 설명만 넘겨도 그린다. 제목 없이 설명만 두는 판이 있는데 조용히 사라졌었다. */}
      {(title || description || action) && (
        <header className="mb-md flex items-start justify-between gap-md">
          <div className="min-w-0">
            {title ? <h2 className="text-heading font-bold text-content">{title}</h2> : null}
            {description ? (
              <p className="mt-2xs text-caption text-content-muted">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      {children}
    </Card>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('my-md border-0 border-t border-line-subtle', className)} />;
}
