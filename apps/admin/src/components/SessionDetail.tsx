'use client';

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  COMPANION_LABELS,
  DURATION_LABELS,
  INTEREST_LABELS,
  TRANSPORT_LABELS,
} from '@namdo-prism/core/domain';
import { formatElapsed, formatTimestamp, type SessionLog } from '@namdo-prism/core/lib';
import { Button, Panel } from '@namdo-prism/core/ui';

/**
 * 로그 상세 — 줄 하나가 어느 세션에서 나왔는지 되짚는 자리.
 *
 * ── 왜 네 화면이 같은 상세를 쓰는가 ────────────────────────────────
 * 세션 로그·검색 로그·추천 로그·에러 로그는 모두 **같은 세션**을 각자의 각도로 자른 것이다.
 * 상세를 화면마다 따로 그리면 「검색 로그에서는 UI 모드가 보이는데 추천 로그에서는 안 보이는」
 * 식으로 갈려, 두 화면을 오가며 같은 세션을 볼 때 서로 다른 세션처럼 읽힌다.
 *
 * 그래서 «세션이 무엇이었나»는 여기서 한 벌로 정하고,
 * 화면마다 다른 것(회수 문서 표, 후보 점수 표)만 아래에 덧붙인다.
 */

export interface SessionDetailProps {
  /** 상세 머리말. 무엇을 보러 들어왔는지 화면마다 다르다. */
  title: string;
  description?: string;
  session: SessionLog;
  /** 목록으로 돌아간다. */
  onBack: () => void;
  /** 이 화면만의 표. 세션 정보 아래 구분선 다음에 놓인다. */
  children?: ReactNode;
}

/** 세션 하나를 읽을 수 있는 줄로 편다. 값의 순서가 곧 읽는 순서다. */
function factsOf(session: SessionLog): { label: string; value: string }[] {
  const { conditions } = session;
  return [
    { label: '세션', value: session.sessionId },
    { label: '키오스크', value: `${session.kioskId} · ${session.kioskLocation}` },
    { label: '시작 시각', value: formatTimestamp(session.startedAt) },
    { label: '화면 모드', value: session.uiMode === 'large' ? '큰 글씨' : '일반' },
    { label: '동행', value: COMPANION_LABELS[conditions.companion] },
    { label: '여행 기간', value: DURATION_LABELS[conditions.duration] },
    {
      label: '관심 유형',
      value:
        conditions.interests.map((interest) => INTEREST_LABELS[interest]).join(' · ') || '미선택',
    },
    { label: '이동 수단', value: TRANSPORT_LABELS[conditions.transport] },
    { label: '출발지', value: conditions.origin },
    { label: '일정 생성 시간', value: formatElapsed(session.generationMs) },
    { label: '누적 처리 시간', value: formatElapsed(session.totalProcessingMs) },
    { label: '회수 문서', value: `${session.retrieval.documents.length}건` },
    { label: '연계지수', value: `${session.finalItinerary.metrics.linkageScore}점` },
    { label: '재구성 요청', value: `${session.refinements.length}건` },
    {
      label: 'QR',
      // 만들기만 한 것과 실제로 열어 본 것은 다른 사건이다. 한 칸에 함께 적는다.
      value: session.qrGenerated ? (session.qrOpened ? '생성 · 열람' : '생성') : '없음',
    },
  ];
}

export function SessionDetail({ title, description, session, onBack, children }: SessionDetailProps) {
  return (
    <div className="flex flex-col gap-lg">
      <Panel
        title={title}
        description={description}
        action={
          <Button size="sm" variant="quiet" iconLeft={ChevronLeft} onClick={onBack}>
            목록으로
          </Button>
        }
      >
        <dl className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
          {factsOf(session).map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-2xs">
              <dt className="text-caption font-semibold text-content">{fact.label}</dt>
              <dd className="flex min-h-control-sm items-center rounded-control bg-surface-sunken px-md py-xs text-caption text-content">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        {children === undefined ? null : (
          <>
            <hr className="my-lg border-0 border-t border-line-subtle" />
            {children}
          </>
        )}
      </Panel>
    </div>
  );
}
