'use client';

import {
  DISTRICT_VIEW,
  GWANGJU_DISTRICTS,
  districtAttractions,
  districtIntensity,
  type GwangjuDistrict,
} from '../../data/gwangjuDistricts';
import { cn } from '../../lib/cn';

/**
 * 광주광역시 자치구 안내도 (대기화면) — 입체 안내판.
 *
 * 관공서·금융권 안내 키오스크의 층별 안내도를 따랐다. 화려한 연출 대신
 * **어디를 누르면 무엇이 나오는지**가 한눈에 보이는 것이 목적이다.
 *
 * ── 왜 입체인가 ────────────────────────────────────────────────────
 * 터치 화면에서는 «누를 수 있는 것»이 평면 위에 그냥 칠해져 있으면 그림으로 읽힌다.
 * 두께가 있으면 손가락으로 누를 물건처럼 보이고, 고른 구가 **위로 솟는** 것으로
 * 선택이 색이 아니라 형태로도 전달된다 — 색각 이상이나 강한 조명 아래에서도 남는 단서다.
 *
 * 지도 라이브러리는 쓰지 않는다. 전시장이 오프라인이라 타일을 받을 수 없다.
 * 대신 SVG 좌표를 눌러 «비스듬히 본 판»을 만들고, 같은 도형을 아래로 여러 겹 깔아 두께를 낸다.
 *
 * ── 왜 회전하지 않고 눌렀는가 ──────────────────────────────────────
 * 45° 회전한 정통 아이소메트릭은 북쪽이 화면 위가 아니게 되어, 실제 지리를 아는 사람이
 * 방향을 잃는다. 그래서 방위는 그대로 두고 세로만 눌러 «앞에서 비스듬히 내려다본» 형태로 만든다.
 * ──────────────────────────────────────────────────────────────────
 */

const INTENSITY_FILL = [
  'var(--map-district-0)',
  'var(--map-district-1)',
  'var(--map-district-2)',
  'var(--map-district-3)',
] as const;

/**
 * 단계별 글자색.
 *
 * 채우기가 진해질수록 글자는 밝아져야 한다. 그런데 «몇 번째 단계부터 뒤집을지»는
 * 테마마다 다르다 — 밝은 테마는 흰색에서 검정으로 내려가고, 전시 테마는 그 반대다.
 * 그래서 뒤집는 지점을 컴포넌트가 아니라 토큰이 정하게 두었다.
 */
const INTENSITY_INK = [
  'var(--map-ink-0)',
  'var(--map-ink-1)',
  'var(--map-ink-2)',
  'var(--map-ink-3)',
] as const;

/** 입체 표현 상수 (viewBox 단위). */
const SOLID = {
  /** 세로 눌림. 1이면 평면, 작을수록 더 비스듬히 내려다본 모습. */
  tilt: 0.72,
  /** 판의 두께. */
  depth: 3.4,
  /** 두께를 몇 겹으로 나눠 그릴지. 겹이 적으면 옆면에 계단이 보인다. */
  layers: 7,
  /** 고른 구가 솟아오르는 높이. 옆면 길이(생성 스크립트의 WALL_DEPTH)와 짝을 이룬다. */
  raise: 4.5,
} as const;

/**
 * 솟아오르는 동작.
 *
 * 살짝 넘쳤다가 제자리로 돌아오는 곡선을 쓴다. 감속만 하면 «밀어 올린» 느낌이고,
 * 조금 넘치면 «튀어 올랐다 앉는» 물체로 읽힌다 — 손으로 눌렀다는 반응이 분명해진다.
 * 움직임을 줄이도록 설정한 장비에서는 전환을 아예 끈다.
 */
const RISE_CLASS =
  'transition-transform duration-(--motion-normal) ease-spring motion-reduce:transition-none';

/**
 * 등장 지연. 뒤쪽 구부터 차례로 내려앉아 «판이 조립되는» 것처럼 보인다.
 * 한꺼번에 나타나면 그냥 화면이 켜진 것과 구분되지 않는다.
 */
const ENTRANCE_STEP_MS = 70;

/** 눌린 판의 회전축. 화면 한가운데를 기준으로 눌러야 위아래가 고르게 줄어든다. */
const PIVOT_Y = DISTRICT_VIEW.height / 2;

