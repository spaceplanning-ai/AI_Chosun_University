import { SCORE_CRITERION_LABELS } from '../../domain/labels';
import type { CandidateScore } from '../../domain/types/evidence';
import { cn } from '../../lib/cn';
import { Meter } from '../ui/Meter';
import { toneForScore } from '../ui/tone';

/**
 * 다목적 추천점수 내역 (제안서 8.4).
 *
 * 7개 평가항목의 원점수와 가중 기여분을 함께 보여 준다.
 * 원점수만 보이면 "왜 취향 적합도 90점인데 총점이 낮은가"를 설명할 수 없고,
 * 기여분만 보이면 항목별 강약을 비교할 수 없다.
 */

export interface ScoreBreakdownProps {
  score: CandidateScore;
  className?: string;
}

export function ScoreBreakdown({ score, className }: ScoreBreakdownProps) {
  return (
    <div className={cn('flex flex-col gap-sm', className)}>
      <div className="flex items-baseline justify-between gap-sm">
        <span className="text-label font-semibold text-content">다목적 추천점수</span>
        <span className="text-heading font-bold text-accent" data-numeric="">
          {score.total}
          <span className="ml-[0.15em] text-caption font-medium text-content-muted">/ 100</span>
        </span>
      </div>

      <ul className="flex flex-col gap-sm">
        {score.criteria.map((criterion) => (
          <li key={criterion.id}>
            <Meter
              size="sm"
              label={`${SCORE_CRITERION_LABELS[criterion.id]} · 가중치 ${criterion.weight}%`}
              value={criterion.raw}
              tone={toneForScore(criterion.raw)}
              description={`총점 기여 ${criterion.weighted.toFixed(2)}점`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
