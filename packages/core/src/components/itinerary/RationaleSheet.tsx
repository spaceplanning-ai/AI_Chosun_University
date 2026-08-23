'use client';

import { Check } from 'lucide-react';
import { withParticle } from '../../lib/korean';
import { requireAttraction } from '../../data/attractions';
import type { ItineraryStop } from '../../domain/types/itinerary';
import type { TrustAssessment } from '../../domain/types/evidence';
import { SourceList } from '../evidence/SourceList';
import { ScoreBreakdown } from '../evidence/ScoreBreakdown';
import { TrustPanel } from '../evidence/TrustPanel';
import { Sheet } from '../ui/Sheet';

/**
 * "AI 추천 근거 보기" 시트 (제안서 7.4).
 *
 * 관람객용 설명(이유 문장 + 공식 출처)과 연구자용 설명(점수 내역 + 신뢰도 산출)을
 * 같은 시트 안에 위아래로 둔다. 화면을 나누지 않는 이유는,
 * 전시 현장에서 진행자가 한 화면을 그대로 스크롤하며 설명하기 때문이다.
 */

export interface RationaleSheetProps {
  stop: ItineraryStop | undefined;
  trust: TrustAssessment | undefined;
  referenceDate: string;
  onClose: () => void;
  /** 점수 내역까지 펼칠지. 관람객 모드에서는 접어 둔다. */
  showTechnicalDetail?: boolean;
}

export function RationaleSheet({
  stop,
  trust,
  referenceDate,
  onClose,
  showTechnicalDetail = false,
}: RationaleSheetProps) {
  const attraction = stop ? requireAttraction(stop.attractionId) : undefined;

  return (
    <Sheet
      open={stop !== undefined}
      onClose={onClose}
      title={attraction ? `AI가 ${withParticle(attraction.name, '목적격')} 추천한 이유` : '추천 근거'}
      description={attraction?.summary}
    >
      {stop && attraction ? (
        <div className="flex flex-col gap-lg">
          <section>
            <h3 className="text-subhead font-bold text-content">추천 이유</h3>
            <ul className="mt-sm flex flex-col gap-xs">
              {stop.rationale.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-sm text-body text-content-secondary">
                  <span className="mt-[0.25em] grid size-[1.35em] shrink-0 place-items-center rounded-pill bg-positive-soft text-positive">
                    <Check className="size-[0.9em]" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-balance-safe">{reason}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-subhead font-bold text-content">근거가 된 공식 자료</h3>
            <SourceList
              className="mt-sm"
              documentIds={stop.rationale.sourceDocumentIds}
              referenceDate={referenceDate}
            />
          </section>

          {trust ? (
            <section>
              <h3 className="text-subhead font-bold text-content">정보 신뢰도 산출</h3>
              <TrustPanel className="mt-sm" assessment={trust} showFactors={showTechnicalDetail} />
            </section>
          ) : null}

          {showTechnicalDetail ? (
            <section>
              <h3 className="text-subhead font-bold text-content">추천점수 내역</h3>
              <ScoreBreakdown className="mt-sm" score={stop.rationale.score} />
            </section>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
