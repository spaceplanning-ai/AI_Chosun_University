/**
 * 특허 도면용 순서도 생성기.
 *
 * 제안서 9.4가 도면 8종을 명시했고, 피드백 5.3은 A단계에서 우선 제공할 6종을 지정했다.
 * 그림판으로 그리면 구현이 바뀔 때마다 도면이 뒤처지고, 결국 명세서와 코드가 어긋난다.
 * 그래서 도면도 기술설명서와 같은 원칙으로 만든다 — **정의는 데이터, 수치는 실제 코드에서**.
 *
 * ── 레이아웃 방침 ──────────────────────────────────────────────────
 * 자동 배치 알고리즘을 쓰지 않는다. 노드가 겹치거나 화살표가 꼬이면
 * 도면으로서 가치가 없는데, 범용 그래프 배치는 그 실패를 조용히 만들어 낸다.
 *
 * 대신 특허 순서도가 실제로 취하는 형태 — **한 줄로 내려가는 주 흐름 + 옆으로 빠지는 분기** —
 * 만 지원한다. 표현력은 좁지만 결과가 항상 읽힌다.
 * ──────────────────────────────────────────────────────────────────
 */

export type DiagramNodeKind = 'terminal' | 'process' | 'decision' | 'data' | 'reject';

export interface DiagramNode {
  id: string;
  label: string;
  /** 박스 안 둘째 줄. 구현 파일명이나 산출 타입을 적는다. */
  detail?: string;
  kind: DiagramNodeKind;
  /**
   * 오른쪽으로 빠지는 곁가지. 판정에서 탈락한 경로를 표현한다.
   * 주 흐름은 계속 아래로 이어진다.
   */
  branch?: { label: string; node: Omit<DiagramNode, 'branch'> };
}

export interface Diagram {
  /** 제안서 9.4의 도면 번호. */
  number: number;
  id: string;
  title: string;
  /** 도면 하단 설명. 명세서에 그대로 옮길 수 있는 문장으로 쓴다. */
  caption: string;
  nodes: DiagramNode[];
}

const LAYOUT = {
  nodeWidth: 300,
  branchWidth: 250,
  nodeGap: 34,
  paddingX: 28,
  paddingTop: 68,
  paddingBottom: 56,
  lineHeight: 21,
  labelSize: 15,
  detailSize: 12,
  /** 한글 한 글자가 차지하는 대략적 폭. 줄바꿈 계산에만 쓴다. */
  charWidth: 15.5,
} as const;

const KIND_STYLE: Record<DiagramNodeKind, { fill: string; stroke: string; text: string; radius: number }> = {
  terminal: { fill: '#0f2038', stroke: '#245894', text: '#ebeff5', radius: 22 },
  process: { fill: '#ffffff', stroke: '#33415a', text: '#16202e', radius: 8 },
  decision: { fill: '#fef3da', stroke: '#b26a05', text: '#16202e', radius: 8 },
  data: { fill: '#e1f0fa', stroke: '#2e7fc2', text: '#16202e', radius: 8 },
  reject: { fill: '#fdeade', stroke: '#93380a', text: '#16202e', radius: 8 },
};

/** SVG 텍스트로 넣기 전에 특수문자를 이스케이프한다. */
function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** 폭에 맞춰 줄을 나눈다. 한국어는 단어 경계가 드물어 글자 단위로 끊는다. */
function wrap(text: string, maxWidth: number, charWidth: number): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / charWidth));
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(' ')) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current.length > 0) lines.push(current);

    // 한 단어가 통째로 넘칠 때는 글자 단위로 자른다.
    let remainder = word;
    while (remainder.length > maxChars) {
      lines.push(remainder.slice(0, maxChars));
      remainder = remainder.slice(maxChars);
    }
    current = remainder;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

interface MeasuredNode {
  node: DiagramNode;
  labelLines: string[];
  detailLines: string[];
  height: number;
  y: number;
  branch?: { labelLines: string[]; detailLines: string[]; height: number };
}

function measure(node: DiagramNode, width: number): Omit<MeasuredNode, 'y'> {
  const inner = width - 28;
  const labelLines = wrap(node.label, inner, LAYOUT.charWidth);
  const detailLines = node.detail ? wrap(node.detail, inner, LAYOUT.charWidth * 0.82) : [];
  const height =
    22 + labelLines.length * LAYOUT.lineHeight + detailLines.length * (LAYOUT.lineHeight - 4);

  if (!node.branch) return { node, labelLines, detailLines, height };

  const branchInner = LAYOUT.branchWidth - 24;
  const branchLabel = wrap(node.branch.node.label, branchInner, LAYOUT.charWidth);
  const branchDetail = node.branch.node.detail
    ? wrap(node.branch.node.detail, branchInner, LAYOUT.charWidth * 0.82)
    : [];

  return {
    node,
    labelLines,
    detailLines,
    height,
    branch: {
      labelLines: branchLabel,
      detailLines: branchDetail,
      height: 22 + branchLabel.length * LAYOUT.lineHeight + branchDetail.length * (LAYOUT.lineHeight - 4),
    },
  };
}