/** 원래 좌표의 y 를 «눌린 판» 위의 y 로 옮긴다. 글자를 판 위에 정확히 얹기 위해 필요하다. */
function toPlateY(y: number): number {
  return PIVOT_Y + (y - PIVOT_Y) * SOLID.tilt;
}

/** 안내 말풍선 치수 (viewBox 단위). */
const TOOLTIP = {
  width: 54,
  /** 이름표와의 간격. 꼬리가 뻗을 자리이기도 하다. */
  gap: 7,
  padding: 3,
  radius: 2.2,
  /** 꼬리 — 밑변 절반과 길이. */
  tail: { half: 2.4, length: 2.6 },
  titleLine: 5.6,
  dividerGap: 2.2,
  bodyLine: 4,
  itemLine: 4,
  /** 한 줄에 들어가는 대략의 글자 수. 줄 수를 세어 상자 높이를 잡는 데 쓴다. */
  charsPerLine: 24,
} as const;

/**
 * 안내 말풍선의 높이를 내용에서 계산한다.
 *
 * 고정 높이로 두면 설명이 길거나 자원이 많은 구에서 **글자가 상자 밖으로 잘린다.**
 * foreignObject 는 넘친 내용을 잘라 내기 때문에, 잘린 줄은 화면에서 아예 사라진다.
 */
function tooltipHeightFor(summary: string, itemCount: number): number {
  const summaryLines = Math.max(1, Math.ceil(summary.length / TOOLTIP.charsPerLine));
  return (
    TOOLTIP.padding * 2 +
    TOOLTIP.titleLine +
    TOOLTIP.dividerGap +
    summaryLines * TOOLTIP.bodyLine +
    (itemCount > 0 ? TOOLTIP.dividerGap + itemCount * TOOLTIP.itemLine : 0) +
    // 줄 수 추정은 근사치다. 모자라면 글자가 잘리므로 아주 조금 여유를 둔다.
    0.8
  );
}

/** 말풍선이 기준점의 어느 쪽에 놓였는지. 꼬리를 붙일 변을 정한다. */
type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * 꼬리 삼각형.
 *
 * 말풍선이 «어느 구의 안내인지»를 형태로 말해 준다. 색이나 위치만으로는
 * 여러 구가 붙어 있는 자리에서 어느 쪽을 누른 것인지 헷갈린다.
 * 꼭짓점은 기준점 쪽을 향하고, 밑변은 상자 변에 붙어 테두리에 가려진다.
 */
function tailPath(box: Box, side: TooltipSide, anchorX: number, anchorY: number): string {
  const { half, length } = TOOLTIP.tail;
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  if (side === 'top' || side === 'bottom') {
    // 상자의 가로 범위 안에서 기준점에 가장 가까운 지점에 꼬리를 붙인다.
    const x = clamp(anchorX, box.x + half + 1, box.x + box.width - half - 1);
    const baseY = side === 'top' ? box.y + box.height : box.y;
    const tipY = side === 'top' ? baseY + length : baseY - length;
    return `M${x - half} ${baseY}L${x} ${tipY}L${x + half} ${baseY}Z`;
  }

  const y = clamp(anchorY, box.y + half + 1, box.y + box.height - half - 1);
  const baseX = side === 'left' ? box.x + box.width : box.x;
  const tipX = side === 'left' ? baseX + length : baseX - length;
  return `M${baseX} ${y - half}L${tipX} ${y}L${baseX} ${y + half}Z`;
}

/**
 * 이름표 한 덩이가 차지하는 대략의 크기. 가림 여부를 재는 데만 쓴다.
 *
 * 기준점은 구 이름의 **글자 기준선**이라, 이름은 기준선 위로 올라가고 자원 수는 아래에 붙는다.
 * 그래서 상자를 기준점 가운데에 두면 실제보다 작게 잡혀, 살짝 걸치는 겹침을 놓친다.
 */
const LABEL_BOX = { width: 26, height: 15, centerOffsetY: 1.5 } as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 두 상자가 겹치는 넓이.
 *
 * «몇 개를 가리는가»로만 세면, 살짝 스치는 자리와 통째로 덮는 자리가 같은 점수가 되어
 * 배열 순서대로 아무 쪽이나 뽑힌다. 넓이로 재야 «가장 덜 가리는 자리»가 실제로 뽑힌다.
 */
