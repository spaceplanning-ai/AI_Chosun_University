import { ShieldCheck } from 'lucide-react';
import { TRUST_THRESHOLDS } from '../../config/scoring';
import { TRUST_FACTOR_LABELS, TRUST_VERDICT_LABELS } from '../../domain/labels';
import type { TrustAssessment } from '../../domain/types/evidence';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import { Meter } from '../ui/Meter';
import { toneForScore, type Tone } from '../ui/tone';

/**
 * 정보 신뢰도 내역 (제안서 8.5).
 *
 * 총점만 보여 주면 "왜 이 점수인가"에 답할 수 없다.
 * 네 가지 산출요소를 각각의 배점·충족도·근거 문장과 함께 펼쳐 보여 준다.
 */

const VERDICT_TONE: Record<TrustAssessment['verdict'], Tone> = {
  accepted: 'positive',
  demoted: 'caution',
  excluded: 'excluded',
};

export interface TrustPanelProps {
  assessment: TrustAssessment;
  /** 요소별 내역을 접을지. 키오스크 결과화면에서는 총점만 보여 준다. */
  showFactors?: boolean;
  className?: string;
}

export function TrustPanel({ assessment, showFactors = true, className }: TrustPanelProps) {
  return (
    <div className={cn('flex flex-col gap-sm', className)}>
      <div className="flex items-center justify-between gap-sm">
        <span className="flex items-center gap-xs text-label font-semibold text-content">
          <ShieldCheck className="size-[1.2em] text-brand" aria-hidden />
          정보 신뢰도
        </span>
        <Badge tone={VERDICT_TONE[assessment.verdict]}>
          {TRUST_VERDICT_LABELS[assessment.verdict]}
        </Badge>
      </div>

      <Meter
        label="종합 점수"
        value={assessment.score}
        tone={toneForScore(assessment.score)}
        reference={TRUST_THRESHOLDS.demote}
        description={`기준선 ${TRUST_THRESHOLDS.demote}점 미만은 순위 하향, ${TRUST_THRESHOLDS.exclude}점 미만은 추천 제외.`}
      />

      {showFactors ? (
        <ul className="flex flex-col gap-sm">
          {assessment.factors.map((factor) => (
            <li key={factor.id}>
              <Meter
                size="sm"
                label={`${TRUST_FACTOR_LABELS[factor.id]} (배점 ${factor.weight})`}
                value={factor.achieved * factor.weight}
                max={factor.weight}
                unit="점"
                tone={factor.achieved >= 0.99 ? 'positive' : factor.achieved > 0 ? 'caution' : 'critical'}
                description={factor.evidence}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
