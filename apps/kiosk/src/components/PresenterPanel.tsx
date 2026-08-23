'use client';

import { Download, Maximize, Minimize, Play, PowerOff, Trash2 } from 'lucide-react';
import { DEMO_SCENARIOS } from '@namdo-prism/core/data';
import {
  buildCsvTables,
  downloadCsvTables,
  downloadLogBundle,
  downloadLogWorkbook,
} from '@namdo-prism/core/lib';
import { buildLogBundle } from '@namdo-prism/core/state';
import { KIOSK_DEPLOYMENT } from '@namdo-prism/core/config';
import { useFullscreen } from '@namdo-prism/core/hooks';
import { Badge, Button, Card, Sheet } from '@namdo-prism/core/ui';
import { useKiosk } from '@/state/kioskStore';
import { useKioskLog } from '@/state/logs';

/**
 * 진행자(연구자) 패널.
 *
 * 브랜드 로고 연속 터치라는 숨은 제스처로만 열린다. 관람객이 우연히 열 수 없어야 하고,
 * 동시에 진행자는 별도 장비 없이 즉시 열 수 있어야 하기 때문이다.
 *
 * 하는 일은 두 가지다.
 *   ① 대표 시나리오 4종을 한 번의 터치로 재생 (제안서 11.5)
 *   ② 쌓인 익명 로그를 CSV/JSON으로 내보내기 (피드백 3.1 "CSV 기반 연구로그 내보내기")
 *
 * 어드민 앱은 별도 오리진에 배포되어 이 브라우저의 저장소를 읽을 수 없으므로,
 * 파일 내보내기가 두 앱을 잇는 유일한 경로다.
 */

export interface PresenterPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PresenterPanel({ open, onClose }: PresenterPanelProps) {
  const applyScenario = useKiosk((state) => state.applyScenario);
  const resetKiosk = useKiosk((state) => state.reset);
  const sessions = useKioskLog((state) => state.sessions);
  const clearSessions = useKioskLog((state) => state.clear);
  const { isFullscreen, isSupported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="진행자 패널"
      description="전시 시연용 프리셋과 연구용 로그 내보내기. 관람객 화면에는 노출되지 않습니다."
    >
      <div className="flex flex-col gap-lg">
        <section>
          <h3 className="text-subhead font-bold text-content">전시 장비 제어</h3>
          <p className="mt-2xs text-caption text-content-muted">
            전체화면은 브라우저 정책상 진행자의 조작으로만 켤 수 있습니다.
          </p>
          <div className="mt-sm flex flex-wrap gap-sm">
            {fullscreenSupported ? (
              <Button
                size="sm"
                variant="quiet"
                iconLeft={isFullscreen ? Minimize : Maximize}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? '전체화면 해제' : '전체화면 키오스크 모드'}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              iconLeft={PowerOff}
              onClick={() => {
                resetKiosk();
                onClose();
              }}
            >
              강제 초기화
            </Button>
          </div>
        </section>

        <section>
          <h3 className="text-subhead font-bold text-content">대표 시연 시나리오</h3>
          <p className="mt-2xs text-caption text-content-muted">
            조건 입력을 건너뛰고 결과화면까지 바로 이동합니다.
          </p>
          <ul className="mt-sm flex flex-col gap-sm">
            {DEMO_SCENARIOS.map((scenario) => (
              <li key={scenario.id}>
                <Card padding="md" elevation="flat" className="bg-surface-sunken">
                  <div className="flex flex-wrap items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <p className="text-label font-bold text-content">{scenario.title}</p>
                      <p className="mt-2xs text-caption text-content-muted">
                        {scenario.description}
                      </p>
                      <p className="mt-xs text-micro leading-relaxed text-content-subtle">
                        시연 포인트 — {scenario.demonstrationPoint}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="accent"
                      iconLeft={Play}
                      onClick={() => {
                        applyScenario(scenario);
                        onClose();
                      }}
                    >
                      재생
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-subhead font-bold text-content">연구용 로그</h3>
          <p className="mt-2xs flex items-center gap-xs text-caption text-content-muted">
            <Badge tone="neutral" size="sm">
              <span data-numeric="">{sessions.length}건 보관</span>
            </Badge>
            개인정보는 저장하지 않습니다.
          </p>

          <div className="mt-sm flex flex-wrap gap-sm">
            <Button
              size="sm"
              variant="primary"
              iconLeft={Download}
              disabled={sessions.length === 0}
              onClick={() => downloadCsvTables(buildCsvTables(sessions))}
            >
              CSV 5종 내려받기
            </Button>
            <Button
              size="sm"
              variant="quiet"
              iconLeft={Download}
              disabled={sessions.length === 0}
              onClick={() =>
                downloadLogWorkbook(sessions, `namdo-prism_logs_${KIOSK_DEPLOYMENT.id}.xlsx`)
              }
            >
              XLSX 워크북 내려받기
            </Button>
            <Button
              size="sm"
              variant="quiet"
              iconLeft={Download}
              disabled={sessions.length === 0}
              onClick={() =>
                downloadLogBundle(
                  buildLogBundle(sessions, KIOSK_DEPLOYMENT.id),
                  `namdo-prism_logs_${KIOSK_DEPLOYMENT.id}.json`,
                )
              }
            >
              원본 JSON 내려받기
            </Button>
            <Button
              size="sm"
              variant="ghost"
              iconLeft={Trash2}
              disabled={sessions.length === 0}
              onClick={clearSessions}
            >
              보관 로그 비우기
            </Button>
          </div>

          <p className="mt-sm text-micro leading-relaxed text-content-subtle">
            세션 요약 / RAG 검색 / 후보 점수 / 제외 근거 / 재구성 이력 다섯 장으로 나뉘며
            session_id 로 조인할 수 있습니다. XLSX는 같은 내용을 한 파일의 다섯 시트로 담고
            숫자를 숫자 형식으로 저장해 바로 집계할 수 있습니다.
            어드민 화면으로 넘길 때는 JSON 원본을 쓰십시오.
          </p>
        </section>
      </div>
    </Sheet>
  );
}
