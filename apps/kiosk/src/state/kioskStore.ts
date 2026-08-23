'use client';

/**
 * 키오스크 세션 상태 기계.
 *
 *   attract → wizard → analysis → result ⇄ (refine) → handoff → attract
 *
 * 화면 컴포넌트는 상태를 직접 바꾸지 않고 이 파일의 동작(action)만 호출한다.
 * 세션 로그가 어느 화면에서든 일관되게 쌓이려면 전이 지점이 한곳에 모여 있어야 한다.
 */

import { create } from 'zustand';
import { KIOSK_DEPLOYMENT } from '@namdo-prism/core/config';
import { DEFAULT_CONDITIONS, type DemoScenario } from '@namdo-prism/core/data';
import type {
  GenerationOutcome,
  Itinerary,
  RefinementId,
  ReplanTrace,
  TravelConditions,
} from '@namdo-prism/core/domain';
import { generateItinerary } from '@namdo-prism/core/domain/linkage-recommendation';
import { replanItinerary } from '@namdo-prism/core/domain/minimal-change-replan';
import { createItineraryId, createSessionId, createSessionToken } from '@namdo-prism/core/lib';
import type { SessionLog } from '@namdo-prism/core/lib';

export type KioskPhase = 'attract' | 'wizard' | 'analysis' | 'result' | 'handoff';

interface KioskState {
  phase: KioskPhase;
  stepIndex: number;
  conditions: TravelConditions;

  /**
   * 관람객이 실제로 눌러서 답한 항목.
   *
   * `conditions` 는 엔진에 넘길 완전한 값이어야 해서 기본값으로 미리 채워져 있다.
   * 그 상태를 그대로 화면에 「선택됨」으로 보여 주면, 아무것도 누르지 않은 사람이
   * "연인·1박2일·대중교통을 골랐다"로 기록된다 — 연구 로그(제안서 10.4)가 오염된다.
   * 그래서 «채워져 있음»과 «답했음»을 갈라 둔다.
   */
  answeredFields: readonly (keyof TravelConditions)[];

  sessionId: string;
  sessionToken: string;
  startedAt: string;
  scenarioId?: string;

  /**
   * 생성 시점의 기준일. 신뢰도 갱신일 판정과 화면의 출처 표기가 같은 날짜를 쓰도록
   * 렌더마다 새로 만들지 않고 세션에 한 번만 고정한다.
   */
  referenceDate: string;

  /** 최초 생성 결과. 근거·후보·제외 기록의 원본이다. */
  generation?: GenerationOutcome;
  /** 재구성이 반영된 현재 일정. 최초에는 생성 결과와 같다. */
  itinerary?: Itinerary;
  refinements: ReplanTrace[];
  /** 가장 최근 재구성. 변경 전/후 비교 시트가 이 값을 본다. */
  lastRefinement?: ReplanTrace;

  qrGenerated: boolean;

  /**
   * 복구 가능한 실패. 전시 중 예외가 나도 화면이 죽지 않고 안내로 대체되도록,
   * 엔진 호출을 감싸 여기에 담는다. 값이 있으면 화면이 오류 안내로 바뀐다.
   */
  failure?: { message: string; detail: string };

  beginSession: () => void;
  applyScenario: (scenario: DemoScenario) => void;
  setConditions: (patch: Partial<TravelConditions>) => void;
  goToStep: (stepIndex: number) => void;
  nextStep: (totalSteps: number) => void;
  previousStep: () => void;
  finishAnalysis: () => void;
  refine: (refinementId: RefinementId) => void;
  dismissRefinement: () => void;
  showHandoff: () => void;
  backToResult: () => void;
  reset: () => void;
  /** 현재 세션을 연구용 로그 한 건으로 굳힌다. */
  toSessionLog: (context: SessionLogContext) => SessionLog | undefined;
}

export interface SessionLogContext {
  uiMode: SessionLog['uiMode'];
  theme: SessionLog['theme'];
  contrast: SessionLog['contrast'];
}

/** 신뢰도 갱신일 판정의 기준일. 사용자가 조작하는 시점의 실제 날짜를 쓴다. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 엔진 호출을 감싸 예외를 복구 가능한 상태로 바꾼다.
 *
 * 이벤트 핸들러에서 던져진 예외는 React 오류 경계가 잡지 못한다.
 * 전시장에서 버튼 한 번에 화면이 백지가 되는 것을 막으려면 호출 지점에서 붙잡아야 한다.
 */
function runSafely<T>(label: string, operation: () => T): { value?: T; failure?: KioskFailure } {
  try {
    return { value: operation() };
  } catch (cause) {
    const detail =
      cause instanceof Error ? [cause.message, '', cause.stack ?? ''].join('\n') : String(cause);
    console.error(`[남도프리즘] ${label} 실패`, cause);
    return { failure: { message: `${label} 중 문제가 발생했습니다.`, detail } };
  }
}

interface KioskFailure {
  message: string;
  detail: string;
}

function freshSession() {
  return {
    sessionId: createSessionId(),
    sessionToken: createSessionToken(),
    startedAt: new Date().toISOString(),
  };
}

