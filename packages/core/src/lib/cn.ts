import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * 프로젝트 전용 토큰 스케일을 tailwind-merge 에 등록한다.
 * 등록하지 않으면 `p-md` 와 `p-lg` 가 서로 충돌하는 클래스임을 인식하지 못해
 * 두 클래스가 함께 남고, 호출자가 의도한 값이 아니라 CSS 선언 순서가 승자를 정하게 된다.
 * 토큰을 추가할 때는 Layer 1/2(CSS)와 이 목록을 함께 갱신한다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        '2xs',
        'xs',
        'sm',
        'md',
        'lg',
        'xl',
        '2xl',
        'control-sm',
        'control-md',
        'control-lg',
        'stage',
      ],
      text: ['display', 'title', 'heading', 'subhead', 'body', 'label', 'caption', 'micro'],
      radius: ['control', 'card', 'panel', 'pill'],
      shadow: ['card', 'raised', 'overlay', 'glow'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