function renderBox(
  x: number,
  y: number,
  width: number,
  height: number,
  kind: DiagramNodeKind,
  labelLines: string[],
  detailLines: string[],
): string {
  const style = KIND_STYLE[kind];
  const centerX = x + width / 2;
  let textY = y + 26;

  const labels = labelLines
    .map((line) => {
      const element = `<text x="${centerX}" y="${textY}" text-anchor="middle" font-size="${LAYOUT.labelSize}" font-weight="600" fill="${style.text}">${escapeXml(line)}</text>`;
      textY += LAYOUT.lineHeight;
      return element;
    })
    .join('');

  const details = detailLines
    .map((line) => {
      const element = `<text x="${centerX}" y="${textY}" text-anchor="middle" font-size="${LAYOUT.detailSize}" fill="${style.text}" opacity="0.7">${escapeXml(line)}</text>`;
      textY += LAYOUT.lineHeight - 4;
      return element;
    })
    .join('');

  return (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${style.radius}" ` +
    `fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>${labels}${details}`
  );
}

/** 순서도 하나를 독립 실행 가능한 SVG 문자열로 만든다. */
export function renderDiagram(diagram: Diagram): string {
  const measured = diagram.nodes.map((node) => measure(node, LAYOUT.nodeWidth));
  const hasBranch = measured.some((entry) => entry.branch);

  const mainX = LAYOUT.paddingX;
  const branchX = mainX + LAYOUT.nodeWidth + 74;
  const width = LAYOUT.paddingX * 2 + LAYOUT.nodeWidth + (hasBranch ? 74 + LAYOUT.branchWidth : 0);

  let cursorY = LAYOUT.paddingTop;
  const placed: MeasuredNode[] = measured.map((entry) => {
    const withY = { ...entry, y: cursorY };
    cursorY += entry.height + LAYOUT.nodeGap;
    return withY;
  });
  const height = cursorY - LAYOUT.nodeGap + LAYOUT.paddingBottom;

  const boxes = placed
    .map((entry) =>
      renderBox(
        mainX,
        entry.y,
        LAYOUT.nodeWidth,
        entry.height,
        entry.node.kind,
        entry.labelLines,
        entry.detailLines,
      ),
    )
    .join('');

  // 주 흐름 화살표
  const arrows = placed
    .slice(0, -1)
    .map((entry, index) => {
      const next = placed[index + 1];
      if (!next) return '';
      const x = mainX + LAYOUT.nodeWidth / 2;
      return `<line x1="${x}" y1="${entry.y + entry.height}" x2="${x}" y2="${next.y - 2}" stroke="#5c6b85" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    })
    .join('');

  // 곁가지 (제외 경로)
  const branches = placed
    .map((entry) => {
      const branch = entry.node.branch;
      if (!branch || !entry.branch) return '';

      const fromX = mainX + LAYOUT.nodeWidth;
      const midY = entry.y + entry.height / 2;
      const branchY = midY - entry.branch.height / 2;

      return (
        `<line x1="${fromX}" y1="${midY}" x2="${branchX - 2}" y2="${midY}" stroke="#93380a" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#arrow-reject)"/>` +
        `<text x="${(fromX + branchX) / 2}" y="${midY - 8}" text-anchor="middle" font-size="11" fill="#93380a">${escapeXml(branch.label)}</text>` +
        renderBox(
          branchX,
          branchY,
          LAYOUT.branchWidth,
          entry.branch.height,
          branch.node.kind,
          entry.branch.labelLines,
          entry.branch.detailLines,
        )
      );
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif">
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5c6b85"/></marker>
<marker id="arrow-reject" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#93380a"/></marker>
</defs>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<text x="${LAYOUT.paddingX}" y="34" font-size="17" font-weight="700" fill="#16202e">도면 ${diagram.number}. ${escapeXml(diagram.title)}</text>
<text x="${LAYOUT.paddingX}" y="54" font-size="12" fill="#5c6b85">${escapeXml(diagram.caption)}</text>
${arrows}${branches}${boxes}
</svg>
`;
}
