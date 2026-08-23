'use client';

import { ArrowRight, CircleCheck, TriangleAlert } from 'lucide-react';
import { REFINEMENT_DEFINITIONS } from '../../config/refinements';
import { requireAttraction } from '../../data/attractions';
import { buildMetricDeltas } from '../../domain/minimal-change-replan/changeDiff';
import type { ReplanTrace } from '../../domain/types/replan';
import { cn } from '../../lib/cn';
import { formatElapsed } from '../../lib/time';
import { Badge } from '../ui/Badge';
import { Callout } from '../ui/Callout';
import { Card } from '../ui/Surface';
import { MetricSummary } from './MetricSummary';

/**
 * 변경 전/후 비교 (제안서 8.6).
 *
 * 이 화면이 최소변경 재구성을 "설명"하는 자리다. 세 가지를 동시에 보여 준다.
 *   ① 요청이 달성되었는가          → 목표 달성 뱃지
 *   ② 얼마나 적게 바꿨는가         → 유지/변경 개수와 변화량
 *   ③ 무엇이 무엇으로 바뀌었는가   → 교체 내역과 그 이유
 */

export interface ChangeComparisonProps {
  trace: ReplanTrace;
  className?: string;
}

export function ChangeComparison({ trace, className }: ChangeComparisonProps) {
  const definition = REFINEMENT_DEFINITIONS[trace.refinementId];
  const deltas = buildMetricDeltas(trace.before, trace.after, trace.objective);

  return (
    <div className={cn('flex flex-col gap-md', className)}>
      <header className="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <p className="text-caption text-content-muted">요청</p>
          <h3 className="text-title font-bold text-content">「{definition.label}」</h3>
        </div>
        <Badge
          tone={trace.objectiveSatisfied ? 'positive' : 'caution'}
          variant="solid"
          icon={trace.objectiveSatisfied ? CircleCheck : TriangleAlert}
        >
          {trace.objectiveSatisfied ? '요청 반영 완료' : '반영 가능한 대안 없음'}
        </Badge>
      </header>

      <Card padding="md" elevation="flat" className="bg-surface-sunken">
        <p className="flex flex-wrap items-center gap-x-lg gap-y-xs text-label text-content-secondary">
          <span data-numeric="">
            유지된 장소 <strong className="text-positive">{trace.keptStopIds.length}곳</strong>
          </span>
          <span data-numeric="">
            변경된 장소 <strong className="text-accent">{trace.changedStopIds.length}곳</strong>
          </span>
          <span data-numeric="">
            변화량 <strong className="text-content">{trace.changeRatio}%</strong>
          </span>
          <span className="text-caption text-content-subtle" data-numeric="">
            재구성 {formatElapsed(trace.elapsedMs)}
          </span>
        </p>
      </Card>

      <MetricSummary metrics={trace.after} deltas={deltas} />

      {trace.replacements.length > 0 ? (
        <section>
          <h4 className="text-subhead font-bold text-content">교체 내역</h4>
          <ul className="mt-sm flex flex-col gap-sm">
            {trace.replacements.map((replacement) => {
              const removed = requireAttraction(replacement.removedAttractionId);
              const added = requireAttraction(replacement.addedAttractionId);
              return (
                <li
                  key={replacement.removedStopId}
                  className="rounded-card bg-surface-card p-md surface-outline"
                >
                  <p className="flex flex-wrap items-center gap-sm text-subhead font-semibold">
                    <span className="text-content-muted line-through">{removed.name}</span>
                    <ArrowRight className="size-[1em] text-accent" aria-hidden />
                    <span className="text-content">{added.name}</span>
                    <Badge size="sm" tone="brand">
                      유사도 {replacement.similarity}
                    </Badge>
                  </p>
                  <ul className="mt-xs flex flex-col gap-2xs text-caption text-content-muted">
                    {replacement.reasons.map((reason) => (
                      <li key={reason}>· {reason}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <Callout tone="caution" className="text-body">
          요청하신 조건을 만족하면서 일정의 성격과 이동시간을 함께 지킬 수 있는 대안을 찾지
          못했습니다. 기존 일정을 그대로 유지합니다.
        </Callout>
      )}
    </div>
  );
}