function overlapArea(a: Box, b: Box): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * 안내 상자를 놓을 자리.
 *
 * 위·아래·좌·우 네 자리를 만들어 놓고 **다른 구의 이름표를 가장 적게 가리는 곳**을 고른다.
 * 위쪽 한 자리만 쓰면, 북쪽에 이웃이 있는 구를 눌렀을 때 이웃의 이름과 자원 수가 통째로 덮인다 —
 * 관람객은 방금 누른 구의 안내를 얻는 대신 옆 구의 정보를 잃는다.
 *
 * 화면 밖으로 나가는 자리는 후보에서 아예 뺀다. 잘린 안내는 없느니만 못하다.
 */
function tooltipPosition(
  anchorX: number,
  anchorY: number,
  height: number,
  otherLabels: readonly (readonly [number, number])[],
) {
  const clampX = (x: number) =>
    Math.min(Math.max(x, 0.5), DISTRICT_VIEW.width - TOOLTIP.width - 0.5);
  const clampY = (y: number) => Math.min(Math.max(y, 0.5), DISTRICT_VIEW.height - height - 0.5);

  /*
    위·아래·좌·우에 네 모서리까지 여덟 자리를 만든다.
    네 자리만 두면 이웃이 촘촘한 구에서 모든 후보가 무언가를 가려, 「덜 나쁜 자리」밖에 못 고른다.
  */
  const box = (x: number, y: number, side: TooltipSide): Box & { side: TooltipSide } => ({
    x,
    y,
    width: TOOLTIP.width,
    height,
    side,
  });
  const centerX = clampX(anchorX - TOOLTIP.width / 2);
  const leftX = anchorX - TOOLTIP.width - TOOLTIP.gap;
  const rightX = anchorX + TOOLTIP.gap;
  const topY = anchorY - height - TOOLTIP.gap;
  const bottomY = anchorY + TOOLTIP.gap;

  const candidates = [
    box(centerX, topY, 'top'),
    box(centerX, bottomY, 'bottom'),
    box(rightX, clampY(anchorY - height / 2), 'right'),
    box(leftX, clampY(anchorY - height / 2), 'left'),
    box(rightX, topY, 'right'),
    box(leftX, topY, 'left'),
    box(rightX, bottomY, 'right'),
    box(leftX, bottomY, 'left'),
  ];

  const labelBoxes: Box[] = otherLabels.map(([x, y]) => ({
    x: x - LABEL_BOX.width / 2,
    y: y - LABEL_BOX.height / 2 + LABEL_BOX.centerOffsetY,
    width: LABEL_BOX.width,
    height: LABEL_BOX.height,
  }));

  const inBounds = (box: Box) =>
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= DISTRICT_VIEW.width &&
    box.y + box.height <= DISTRICT_VIEW.height;

  const usable = candidates.filter(inBounds);
  const pool = usable.length > 0 ? usable : candidates;

  let best = pool[0]!;
  let leastHidden = Infinity;
  for (const candidate of pool) {
    const hidden = labelBoxes.reduce((sum, label) => sum + overlapArea(candidate, label), 0);
    if (hidden < leastHidden) {
      leastHidden = hidden;
      best = candidate;
    }
    if (leastHidden === 0) break;
  }

  return { x: clampX(best.x), y: clampY(best.y), side: best.side };
}

/** 판을 눕히는 변환. 여러 곳에서 같은 값을 써야 하므로 한 번만 적는다. */
const PLATE_TRANSFORM = `matrix(1 0 0 ${SOLID.tilt} 0 ${PIVOT_Y * (1 - SOLID.tilt)})`;

/** 고른 구가 판 위로 올라간 거리. 기울인 좌표계 안에서는 그만큼 되나눠야 화면에서 lift 가 된다. */
const LIFT_IN_PLATE = SOLID.raise / SOLID.tilt;

function fillFor(district: GwangjuDistrict, isSelected: boolean): string {
  if (isSelected) return 'var(--map-selected-surface)';
  return INTENSITY_FILL[districtIntensity(districtAttractions(district).length)];
}

function inkFor(district: GwangjuDistrict, isSelected: boolean): string {
  if (isSelected) return 'var(--map-selected-on)';
  return INTENSITY_INK[districtIntensity(districtAttractions(district).length)];
}

