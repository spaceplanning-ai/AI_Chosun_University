import { cn } from '../../lib/cn';
import type { AttractionMotif, Region } from '../../domain/types/catalog';

/**
 * 관광지 시각 모티프.
 *
 * 사진 라이선스가 확보되기 전에도 전시 화면이 "빈 회색 상자"로 보이면 안 된다
 * (제안서 18.5 — 기능은 되는데 일반 웹사이트처럼 보이는 위험).
 * 그래서 관광지마다 지정된 모티프를 결정적으로 렌더링한다.
 *
 * 색은 지역 토큰에서 가져오므로 전시/밝은 테마 전환에 그대로 따라온다.
 * 실사진이 확보되면 이 컴포넌트를 `<img>` 로 교체하는 것만으로 끝난다.
 */

const VIEW_BOX = '0 0 160 96';

const MOTIF_SHAPES: Record<AttractionMotif, React.ReactNode> = {
  city: (
    <>
      <rect x="14" y="44" width="22" height="52" rx="2" opacity="0.55" />
      <rect x="42" y="28" width="26" height="68" rx="2" opacity="0.8" />
      <rect x="74" y="52" width="20" height="44" rx="2" opacity="0.45" />
      <rect x="100" y="34" width="24" height="62" rx="2" opacity="0.7" />
      <rect x="130" y="58" width="18" height="38" rx="2" opacity="0.4" />
      <circle cx="121" cy="20" r="7" className="text-accent" fill="currentColor" />
    </>
  ),
  art: (
    <>
      <circle cx="58" cy="48" r="30" opacity="0.55" />
      <circle cx="94" cy="48" r="30" opacity="0.4" />
      <path d="M28 82 Q80 24 132 82" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.8" />
      <circle cx="76" cy="48" r="8" className="text-accent" fill="currentColor" />
    </>
  ),
  forest: (
    <>
      <path d="M40 88 L24 52 L56 52 Z" opacity="0.75" />
      <path d="M40 62 L28 34 L52 34 Z" opacity="0.85" />
      <path d="M104 88 L84 44 L124 44 Z" opacity="0.55" />
      <path d="M104 54 L90 22 L118 22 Z" opacity="0.7" />
      <rect x="37" y="80" width="6" height="16" opacity="0.9" />
      <rect x="101" y="80" width="6" height="16" opacity="0.7" />
    </>
  ),
  sea: (
    <>
      <path d="M0 58 Q26 44 52 58 T104 58 T160 58 V96 H0 Z" opacity="0.45" />
      <path d="M0 72 Q30 58 60 72 T120 72 T160 72 V96 H0 Z" opacity="0.7" />
      <circle cx="126" cy="26" r="12" className="text-accent" fill="currentColor" opacity="0.85" />
    </>
  ),
  field: (
    <>
      <path d="M0 68 Q40 40 84 62 T160 52 V96 H0 Z" opacity="0.7" />
      <path d="M0 82 Q48 62 96 80 T160 74 V96 H0 Z" opacity="0.45" />
      <circle cx="34" cy="26" r="13" className="text-accent" fill="currentColor" opacity="0.9" />
    </>
  ),
  heritage: (
    <>
      <path d="M18 44 L80 16 L142 44 Z" opacity="0.8" />
      <rect x="34" y="46" width="92" height="8" rx="2" opacity="0.6" />
      <rect x="44" y="56" width="12" height="40" opacity="0.7" />
      <rect x="74" y="56" width="12" height="40" opacity="0.7" />
      <rect x="104" y="56" width="12" height="40" opacity="0.7" />
      <rect x="30" y="88" width="100" height="8" rx="2" opacity="0.5" />
    </>
  ),
  food: (
    <>
      <path d="M30 52 H130 A50 50 0 0 1 30 52 Z" opacity="0.75" />
      <rect x="22" y="84" width="116" height="8" rx="4" opacity="0.5" />
      <path
        d="M62 40 q8 -10 0 -20 M80 38 q8 -12 0 -24 M98 40 q8 -10 0 -20"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="text-accent"
        opacity="0.9"
      />
    </>
  ),
  night: (
    <>
      <path d="M0 62 Q40 52 80 62 T160 62 V96 H0 Z" opacity="0.6" />
      <path
        d="M118 34 a16 16 0 1 1 -13 -15.6 a13 13 0 0 0 13 15.6 Z"
        className="text-accent"
        fill="currentColor"
      />
      <path d="M96 72 h44 M104 80 h28" stroke="currentColor" strokeWidth="3" opacity="0.5" />
    </>
  ),
};

const REGION_CLASS: Record<Region, string> = {
  gwangju: 'text-gwangju-mark bg-gwangju-soft',
  jeonnam: 'text-jeonnam-mark bg-jeonnam-soft',
};

export interface AttractionMotifArtProps {
  motif: AttractionMotif;
  region: Region;
  className?: string;
}

export function AttractionMotifArt({ motif, region, className }: AttractionMotifArtProps) {
  return (
    <svg
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden
      className={cn('block h-full w-full', REGION_CLASS[region], className)}
      fill="currentColor"
    >
      {MOTIF_SHAPES[motif]}
    </svg>
  );
}
