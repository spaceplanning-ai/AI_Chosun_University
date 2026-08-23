/**
 * 이미지 여행카드 (제안서 12.3 선택 개발범위 / 16장 C안).
 *
 * 여행일정을 한 장의 이미지로 그려 저장·공유할 수 있게 한다.
 * 관람객이 전시장을 떠난 뒤에도 남는 결과물이며, SNS로 옮겨졌을 때
 * 광주·전남 연계 여행이라는 메시지를 그대로 실어 나른다.
 *
 * ── 설계 판단 ──────────────────────────────────────────────────────
 * 서버 렌더링이나 외부 이미지 서비스를 쓰지 않고 캔버스에 직접 그린다.
 * 전시 장비가 오프라인으로 동작해야 하고(피드백 [기타]), 관람객 일정이
 * 외부 서버로 나가지 않아야 하기 때문이다.
 *
 * 캔버스는 CSS 변수를 이해하지 못하므로 색을 런타임에 계산된 값으로 읽어 온다.
 * 팔레트를 여기에 복제하지 않으므로 테마를 바꾸면 카드 색도 따라 바뀐다.
 * ──────────────────────────────────────────────────────────────────
 */

import { requireAttraction } from '../data/attractions';
import { REGION_LABELS } from '../domain/labels';
import type { Region } from '../domain/types/catalog';
import { resolveTokenColor } from '../design/tokens';
import { formatClock, formatDuration } from './time';

/**
 * 카드가 실제로 그리는 데 필요한 최소 정보.
 *
 * 전체 `Itinerary` 를 요구하지 않는 이유는 QR로 넘어간 모바일 때문이다.
 * 그쪽에는 추천 근거나 후보 점수가 없고(용량 때문에 관광지 id 만 전송된다),
 * 없는 값을 지어내게 만들면 카드에 가짜 정보가 실릴 수 있다.
 */
export interface TravelCardItinerary {
  title: string;
  subtitle: string;
  days: {
    title: string;
    stops: { attractionId: string; startMinutes: number }[];
  }[];
  metrics: {
    linkageScore: number;
    averageTrust: number;
    travelMinutes: number;
    stopsByRegion: Record<Region, number>;
  };
}

/** 카드 크기. SNS 공유에 무난하고 인쇄해도 깨지지 않는 세로형 비율. */
export const TRAVEL_CARD_SIZE = { width: 1080, height: 1350 } as const;

const PADDING = 72;
const LINE = { title: 62, day: 34, stop: 30 } as const;

/**
 * 방문지 한 줄에 더 줄 수 있는 최대 여백.
 *
 * 카드 크기는 1080×1350 으로 고정한다 — 공유용이라 비율이 흔들리면 안 된다.
 * 그런데 일정 길이는 3곳부터 9곳까지 달라서, 짧은 일정은 아래가 텅 빈다.
 * 남는 높이를 줄 간격에 나눠 주되 이 값을 넘기지 않는다.
 * 넘기면 «여백이 남아서 벌린 것»이 눈에 보여 오히려 엉성해진다.
 */
const MAX_EXTRA_STOP_GAP = 26;

/** 일정 목록과 아래 지표 카드 사이에 반드시 남길 간격. */
const LIST_BOTTOM_MARGIN = 40;

/** 하단 지표 카드의 높이. 목록이 어디까지 내려올 수 있는지 계산할 때도 쓴다. */
const SUMMARY_HEIGHT = 148;

interface CardPalette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  gwangju: string;
  jeonnam: string;
}

/** 현재 테마의 계산된 색을 읽는다. 실패하면 전시 테마 기본값으로 떨어진다. */
function readPalette(): CardPalette {
  return {
    background: resolveTokenColor('surface-page', '#050b16'),
    surface: resolveTokenColor('surface-card', '#0c1b30'),
    text: resolveTokenColor('content', '#ebeff5'),
    muted: resolveTokenColor('content-muted', '#b4becd'),
    accent: resolveTokenColor('accent', '#f2a20c'),
    gwangju: resolveTokenColor('gwangju', '#35b2c0'),
    jeonnam: resolveTokenColor('jeonnam', '#45bb8b'),
  };
}