export const useKiosk = create<KioskState>()((set, get) => ({
  phase: 'attract',
  stepIndex: 0,
  conditions: DEFAULT_CONDITIONS,
  answeredFields: [],
  ...freshSession(),
  referenceDate: today(),
  refinements: [],
  qrGenerated: false,

  beginSession: () =>
    set({
      ...freshSession(),
      phase: 'wizard',
      stepIndex: 0,
      conditions: { ...DEFAULT_CONDITIONS, origin: KIOSK_DEPLOYMENT.defaultOrigin },
      answeredFields: [],
      scenarioId: undefined,
      generation: undefined,
      itinerary: undefined,
      refinements: [],
      lastRefinement: undefined,
      qrGenerated: false,
      failure: undefined,
    }),

  applyScenario: (scenario) => {
    set({
      ...freshSession(),
      phase: 'analysis',
      stepIndex: 0,
      conditions: scenario.conditions,
      // 시연 시나리오는 진행자가 의도적으로 고른 값이다. 전 항목을 답한 것으로 본다.
      answeredFields: Object.keys(scenario.conditions) as (keyof TravelConditions)[],
      scenarioId: scenario.id,
      generation: undefined,
      itinerary: undefined,
      refinements: [],
      lastRefinement: undefined,
      qrGenerated: false,
      failure: undefined,
    });
    get().finishAnalysis();
  },

  setConditions: (patch) =>
    set((state) => ({
      conditions: { ...state.conditions, ...patch },
      // 눌러서 바뀐 항목만 「답했음」으로 표시한다.
      answeredFields: [
        ...new Set([...state.answeredFields, ...(Object.keys(patch) as (keyof TravelConditions)[])]),
      ],
    })),

  goToStep: (stepIndex) => set({ stepIndex }),

  nextStep: (totalSteps) =>
    set((state) => {
      if (state.stepIndex < totalSteps - 1) return { stepIndex: state.stepIndex + 1 };
      // 마지막 단계를 넘기면 분석화면으로. 실제 계산은 finishAnalysis 에서 이미 끝나 있다.
      return { phase: 'analysis' as const };
    }),

  previousStep: () =>
    set((state) =>
      state.stepIndex === 0 ? { phase: 'attract' as const } : { stepIndex: state.stepIndex - 1 },
    ),

  /**
   * 일정을 생성한다.
   * 분석화면 진입 즉시 호출되며, 화면은 연출 시간이 끝난 뒤 결과로 넘어간다.
   * 계산과 연출을 분리해 두면 백엔드로 교체될 때 연출 코드를 건드릴 필요가 없다.
   */
  finishAnalysis: () => {
    const { conditions, generation } = get();
    if (generation) return;

    const referenceDate = today();
    const { value, failure } = runSafely('여행일정 생성', () =>
      generateItinerary({ conditions, referenceDate, itineraryId: createItineraryId() }),
    );

    if (failure || !value) {
      set({ failure });
      return;
    }
    set({ generation: value, itinerary: value.itinerary, referenceDate, failure: undefined });
  },

  refine: (refinementId) => {
    const { itinerary, generation } = get();
    if (!itinerary || !generation) return;

    const { value, failure } = runSafely('일정 재구성', () =>
      replanItinerary({
        itinerary,
        conditions: generation.trace.conditions,
        vector: generation.trace.conditionVector,
        refinementId,
        referenceDate: get().referenceDate,
      }),
    );

    if (failure || !value) {
      set({ failure });
      return;
    }

    set((state) => ({
      itinerary: value.itinerary,
      refinements: [...state.refinements, value.trace],
      lastRefinement: value.trace,
    }));
  },

  dismissRefinement: () => set({ lastRefinement: undefined }),

  showHandoff: () => set({ phase: 'handoff', qrGenerated: true }),
  backToResult: () => set({ phase: 'result' }),

  reset: () =>
    set({
      ...freshSession(),
      phase: 'attract',
      stepIndex: 0,
      conditions: DEFAULT_CONDITIONS,
      answeredFields: [],
      scenarioId: undefined,
      generation: undefined,
      itinerary: undefined,
      refinements: [],
      lastRefinement: undefined,
      qrGenerated: false,
      failure: undefined,
    }),

  toSessionLog: ({ uiMode, theme, contrast }) => {
    const state = get();
    const { generation, itinerary } = state;
    if (!generation || !itinerary) return undefined;

    const snapshot = (target: Itinerary) => ({
      itineraryId: target.id,
      title: target.title,
      stopAttractionIds: target.days.flatMap((day) =>
        day.stops.map((stop) => stop.attractionId),
      ),
      metrics: target.metrics,
    });

    return {
      sessionId: state.sessionId,
      kioskId: KIOSK_DEPLOYMENT.id,
      kioskLocation: KIOSK_DEPLOYMENT.label,
      startedAt: state.startedAt,
      endedAt: new Date().toISOString(),
      uiMode,
      theme,
      contrast,
      scenarioId: state.scenarioId,
      conditions: generation.trace.conditions,
      conditionVector: generation.trace.conditionVector,
      retrieval: generation.trace.retrieval,
      trustAssessments: generation.trace.trustAssessments,
      candidates: generation.trace.candidates,
      exclusions: generation.trace.exclusions,
      linkage: generation.trace.linkage,
      linkageCorrection: generation.trace.linkageCorrection,
      initialItinerary: snapshot(generation.itinerary),
      refinements: state.refinements,
      finalItinerary: snapshot(itinerary),
      generationMs: generation.trace.elapsedMs,
      totalProcessingMs:
        generation.trace.elapsedMs +
        state.refinements.reduce((total, trace) => total + trace.elapsedMs, 0),
      qrGenerated: state.qrGenerated,
      qrOpened: false,
    } satisfies SessionLog;
  },
}));
