'use client';

import { useCallback, useEffect, useState } from 'react';
import { IDLE_TIMEOUTS_MS } from '@namdo-prism/core/config';
import { useIdleReset } from '@namdo-prism/core/hooks';
import { House } from 'lucide-react';
import { Button, FailureNotice, Sheet } from '@namdo-prism/core/ui';
import { usePresentationSync } from '@namdo-prism/core/state';
import { AnalysisScreen } from '@/components/AnalysisScreen';
import { AttractScreen } from '@/components/AttractScreen';
import { ConditionWizard } from '@/components/ConditionWizard';
import { HandoffScreen } from '@/components/HandoffScreen';
import { KioskShell } from '@/components/KioskShell';
import { PresenterPanel } from '@/components/PresenterPanel';
import { ResultScreen } from '@/components/ResultScreen';
import { useKiosk } from '@/state/kioskStore';
import { useKioskLog } from '@/state/logs';
import { usePresentation } from '@/state/presentation';

/**
 * 키오스크 진입점.
 *
 * 화면 전환·자동 초기화·로그 확정이라는 세 가지 횡단 관심사를 여기서만 다룬다.
 * 각 화면 컴포넌트는 자기 단계의 표시에만 집중한다.
 */
export default function KioskPage() {
  usePresentationSync(usePresentation);

  const phase = useKiosk((state) => state.phase);
  const beginSession = useKiosk((state) => state.beginSession);
  const finishAnalysis = useKiosk((state) => state.finishAnalysis);
  const reset = useKiosk((state) => state.reset);
  const toSessionLog = useKiosk((state) => state.toSessionLog);

  const uiMode = usePresentation((state) => state.uiMode);
  const theme = usePresentation((state) => state.theme);
  const contrast = usePresentation((state) => state.contrast);
  const upsertLog = useKioskLog((state) => state.upsert);

  const failure = useKiosk((state) => state.failure);
  const [presenterOpen, setPresenterOpen] = useState(false);

  // 분석화면에 들어서는 즉시 계산을 시작한다. 연출 시간과 계산 시간은 무관하다.
  useEffect(() => {
    if (phase === 'analysis') finishAnalysis();
  }, [phase, finishAnalysis]);

  /**
   * 세션을 로그로 굳히고 대기화면으로 돌아간다.
   * 결과화면 이후에만 로그를 남긴다 — 조건 입력 도중 이탈한 세션은 연구 자료가 되지 못한다.
   */
  const endSession = useCallback(() => {
    const log = toSessionLog({ uiMode, theme, contrast });
    if (log) upsertLog(log);
    reset();
  }, [toSessionLog, uiMode, theme, contrast, upsertLog, reset]);

  /*
    처음으로 돌아가기.

    되돌릴 수 없는 조작이라 곧바로 실행하지 않고 한 번 되묻는다 —
    지침도 «중요한 동작에 대한 경고를 명확하게 표시»하라고 정한다.
    결과화면까지 간 세션은 돌아갈 때 로그로 굳히고, 조건을 고르다 그만둔 세션은
    연구 자료가 되지 못하므로 그냥 버린다(`endSession` 이 그 판단을 갖고 있다).
  */
  const [confirmHome, setConfirmHome] = useState(false);

  const { isWarning, secondsRemaining, keepAlive } = useIdleReset({
    warnAfterMs:
      phase === 'result' ? IDLE_TIMEOUTS_MS.resultWarnAfter : IDLE_TIMEOUTS_MS.warnAfter,
    resetAfterMs: IDLE_TIMEOUTS_MS.resetAfter,
    onReset: endSession,
    // 대기화면과 분석화면에서는 감시하지 않는다.
    enabled: phase === 'wizard' || phase === 'result' || phase === 'handoff',
  });

  return (
    <KioskShell
      onResearcherUnlock={() => setPresenterOpen(true)}
      // 대기화면의 안내도만 화면 폭을 전부 쓴다. 나머지 화면은 읽기 좋은 폭을 유지한다.
      fullWidth={!failure && phase === 'attract'}
      // 이미 처음인 대기화면에는 두지 않는다. 오류 안내에는 자체 복구 단추가 있다.
      onHome={!failure && phase !== 'attract' ? () => setConfirmHome(true) : undefined}
    >
      {failure ? (
        <div className="flex flex-1 items-center">
          <FailureNotice
            title="여행일정을 만들지 못했습니다"
            description="일시적인 문제일 수 있습니다. 처음 화면에서 다시 시도해 주세요."
            detail={failure.detail}
            onRecover={reset}
          />
        </div>
      ) : null}

      {!failure && phase === 'attract' ? <AttractScreen onStart={beginSession} /> : null}
      {!failure && phase === 'wizard' ? <ConditionWizard /> : null}
      {!failure && phase === 'analysis' ? (
        <AnalysisScreen onComplete={() => useKiosk.setState({ phase: 'result' })} />
      ) : null}
      {!failure && phase === 'result' ? <ResultScreen /> : null}
      {!failure && phase === 'handoff' ? <HandoffScreen /> : null}

      <Sheet
        open={confirmHome}
        onClose={() => setConfirmHome(false)}
        placement="center"
        title="처음 화면으로"
        footer={
          <span className="flex justify-end gap-sm">
            <Button variant="quiet" onClick={() => setConfirmHome(false)}>
              계속하기
            </Button>
            <Button
              variant="accent"
              iconLeft={House}
              onClick={() => {
                setConfirmHome(false);
                endSession();
              }}
            >
              처음으로
            </Button>
          </span>
        }
      >
        <p className="text-body text-content-secondary">
          지금까지 고른 조건과 만들어진 일정이 지워집니다.
        </p>
      </Sheet>

      {isWarning ? (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-stage p-lg"
        >
          <div className="flex flex-wrap items-center justify-between gap-md rounded-panel bg-surface-raised p-lg shadow-overlay surface-outline">
            <p className="text-subhead text-content">
              잠시 후 처음 화면으로 돌아갑니다{' '}
              <span className="font-bold text-accent" data-numeric="">
                {secondsRemaining}초
              </span>
            </p>
            <div className="flex gap-sm">
              <Button variant="accent" onClick={keepAlive}>
                계속 볼게요
              </Button>
              <Button variant="ghost" onClick={endSession}>
                지금 끝내기
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PresenterPanel open={presenterOpen} onClose={() => setPresenterOpen(false)} />
    </KioskShell>
  );
}