/**
 * 긴 제목을 폭에 맞춰 줄바꿈한다.
 *
 * 한국어는 띄어쓰기(어절)가 곧 읽기 단위다. 글자 단위로 끊으면
 * 「부모님과」가 "부 / 모님과" 로 갈라져 순간적으로 다른 말처럼 읽힌다.
 * 화면 쪽은 CSS `word-break: keep-all` 이 막아 주지만 캔버스에는 적용되지 않으므로
 * 여기서 같은 규칙을 직접 구현한다.
 *
 * 어절 하나가 한 줄보다 긴 예외(긴 영문 낱말 등)에서만 글자 단위로 잘라 넘친 글자를 막는다.
 */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const fits = (value: string) => context.measureText(value).width <= maxWidth;

  /** 한 줄보다 긴 어절을 글자 단위로 쪼갠다. */
  function splitOversized(word: string): string[] {
    const parts: string[] = [];
    let piece = '';
    for (const character of word) {
      if (piece.length > 0 && !fits(piece + character)) {
        parts.push(piece);
        piece = character;
      } else {
        piece += character;
      }
    }
    if (piece.length > 0) parts.push(piece);
    return parts;
  }

  const lines: string[] = [];
  let current = '';

  const commit = () => {
    if (current.length > 0) lines.push(current);
    current = '';
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }

    commit();
    if (lines.length >= maxLines) return lines.slice(0, maxLines);

    if (fits(word)) {
      current = word;
      continue;
    }

    // 어절 자체가 한 줄을 넘는 경우에만 글자 단위로 내려간다.
    const pieces = splitOversized(word);
    for (const piece of pieces.slice(0, -1)) {
      lines.push(piece);
      if (lines.length >= maxLines) return lines.slice(0, maxLines);
    }
    current = pieces.at(-1) ?? '';
  }

  commit();
  return lines.slice(0, maxLines);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export interface TravelCardOptions {
  itinerary: TravelCardItinerary;
  /** 하단에 표시할 안내 문구. 전시 현장에 따라 바꿀 수 있다. */
  footnote?: string;
  fontFamily?: string;
}

/**
 * 여행카드를 캔버스에 그린다.
 * 반환된 캔버스는 호출 측에서 이미지로 내보내거나 화면에 그대로 붙일 수 있다.
 */