/**
 * 옆면 — 앞쪽 실루엣에만 있다.
 *
 * 같은 색을 깔고 어두운 막을 덧씌운다. 색을 두 벌 관리하지 않아도
 * «빛은 왼쪽 위에서 온다»가 표현되고, 구의 색이 바뀌어도 음영 관계가 유지된다.
 * 얇은 실선을 두르는 것은 면과 면 사이에 뜨는 머리카락 같은 흰 줄을 메우기 위함이다.
 */
function DistrictWall({
  district,
  isSelected = false,
  entranceDelay,
}: {
  district: GwangjuDistrict;
  isSelected?: boolean;
  entranceDelay?: number;
}) {
  const path = isSelected ? district.wallLifted : district.wall;
  const fill = fillFor(district, isSelected);
  const tint = isSelected ? 'var(--map-wall-tint-selected)' : 'var(--map-wall-tint)';

  return (
    /*
      등장 애니메이션과 솟아오르는 전환을 **다른 요소에 나눠 맡긴다.**
      한 요소에 함께 걸면, 등장 애니메이션의 끝 키프레임(`transform: none`)이
      뒤에 오는 transform 지정을 덮어써 솟아오르기가 통째로 무시된다.
    */
    <g className="animate-map-piece-in" style={{ animationDelay: `${entranceDelay ?? 0}ms` }}>
    <g
      className={RISE_CLASS}
      style={{ transform: `translateY(${isSelected ? -LIFT_IN_PLATE : 0}px)` }}
    >
      <path d={path} fill={fill} stroke={fill} strokeWidth="0.12" />
      <path d={path} fill={tint} stroke={tint} strokeWidth="0.12" />
    </g>
    </g>
  );
}

/** 윗면 — 단색 채움과 또렷한 경계선. */
function DistrictFace({
  district,
  isSelected = false,
  entranceDelay,
}: {
  district: GwangjuDistrict;
  isSelected?: boolean;
  entranceDelay?: number;
}) {
  return (
    <g className="animate-map-piece-in" style={{ animationDelay: `${entranceDelay ?? 0}ms` }}>
    <g
      className={RISE_CLASS}
      style={{ transform: `translateY(${isSelected ? -LIFT_IN_PLATE : 0}px)` }}
    >
      <path
        className="district-face transition-[fill,stroke] duration-(--motion-normal)"
        d={district.path}
        fill={fillFor(district, isSelected)}
        stroke={isSelected ? 'var(--map-district-edge)' : 'var(--map-outline)'}
        strokeWidth={isSelected ? 0.45 : 0.26}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
    </g>
  );
}

/**
 * 이름표와 터치 영역.
 *
 * 이름표는 판을 따라 눌리면 글자가 찌그러지므로 기울인 그룹 **밖**에 두고 위치만 옮긴다.
 * 누르는 곳은 이름표가 아니라 구 도형 전체다 — 손가락으로 누르는 화면에서
 * 작은 글자만 표적으로 삼으면 안 된다.
 */
