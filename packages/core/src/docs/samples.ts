/**
 * 요구사항 정의서 부록(샘플 코드) 의 원본.
 *
 * ── 왜 요구사항 정의서에 코드가 들어가는가 ─────────────────────────
 * 이 저장소는 프런트엔드만 만든다. 화면은 이미 그려져 있고, 값을 채울 자료를
 * 백엔드가 내려주면 그대로 살아난다. 그런데 «어떤 모양으로 주면 되는가»가
 * 글로만 적혀 있으면 받는 쪽과 주는 쪽이 서로 다른 것을 상상한 채 만들게 된다.
 *
 * 그래서 양쪽에서 한 벌씩 — 프런트엔드가 부르는 자리와 백엔드가 응답하는 자리를
 * 같은 계약으로 적어 둔다. 두 코드가 한 화면에 나란히 있어야 «이 값이 저기서
 * 온다»가 눈으로 확인된다.
 *
 * ── 무엇을 예로 골랐는가 ───────────────────────────────────────────
 * 세션 로그 조회를 골랐다. 지금 「백엔드 대기」로 표시된 화면 여섯 개
 * (로그 4종 · 이용 패턴 · QR 전환률)가 모두 이 한 가지 자료를 기다리므로,
 * 이것 하나가 붙으면 가장 많은 화면이 함께 살아난다.
 *
 * 아래 경로와 인증 방식은 **예시**다. 실제 경로는 백엔드가 정하되, 응답에
 * 담기는 필드의 이름과 뜻은 이 모양을 유지해야 화면 코드를 고치지 않는다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 부록에 싣는 코드 한 벌. */
export interface DocCodeSample {
  id: string;
  /** 어느 쪽 코드인가. */
  side: 'frontend' | 'backend';
  title: string;
  /** 이 코드가 있는 자리. 실제 파일이면 그 경로, 아직 없으면 놓일 자리를 적는다. */
  path: string;
  /** 무엇을 하는 코드인지 한 문단. */
  purpose: string;
  language: string;
  code: string;
  /** 읽는 사람이 놓치기 쉬운 것. 「왜 이렇게 했는가」만 적는다. */
  notes: readonly string[];
}

const FRONTEND_SAMPLE: DocCodeSample = {
  id: 'SAMPLE-FE',
  side: 'frontend',
  title: '세션 로그를 불러와 화면에 넣는다',
  path: 'apps/admin/src/state/logs.ts',
  purpose:
    '어드민의 로그·사용자 화면 여섯 개가 이 저장소 하나를 본다. 서버에서 받아 오는 일을 여기 한 곳에 두었으므로, 백엔드 경로가 정해지면 화면 코드는 그대로 두고 이 파일만 고치면 된다.',
  language: 'TypeScript',
  code: `import { create } from 'zustand';
import type { SessionLog } from '@namdo-prism/core/lib';

/**
 * 세션 로그 저장소.
 *
 * 화면은 \`sessions\` 와 \`status\` 만 본다. 어디서 어떻게 받아 오는지는 모른다 —
 * 그래야 파일 업로드에서 API 호출로 바뀌어도 화면을 고치지 않는다.
 */

/** 백엔드가 정해지면 이 한 줄만 바꾼다. */
const SESSIONS_ENDPOINT = '/api/sessions';

/**
 * 「없다」와 「못 받았다」를 나눈다.
 *
 * 둘을 섞으면 서버가 죽은 날에도 화면이 「등록된 내역이 없습니다」라고 적는다.
 * 자료가 없어서 빈 것과 불러오지 못해 빈 것은 관리자가 해야 할 일이 다르다.
 */
type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface AdminLogState {
  sessions: readonly SessionLog[];
  status: LoadStatus;
  loadSessions: (range?: { from?: string; to?: string }) => Promise<void>;
}

export const useAdminLog = create<AdminLogState>((set) => ({
  sessions: [],
  status: 'idle',

  loadSessions: async (range) => {
    set({ status: 'loading' });

    const query = new URLSearchParams();
    if (range?.from) query.set('from', range.from);
    if (range?.to) query.set('to', range.to);

    try {
      const response = await fetch(
        query.size > 0 ? \`\${SESSIONS_ENDPOINT}?\${query}\` : SESSIONS_ENDPOINT,
        { headers: { Accept: 'application/json' } },
      );

      // 200 이 아니면 본문을 읽지 않는다. 오류 페이지를 세션으로 오해하지 않기 위함이다.
      if (!response.ok) throw new Error(\`세션 로그 조회 실패 (\${response.status})\`);

      const body = (await response.json()) as { sessions: SessionLog[] };
      set({ sessions: body.sessions, status: 'ready' });
    } catch (cause) {
      /*
        전시장에서 화면이 백지가 되지 않도록 예외를 여기서 붙잡는다.
        표는 앞서 받아 둔 값을 그대로 들고 있고, 화면은 status 로 다시 시도 안내를 그린다.
      */
      console.error('[남도프리즘] 세션 로그를 불러오지 못했습니다', cause);
      set({ status: 'failed' });
    }
  },
}));`,
  notes: [
    '받아 오는 일을 화면이 아니라 저장소에 둔다. 여섯 화면이 같은 자료를 보므로 각자 부르면 같은 요청이 여섯 번 나간다.',
    '`status` 를 따로 둔다. 「자료가 없어 비었다」와 「불러오지 못해 비었다」는 화면에 적어야 할 말이 다르다.',
    '응답이 200 이 아니면 본문을 읽지 않는다. 오류 페이지의 HTML 을 세션 목록으로 넘겨받는 일을 막는다.',
    '예외를 붙잡아 상태로 바꾼다. 이벤트 핸들러에서 던진 예외는 React 오류 경계가 잡지 못해 화면이 비어 버린다.',
  ],
};

