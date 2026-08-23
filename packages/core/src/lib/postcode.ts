import { REGION_LABELS } from '../domain/labels';
import type { Region } from '../domain/types/catalog';

/**
 * 카카오(다음) 우편번호 서비스.
 *
 * ── 왜 직접 주소를 받아 적지 않는가 ────────────────────────────────
 * 주소를 손으로 치면 「광주광역시 동구」·「광주 동구」·「광주시 동구」가 뒤섞인다.
 * 관광지 자료는 소재지 표기로 지역 분포와 권역을 나누므로, 표기가 흔들리면
 * 「관리」의 분포가 흔들리고 권역에서 관광지가 조용히 빠진다.
 * 주소를 고르게 하면 표기가 한 벌로 통일된다.
 *
 * ── 키가 필요한가 ──────────────────────────────────────────────────
 * 필요 없다. 지도 API 와 달리 우편번호 서비스는 스크립트만 불러오면 된다.
 * 대신 **인터넷이 있어야 한다.** 어드민은 사무실에서 쓰므로 전제가 성립하지만,
 * 끊겼을 때 등록 자체가 막히면 안 되므로 직접 입력 길을 함께 둔다.
 *
 * ── 왜 스크립트를 여기서 넣는가 ────────────────────────────────────
 * `<head>` 에 고정으로 박으면 주소를 한 번도 안 여는 사람도 매번 내려받는다.
 * 처음 열 때 한 번만 넣고, 그 약속을 기억해 두 번째부터는 곧바로 쓴다.
 */

const SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const SCRIPT_ID = 'daum-postcode';

/** 우편번호 창이 돌려주는 값 중 실제로 쓰는 것만. */
export interface PostcodeResult {
  /** 도로명 주소. 없는 곳도 있어 지번으로 갈음한다. */
  roadAddress: string;
  jibunAddress: string;
  /** 「광주광역시」·「전라남도」 같은 시·도 이름. */
  sido: string;
  /** 「동구」·「담양군」 같은 시·군·구 이름. */
  sigungu: string;
  zonecode: string;
}

interface PostcodeConstructor {
  new (options: {
    oncomplete: (data: PostcodeResult) => void;
    onclose?: () => void;
    width?: string;
    height?: string;
  }): { embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void };
}

declare global {
  interface Window {
    daum?: { Postcode: PostcodeConstructor };
  }
}

/** 스크립트를 넣는 약속. 여러 번 불러도 한 번만 실제로 넣는다. */
let loading: Promise<PostcodeConstructor> | undefined;

export function loadPostcode(): Promise<PostcodeConstructor> {
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('브라우저에서만 쓸 수 있습니다.'));
      return;
    }
    if (window.daum?.Postcode) {
      resolve(window.daum.Postcode);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => {
      const constructor = window.daum?.Postcode;
      if (constructor) resolve(constructor);
      else reject(new Error('우편번호 서비스를 불러오지 못했습니다.'));
    });
    script.addEventListener('error', () => {
      // 다음에 다시 열었을 때 재시도할 수 있도록 약속을 지운다.
      loading = undefined;
      reject(new Error('우편번호 서비스에 연결하지 못했습니다.'));
    });
    if (!existing) document.head.append(script);
  });

  return loading;
}

/** 시·도 이름이 광주·전남 중 어디인지. 그 밖이면 `undefined`. */
const SIDO_TO_REGION: Record<string, Region> = {
  광주광역시: 'gwangju',
  광주: 'gwangju',
  전라남도: 'jeonnam',
  전남: 'jeonnam',
};

export interface ResolvedDistrict {
  region: Region;
  /** 관광지 자료의 소재지 표기. 「전남 담양군」처럼 지역까지 붙인다. */
  district: string;
}

/**
 * 고른 주소에서 지역과 소재지를 뽑는다.
 *
 * 광주·전남 밖이면 `undefined` 를 돌려준다 — 사업 범위 밖의 주소를 조용히
 * 「광주」로 적어 두면 추천에 엉뚱한 곳이 섞인다.
 *
 * 시·군·구가 「담양군」처럼 한 덩어리가 아니라 「용인시 수지구」로 오는 곳도 있는데,
 * 광주·전남에는 그런 곳이 없으므로 받은 값을 그대로 붙인다.
 */
export function resolveDistrict(result: PostcodeResult): ResolvedDistrict | undefined {
  const region = SIDO_TO_REGION[result.sido.trim()];
  if (!region) return undefined;

  const sigungu = result.sigungu.trim();
  if (sigungu.length === 0) return undefined;

  return { region, district: `${REGION_LABELS[region]} ${sigungu}` };
}
