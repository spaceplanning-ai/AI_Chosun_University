'use client';

import { useEffect, useState } from 'react';
import { loadKakaoMaps } from './kakaoLoader';

/**
 * 카카오맵을 **실제로 쓸 수 있는지** 확인되면 알린다.
 *
 * ── 왜 «해 보고 되돌리기»가 아니라 «되면 바꾸기»인가 ───────────────
 * 예전에는 키가 있으면 일단 카카오맵을 그려 놓고, 실패하면 안내도로 되돌렸다.
 * 그런데 실패를 아는 데 시간이 걸린다 — 키가 거절되면 2~3초, 오프라인이면 6초.
 * 그동안 화면에는 **아무것도 없는 회색 상자**가 서 있다. 대기화면에서 이건 고장으로 보인다.
 *
 * 그래서 순서를 뒤집었다. 확인되기 전에는 오프라인 안내도를 보여 준다 —
 * 안내도는 자료가 이미 손에 있어 곧바로 그려진다. 지도가 준비되면 그때 바꾼다.
 * 온라인에서는 SDK 가 수백 ms 안에 오므로 바뀌는 것이 거의 눈에 띄지 않고,
 * 무엇보다 **어느 순간에도 빈 화면이 없다.**
 */
export function useKakaoReady(appKey: string | undefined): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 약속이 풀린 뒤에 상태를 바꾼다 — 렌더 도중이 아니므로 렌더가 연쇄되지 않는다.
    void loadKakaoMaps(appKey).then((ok) => {
      if (!cancelled && ok) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [appKey]);

  return ready;
}
