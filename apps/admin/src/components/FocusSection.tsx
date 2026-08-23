'use client';

import { useEffect, useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { Callout } from '@namdo-prism/core/ui';

/**
 * 통합 화면에서 «지금 누른 메뉴의 자리»로 데려간다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 추천 점수·후보·신뢰도·근거는 한 번의 실행에서 함께 나오는 값이라
 * 화면을 쪼개면 같은 시나리오를 네 번 돌려야 한다. 그래서 한 화면에 모아 뒀다.
 *
 * 그런데 메뉴는 넷이다. 무엇을 눌러도 같은 화면이 뜨면
 * «눌렀는데 안 바뀐다»로 읽혀 고장으로 오해된다.
 *
 * 그래서 화면을 쪼개는 대신, 누른 메뉴에 해당하는 칸으로 데려가고
 * 잠시 테두리를 둘러 «여기입니다»를 알린다.
 * 왜 한 화면인지도 함께 적어 둔다 — 이유를 모르면 설계가 엉성해 보인다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 테두리를 두르고 있을 시간. 너무 짧으면 못 보고, 길면 계속 깜빡이는 것처럼 보인다. */
const HIGHLIGHT_MS = 2600;

export interface FocusSectionProps {
  /** 데려갈 칸의 DOM id. */
  targetId: string;
  /** 그 칸의 이름. 안내문에 그대로 쓴다. */
  label: string;
  /** 왜 여러 메뉴가 한 화면을 쓰는지. */
  reason: string;
}

export function FocusSection({ targetId, label, reason }: FocusSectionProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = document.getElementById(targetId);
    if (!element) return;

    /*
      바로 옮기지 않고 한 박자 기다린다.
      화면이 그려지는 도중에 옮기면 아직 자리가 정해지지 않아 엉뚱한 곳에 선다.
    */
    const move = window.setTimeout(() => {
      /*
        맨 위(start)가 아니라 가운데에 세운다.
        위에 붙이면 두른 테두리의 윗변이 화면 밖으로 밀려 잘리고,
        그 칸이 화면의 시작인지 중간인지도 알 수 없다.
      */
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('focus-flash');
      setReady(true);
    }, 120);

    const clear = window.setTimeout(() => {
      element.classList.remove('focus-flash');
    }, HIGHLIGHT_MS);

    return () => {
      window.clearTimeout(move);
      window.clearTimeout(clear);
      element.classList.remove('focus-flash');
    };
  }, [targetId]);

  return (
    <Callout tone="brand" icon={CornerDownRight} size="sm">
      <p>
        <strong>{label}</strong> 은(는) 아래 같은 이름의 칸에 있습니다
        {ready ? ' — 그 자리로 옮겨 두었습니다.' : '.'}
      </p>
      <p className="mt-2xs leading-relaxed text-content-muted">{reason}</p>
    </Callout>
  );
}