const BACKEND_SAMPLE: DocCodeSample = {
  id: 'SAMPLE-BE',
  side: 'backend',
  title: '세션 로그를 내려주는 API',
  path: 'server/routes/sessions.ts (예시 · 이 저장소에는 없음)',
  purpose:
    '키오스크가 남긴 세션을 어드민이 읽을 수 있게 내려준다. 프런트엔드는 이 응답의 필드 이름과 뜻만 보고 화면을 그리므로, 저장 구조가 무엇이든 이 모양으로만 바꿔 주면 된다.',
  language: 'TypeScript (Express)',
  code: `import { Router } from 'express';
import { z } from 'zod';
import { sessionRepository } from '../repository/sessions';

/**
 * 세션 로그 조회.
 *
 *   GET /api/sessions?from=2026-08-01&to=2026-08-31&limit=200
 *
 * 프런트엔드가 보는 것은 응답의 «필드 이름과 뜻»뿐이다. 저장 구조·ORM·경로는
 * 백엔드가 정하되, 아래 이름은 유지해야 화면 코드를 고치지 않는다.
 */
export const sessionsRouter = Router();

/** 조회 조건. 검증하지 않고 그대로 넘기면 잘못된 날짜 하나가 전체 조회가 된다. */
const querySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  /** 한 번에 내려주는 최대 건수. 상한이 없으면 전시 기간 전체가 한 응답에 실린다. */
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

sessionsRouter.get('/api/sessions', async (request, response) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) {
    // 무엇이 잘못됐는지 적어 준다. 400 만 던지면 부르는 쪽이 고칠 곳을 모른다.
    return response.status(400).json({
      message: '조회 조건이 올바르지 않습니다.',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        reason: issue.message,
      })),
    });
  }

  const { from, to, limit } = parsed.data;
  const rows = await sessionRepository.findMany({ from, to, limit });

  /*
    비어 있는 것은 오류가 아니다.
    조회 조건에 맞는 세션이 없으면 빈 배열을 200 으로 준다 — 404 로 주면
    화면이 「불러오지 못했다」로 읽어 관리자에게 없는 장애를 알리게 된다.
  */
  return response.json({
    sessions: rows.map((row) => ({
      sessionId: row.id,
      startedAt: row.startedAt.toISOString(),
      kioskLocation: row.kioskLocation,
      uiMode: row.uiMode,
      conditions: row.conditions,
      retrieval: {
        query: row.retrievalQuery,
        documents: row.retrievedDocuments,
      },
      candidates: row.candidates,
      exclusions: row.exclusions,
      refinements: row.refinements,
      finalItinerary: row.finalItinerary,
      qrGenerated: row.qrGenerated,
      qrOpened: row.qrOpened,
    })),
    total: rows.length,
  });
});`,
  notes: [
    '개인을 식별할 수 있는 값을 담지 않는다. 세션 식별자는 그 한 번의 이용을 가리킬 뿐 사람을 가리키지 않는다.',
    '결과가 없으면 빈 배열을 200 으로 준다. 404 로 주면 화면이 장애로 읽어 없는 오류를 알린다.',
    '한 번에 내려주는 건수에 상한을 둔다. 전시 기간이 길어질수록 조건 없는 조회 하나가 응답 전체를 무겁게 만든다.',
    '조회 조건이 틀렸을 때 어떤 칸이 왜 틀렸는지 함께 준다. 부르는 쪽이 고칠 곳을 알 수 있어야 한다.',
    '날짜는 ISO 8601 문자열로 준다. 화면이 그 값으로 갱신일·휴무일을 판정하므로 표기가 흔들리면 판정이 흔들린다.',
  ],
};

export const DOC_CODE_SAMPLES: readonly DocCodeSample[] = [FRONTEND_SAMPLE, BACKEND_SAMPLE];

export const DOC_SAMPLE_INTRO =
  '이 저장소는 프런트엔드만 만든다. 화면은 이미 그려져 있고 값을 채울 자료만 기다리므로, 「백엔드 대기」로 표시한 화면이 무엇을 어떤 모양으로 받아야 하는지를 양쪽 코드로 한 벌씩 적는다. 아래 예시는 지금 가장 많은 화면이 기다리는 자료 — 키오스크 세션 로그 — 를 기준으로 한다. 경로와 인증 방식은 예시이며 백엔드가 정한다. 다만 응답 필드의 이름과 뜻이 달라지면 화면 코드를 고쳐야 한다.';

export const DOC_SAMPLE_SIDE_LABELS: Record<DocCodeSample['side'], string> = {
  frontend: '프런트엔드',
  backend: '백엔드',
};
