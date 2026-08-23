'use client';

import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { PATENT_DIAGRAMS } from '@namdo-prism/core/data';
import { renderDiagram } from '@namdo-prism/core/design';
import { Badge, Panel } from '@namdo-prism/core/ui';

/**
 * 특허 도면 (제안서 9.4 / 피드백 5.3 A단계 우선 6종).
 *
 * 도면을 그림 파일로 관리하지 않고 코드에서 생성한다. 임계값·가중치가 설정 상수에서
 * 오므로, 구현이 바뀌면 도면의 숫자도 함께 바뀐다 — 명세서와 코드가 어긋난 채
 * 출원되는 사고를 구조적으로 막는다.
 *
 * `dangerouslySetInnerHTML` 대신 data URI + `<img>` 로 그린다.
 * 내용이 전부 우리 상수에서 나오더라도, SVG를 문서에 직접 주입하는 습관은 두지 않는다.
 */

export function PatentDiagrams() {
  const diagrams = useMemo(
    () =>
      PATENT_DIAGRAMS.map((diagram) => {
        const svg = renderDiagram(diagram);
        return {
          diagram,
          source: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
          filename: `도면${diagram.number}_${diagram.id}.svg`,
        };
      }),
    [],
  );

  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title="특허 도면"
        description="제안서 9.4의 도면 8종 중 피드백 5.3이 A단계 우선으로 지정한 6종입니다."
        action={<Badge tone="brand">{diagrams.length}종</Badge>}
      >
        <p className="text-caption leading-relaxed text-content-muted">
          도면의 임계값·가중치는 <code className="text-micro text-brand">config/scoring.ts</code> 등
          실제 설정 상수에서 옵니다. 그림 파일로 따로 관리하지 않으므로 구현을 고치면 도면도 함께
          바뀝니다. 파일로 내보내려면{' '}
          <code className="text-micro text-brand">npm run patent:examples</code> 를 실행하면{' '}
          <code className="text-micro text-brand">docs/patent-examples/diagrams/</code> 에 SVG로
          저장됩니다.
        </p>
      </Panel>

      {diagrams.map(({ diagram, source, filename }) => (
        <Panel
          key={diagram.id}
          title={`도면 ${diagram.number}. ${diagram.title}`}
          description={diagram.caption}
          action={
            <a
              href={source}
              download={filename}
              className="inline-flex min-h-control-sm items-center gap-xs rounded-control bg-surface-raised px-md text-label font-semibold text-content surface-outline"
            >
              <Download className="size-[1.1em]" aria-hidden />
              SVG 내려받기
            </a>
          }
        >
          <div className="overflow-x-auto rounded-card bg-white p-md surface-outline">
            {/*
              next/image 는 원격·정적 이미지를 최적화하는 도구다.
              여기서는 런타임에 만들어진 data URI SVG 라 최적화 대상이 아니고,
              벡터이므로 리사이즈 이득도 없다. 그래서 의도적으로 <img> 를 쓴다.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source}
              alt={`도면 ${diagram.number} ${diagram.title}`}
              className="mx-auto block h-auto max-w-full"
            />
          </div>
        </Panel>
      ))}
    </div>
  );
}