function DistrictLabel({
  district,
  isSelected,
  onSelect,
  entranceDelay,
}: {
  district: GwangjuDistrict;
  isSelected: boolean;
  onSelect: (district: GwangjuDistrict) => void;
  entranceDelay?: number;
}) {
  const count = districtAttractions(district).length;
  const [labelX, rawLabelY] = district.labelAnchor;
  const labelY = toPlateY(rawLabelY);
  const ink = inkFor(district, isSelected);

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${district.name}, 관광자원 ${count}곳`}
      /* 누르는 순간 살짝 눌렸다가 놓이면, 손가락이 닿았다는 반응이 즉시 온다. */
      className="cursor-pointer outline-none active:opacity-80"
      onClick={() => onSelect(district)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(district);
      }}
    >
      {/* 눌리는 면. 보이지는 않지만 도형 전체가 표적이 된다. */}
      <path
        d={district.path}
        transform={PLATE_TRANSFORM}
        fill="transparent"
        style={{ transform: `translateY(${isSelected ? -SOLID.raise : 0}px)` }}
        className={RISE_CLASS}
      />

      <g
        className="animate-map-piece-in"
        style={{ animationDelay: `${entranceDelay ?? 0}ms` }}
      >
      <g className={RISE_CLASS} style={{ transform: `translateY(${isSelected ? -SOLID.raise : 0}px)` }}>
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          className="pointer-events-none font-bold"
          fill={ink}
          style={{ fontSize: '4.4px' }}
        >
          {district.name}
        </text>
        <text
          x={labelX}
          y={labelY + 4.2}
          textAnchor="middle"
          className="pointer-events-none"
          fill={ink}
          style={{ fontSize: '3.2px' }}
          opacity={0.92}
        >
          관광자원 {count}곳
        </text>
      </g>
      </g>
    </g>
  );
}

export interface GwangjuDistrictMapProps {
  selectedId?: string;
  onSelect: (district: GwangjuDistrict) => void;
  className?: string;
}

export function GwangjuDistrictMap({ selectedId, onSelect, className }: GwangjuDistrictMapProps) {
  /*
    뒤에서 앞으로 그린다 — SVG 에는 z-index 가 없고 **그린 순서가 곧 앞뒤**이기 때문이다.
    순서는 빌드 시점에 짝지어 비교해 정해 두었다(`drawOrder`).

    고른 구만 예외로 **맨 마지막**에 그린다. 솟아오른 구가 이웃 뒤에 깔리면
    올라온 것이 아니라 파묻힌 것으로 보인다. z-index 로는 바꿀 수 없고 순서를 옮겨야 한다.
  */
  const selected = GWANGJU_DISTRICTS.find((district) => district.id === selectedId);
  // 고른 구는 따로 맨 마지막에 그린다. 나머지는 뒤에서 앞 순서 그대로.
  const resting = [...GWANGJU_DISTRICTS]
    .filter((district) => district.id !== selectedId)
    .sort((a, b) => a.drawOrder - b.drawOrder);
  const selectedAttractions = selected ? districtAttractions(selected) : [];
  // 줄 수에서 높이를 계산한다. 고정 높이로 두면 자원이 늘었을 때 글자가 상자 밖으로 잘린다.
  const tooltipHeight = selected
    ? tooltipHeightFor(selected.summary, selectedAttractions.length)
    : 0;
  const tooltip = selected
    ? tooltipPosition(
        selected.labelAnchor[0],
        toPlateY(selected.labelAnchor[1]) - SOLID.raise,
        tooltipHeight,
        GWANGJU_DISTRICTS.filter((district) => district.id !== selected.id).map(
          (district) => [district.labelAnchor[0], toPlateY(district.labelAnchor[1])] as const,
        ),
      )
    : undefined;

  return (
    <svg
      viewBox={`0 0 ${DISTRICT_VIEW.width} ${DISTRICT_VIEW.height}`}
      /* 상자를 꽉 채우되 비율은 지킨다. 늘려 붙이면 행정구역 모양이 왜곡된다. */
      preserveAspectRatio="xMidYMid meet"
      className={cn('block h-full w-full', className)}
      role="group"
      aria-label="광주광역시 자치구 안내도"
    >
      {/*
        ── 왜 두 번에 나눠 그리는가 ─────────────────────────────────
        구마다 «옆면 → 윗면» 순으로 한 덩어리씩 그리면, 뒤 구의 옆면이
        앞 구의 윗면에 완전히 가려지지 않아 **경계마다 얇은 턱**이 남는다.
        판 전체가 평평한데도 계단처럼 보인다.

        옆면을 **모두 먼저** 깔고 윗면을 **그 위에 전부** 덮으면,
        안쪽 옆면은 어느 것도 살아남지 못하고 광주 바깥 테두리에만 두께가 남는다.
        그래서 아무것도 고르지 않았을 때 윗면이 이음매 없이 하나로 이어진다.
        ────────────────────────────────────────────────────────────
      */}
      <g transform={PLATE_TRANSFORM} aria-hidden>
        {resting.map((district, index) => (
          <DistrictWall
            key={district.id}
            district={district}
            entranceDelay={index * ENTRANCE_STEP_MS}
          />
        ))}
      </g>

      <g transform={PLATE_TRANSFORM} aria-hidden>
        {resting.map((district, index) => (
          <DistrictFace
            key={district.id}
            district={district}
            entranceDelay={index * ENTRANCE_STEP_MS}
          />
        ))}
      </g>

      {/* 이름표와 터치 영역. 이름표는 판을 따라 눌리면 안 되므로 기울인 그룹 밖에 둔다. */}
      {resting.map((district, index) => (
        <DistrictLabel
          key={district.id}
          district={district}
          onSelect={onSelect}
          isSelected={false}
          entranceDelay={index * ENTRANCE_STEP_MS}
        />
      ))}

      {/*
        고른 구는 판에서 들려 나온다.
        옆면·윗면·이름표를 한 덩어리로, 그리고 **맨 마지막에** 그려야 이웃 위로 올라온다.
      */}
      {selected ? (
        <>
          <g transform={PLATE_TRANSFORM} aria-hidden>
            <DistrictWall district={selected} isSelected />
            <DistrictFace district={selected} isSelected />
          </g>
          <DistrictLabel district={selected} onSelect={onSelect} isSelected />
        </>
      ) : null}

      {/*
        선택한 구의 안내 말풍선.

        화면 구석이 아니라 **누른 자리 옆**에 띄운다. 손가락과 눈이 같은 곳에 머물러야
        «내가 방금 누른 것의 설명»으로 읽힌다.

        꼬리를 먼저 그리고 상자를 나중에 그린다. 그래야 꼬리 밑변의 테두리가
        상자에 덮여, 삼각형이 상자에서 자라난 것처럼 이어진다.
      */}
      {selected && tooltip ? (
        <g className="pointer-events-none animate-callout-in">
          <path
            d={tailPath(
              { x: tooltip.x, y: tooltip.y, width: TOOLTIP.width, height: tooltipHeight },
              tooltip.side,
              selected.labelAnchor[0],
              toPlateY(selected.labelAnchor[1]) - SOLID.raise,
            )}
            fill="var(--surface-card)"
            stroke="var(--line-subtle)"
            strokeWidth="0.25"
            strokeLinejoin="round"
          />

          <foreignObject
            x={tooltip.x}
            y={tooltip.y}
            width={TOOLTIP.width}
            height={tooltipHeight}
          >
            <div
              /*
                SVG 좌표계 안이라 글자 크기도 viewBox 단위로 적는다.
                지도가 커지면 말풍선도 같은 비율로 커져, 어느 화면 크기에서나 같은 그림이 된다.
              */
              style={{
                fontSize: '2.7px',
                lineHeight: 1.4,
                padding: `${TOOLTIP.padding}px`,
                borderRadius: `${TOOLTIP.radius}px`,
                borderWidth: '0.25px',
              }}
              className="h-full border-line-subtle bg-surface-card shadow-raised"
            >
              {/* 머리 — 강조색 표식 + 구 이름 + 자원 수. 표식이 지도의 선택색과 짝을 이룬다. */}
              <div className="flex items-center" style={{ gap: '1.6px' }}>
                <span
                  aria-hidden
                  style={{ width: '1.1px', height: '3.6px', borderRadius: '0.6px' }}
                  className="shrink-0 bg-accent"
                />
                <span className="font-bold text-content" style={{ fontSize: '3.8px' }}>
                  {selected.name}
                </span>
                <span
                  className="ml-auto font-semibold text-accent"
                  style={{ fontSize: '2.6px' }}
                >
                  {selectedAttractions.length}곳
                </span>
              </div>

              <p
                className="text-content-secondary"
                style={{ marginTop: `${TOOLTIP.dividerGap - 0.6}px` }}
              >
                {selected.summary}
              </p>

              {selectedAttractions.length > 0 ? (
                <ul
                  className="border-line-subtle"
                  style={{
                    marginTop: `${TOOLTIP.dividerGap - 0.6}px`,
                    paddingTop: '1.4px',
                    borderTopWidth: '0.2px',
                  }}
                >
                  {/*
                    flex 로 점과 글자를 나란히 두면 줄 높이가 항목마다 달라져 간격이 들쭉날쭉해진다.
                    보통 글줄로 두고 표식을 글자로 넣으면 줄 높이 하나가 간격을 일정하게 지배한다.
                  */}
                  {selectedAttractions.map((attraction) => (
                    <li key={attraction.id} className="text-content-muted">
                      <span className="text-accent" aria-hidden>
                        ·{' '}
                      </span>
                      {attraction.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </foreignObject>
        </g>
      ) : null}

    </svg>
  );
}