export function drawTravelCard(
  canvas: HTMLCanvasElement,
  { itinerary, footnote, fontFamily }: TravelCardOptions,
): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('캔버스 2D 컨텍스트를 만들 수 없습니다.');

  const { width, height } = TRAVEL_CARD_SIZE;
  canvas.width = width;
  canvas.height = height;

  const palette = readPalette();
  const family =
    fontFamily ??
    (typeof window === 'undefined'
      ? 'sans-serif'
      : window.getComputedStyle(document.body).fontFamily || 'sans-serif');

  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);

  // 상단 프리즘 띠 — 두 지역이 하나의 여정으로 이어진다는 브랜드 메시지
  const band = context.createLinearGradient(0, 0, width, 0);
  band.addColorStop(0, palette.gwangju);
  band.addColorStop(1, palette.jeonnam);
  context.fillStyle = band;
  context.fillRect(0, 0, width, 12);

  let cursorY = PADDING + 40;

  context.fillStyle = palette.accent;
  context.font = `600 30px ${family}`;
  context.fillText('AI 남도 프리즘', PADDING, cursorY);

  cursorY += 26;
  context.fillStyle = palette.muted;
  context.font = `400 26px ${family}`;
  context.fillText('설명가능 AI 관광 큐레이션', PADDING, cursorY);

  // 제목
  cursorY += 76;
  context.fillStyle = palette.text;
  context.font = `700 54px ${family}`;
  for (const line of wrapText(context, itinerary.title, width - PADDING * 2, 3)) {
    context.fillText(line, PADDING, cursorY);
    cursorY += LINE.title;
  }

  cursorY += 8;
  context.fillStyle = palette.muted;
  context.font = `400 28px ${family}`;
  context.fillText(itinerary.subtitle, PADDING, cursorY);

  /*
    일정 목록을 그리기 전에 «얼마나 남는가»를 먼저 잰다.
    고정 높이 카드라 짧은 일정은 아래가 비고, 긴 일정은 빠듯하다.
    남는 만큼만 줄 간격에 나눠 주면 두 경우 모두 같은 코드로 처리된다.
  */
  const stopCount = itinerary.days.reduce((total, day) => total + day.stops.length, 0);
  const listTop = cursorY + 66;
  const listBottom = height - PADDING - SUMMARY_HEIGHT - 52 - LIST_BOTTOM_MARGIN;
  const baseListHeight =
    itinerary.days.length * (LINE.day + 10 + 16) + stopCount * (LINE.stop + 12);
  const extraStopGap =
    stopCount === 0
      ? 0
      : Math.max(
          0,
          Math.min(MAX_EXTRA_STOP_GAP, (listBottom - listTop - baseListHeight) / stopCount),
        );

  // 일자별 일정
  cursorY += 66;
  for (const day of itinerary.days) {
    context.fillStyle = palette.accent;
    context.font = `700 32px ${family}`;
    context.fillText(day.title, PADDING, cursorY);
    cursorY += LINE.day + 10;

    for (const stop of day.stops) {
      const attraction = requireAttraction(stop.attractionId);

      // 지역 표시 점
      context.fillStyle = attraction.region === 'gwangju' ? palette.gwangju : palette.jeonnam;
      context.beginPath();
      context.arc(PADDING + 8, cursorY - 9, 7, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = palette.muted;
      context.font = `500 26px ${family}`;
      context.fillText(formatClock(stop.startMinutes), PADDING + 30, cursorY);

      context.fillStyle = palette.text;
      context.font = `600 30px ${family}`;
      context.fillText(attraction.name, PADDING + 130, cursorY);

      cursorY += LINE.stop + 12 + extraStopGap;
    }
    cursorY += 16;
  }

  // 하단 지표 카드
  const summaryY = height - PADDING - SUMMARY_HEIGHT - 52;
  context.fillStyle = palette.surface;
  roundedRect(context, PADDING, summaryY, width - PADDING * 2, SUMMARY_HEIGHT, 24);
  context.fill();

  const metrics: [string, string][] = [
    ['초광역 연계지수', `${itinerary.metrics.linkageScore}점`],
    ['정보 신뢰도', `${itinerary.metrics.averageTrust}점`],
    ['총 이동시간', formatDuration(itinerary.metrics.travelMinutes)],
    [
      '방문지',
      `${REGION_LABELS.gwangju} ${itinerary.metrics.stopsByRegion.gwangju} · ${REGION_LABELS.jeonnam} ${itinerary.metrics.stopsByRegion.jeonnam}`,
    ],
  ];

  const columnWidth = (width - PADDING * 2) / metrics.length;
  metrics.forEach(([label, value], index) => {
    const columnX = PADDING + columnWidth * index + 28;
    context.fillStyle = palette.muted;
    context.font = `400 22px ${family}`;
    context.fillText(label, columnX, summaryY + 52);

    context.fillStyle = index === 0 ? palette.accent : palette.text;
    context.font = `700 32px ${family}`;
    context.fillText(value, columnX, summaryY + 98);
  });

  context.fillStyle = palette.muted;
  context.font = `400 22px ${family}`;
  context.fillText(
    footnote ?? '공식 관광자료를 근거로 생성된 일정입니다. 방문 전 운영시간을 확인해 주세요.',
    PADDING,
    height - PADDING + 8,
  );
}

/** 카드를 PNG Blob 으로 내보낸다. */
export async function toTravelCardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지를 만들지 못했습니다.'));
    }, 'image/png');
  });
}

/** 파일명에 쓸 수 있도록 제목을 다듬는다. */
export function travelCardFilename(itinerary: TravelCardItinerary): string {
  const safeTitle = itinerary.title.replaceAll(/[\\/:*?"<>|]/g, '').slice(0, 40);
  return `남도프리즘_${safeTitle}.png`;
}

/**
 * 줄바꿈 규칙만 따로 꺼내 검사할 수 있게 열어 둔다.
 * 캔버스가 없는 환경에서도 「어절을 쪼개지 않는다」는 규칙을 테스트가 지킨다.
 */
export const wrapTextForTest = wrapText;
