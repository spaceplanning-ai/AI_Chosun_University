/**
 * 화면 정의 원본.
 *
 * 요구사항 정의서·기능 명세서·화면 정의서가 모두 이 배열 하나를 읽는다.
 * 세 문서를 따로 손으로 쓰면 화면 하나를 고칠 때 세 곳을 고쳐야 하고,
 * 한 곳을 빠뜨리면 «문서끼리 서로 다른 말을 하는» 상태가 조용히 남는다.
 *
 * 적는 규칙은 셋뿐이다.
 *   ① 화면에 실제로 있는 조작만 적는다.
 *   ② 수치는 코드 상수를 그대로 옮기고, 정해지지 않았으면 TBD 로 둔다.
 *   ③ 관리자가 못 바꾸는 값은 «못 바꾼다»고 적는다.
 *
 * 어드민 화면 id 는 `apps/admin/src/config/navigation.ts` 와 같아야 한다.
 * 어긋나면 생성기가 문서를 만들지 않고 멈춘다.
 */

import type { DocScreen } from './types';

/* ────────────────────────────────────────────────────────────────
   키오스크 — 전시장 세로형 터치 (관람객용, 포트 3000)
   ──────────────────────────────────────────────────────────────── */

const KIOSK_SCREENS: readonly DocScreen[] = [
  {
    app: 'kiosk',
    id: 'attract',
    name: '대기화면',
    area: '대기',
    code: 'ATTRACT-001',
    route: '/ (phase: attract)',
    readiness: 'working',
    basis: '제안서 6.1',
    purpose: '지나가는 관람객에게 무엇을 하는 기기인지 알리고, 지역을 눌러 체험을 시작하게 한다.',
    requirement:
      '전시장에 세워 둔 기기의 진입 화면으로, 조작하지 않는 동안 광주·전남 광역 안내도를 표시하여 무엇을 다루는 기기인지 알린다. 안내 문구를 읽게 하는 대신 지도의 지역을 직접 누르게 하여, 설명 없이도 체험이 시작되도록 구성한다.',
    entry: [
      '키오스크 부팅 직후 첫 화면',
      '결과화면·QR화면에서 「처음으로」 선택',
      '무조작 대기시간 초과에 따른 자동 복귀',
    ],
    areas: [
      {
        name: '광역 안내도',
        content:
          '광주광역시 5개 자치구와 전남·전북 시군 경계를 지도 위에 덧그린다. 확대 단계에 따라 시·도 이름만 보이다가 시군구 이름으로 바뀐다.',
        source: 'packages/core/src/data/namdoAreas.geometry.ts (행정경계) · 공개 지도 타일',
      },
      {
        name: '지역 상세 패널',
        content: '고른 지역의 이름과 그 지역에 등록된 관광지 목록을 왼쪽에 편다.',
        source: 'packages/core/src/data/attractions.json',
      },
      {
        name: '확대·축소 조작부',
        content: '지도 오른쪽 아래의 확대·축소 단추와 현재 확대 단계 표시.',
        source: '지도 라이브러리 기본 조작부',
      },
      { name: '시작 안내', content: '체험을 시작하는 큰 단추.', source: '고정 문구' },
    ],
    features: [
      {
        id: 'KIO-ATT-01',
        action: '관람객이 지도에서 지역을 선택한다.',
        process: '선택한 지역 코드로 등록된 관광지를 걸러 낸다.',
        result: '왼쪽 패널이 열리고 그 지역의 관광지 목록이 표시된다.',
      },
      {
        id: 'KIO-ATT-02',
        action: '관람객이 확대·축소 단추를 선택한다.',
        process: '확대 단계에 맞는 경계선 굵기와 이름표 노출 범위를 다시 계산한다.',
        result: '멀리서는 시·도 이름만, 가까이서는 시군구 이름이 표시된다.',
      },
      {
        id: 'KIO-ATT-03',
        action: '관람객이 「여행 조건 고르기」를 선택한다.',
        process: '세션 식별자와 시작 시각을 새로 만들어 세션을 연다.',
        result: '여행조건 선택 1단계로 이동한다.',
      },
      {
        id: 'KIO-ATT-04',
        action: '진행자가 좌측 상단 로고를 연속으로 5회 누른다.',
        process: '2초 안에 이어진 터치만 세어 진행자 패널 열림 조건을 판정한다.',
        result: '진행자 패널이 열린다.',
      },
    ],
    guards: [
      '지도 타일을 받지 못하면 내장 도형 안내도로 대체한다. 전시장 회선이 끊겨도 화면이 비지 않는다.',
      '고른 지역에 등록된 관광지가 없으면 목록 대신 「등록된 내역이 없습니다.」를 표시한다.',
    ],
    exits: ['여행조건 선택 1단계', '진행자 패널'],
    adminControl:
      '지역별 관광지 목록은 「관광지 › 등록」에서 바꾼 값을 따른다. 지도 경계·확대 단계·대기화면 문구는 관리자 화면에 없다.',
  },
  {
    app: 'kiosk',
    id: 'wizard',
    name: '여행조건 선택',
    area: '조건',
    code: 'CONDITION-001',
    route: '/ (phase: wizard, 5단계)',
    readiness: 'working',
    basis: '제안서 6.2',
    purpose: '추천에 필요한 조건 다섯 가지를 한 단계에 하나씩 받는다.',
    requirement:
      '추천에 필요한 조건을 동행·기간·관심사·이동수단·특별조건 다섯 단계로 나누어 받는다. 한 화면에 모든 질문을 세우지 않고 단계마다 하나씩 묻는 구성으로, 서서 조작하는 이용자가 읽어야 할 양을 단계당 한 문장으로 제한한다.',
    entry: ['대기화면에서 체험 시작', '진행자 패널에서 시연 시나리오 재생'],
    areas: [
      {
        name: '진행 표시',
        content: '전체 5단계 중 지금 몇 번째인지.',
        source: 'packages/core/src/config/wizard.ts',
      },
      {
        name: '질문·보조 설명',
        content: '단계별 질문 한 줄과 그 아래 보조 설명 한 줄.',
        source: 'packages/core/src/config/wizard.ts',
      },
      {
        name: '선택지 격자',
        content: '선택지 이름·아이콘·짧은 힌트. 복수 선택 단계는 고른 개수를 함께 표시한다.',
        source: 'packages/core/src/domain/labels.ts',
      },
      { name: '이동 단추', content: '이전 단계·다음 단계.', source: '고정 문구' },
    ],
    features: [
      {
        id: 'KIO-WIZ-01',
        action: '관람객이 단일 선택 단계에서 선택지 하나를 선택한다.',
        process: '해당 조건 항목의 값을 바꾸고 «관람객이 실제로 답한 항목»으로 기록한다.',
        result: '선택 표시가 켜지고 다음 단계로 넘어갈 수 있다.',
      },
      {
        id: 'KIO-WIZ-02',
        action: '관람객이 복수 선택 단계에서 선택지를 선택한다.',
        process: '상한(관심사·특별조건 각 3개)을 넘으면 가장 먼저 고른 것을 밀어낸다.',
        result: '고른 항목이 표시되고 개수가 상한을 넘지 않는다.',
      },
      {
        id: 'KIO-WIZ-03',
        action: '관람객이 특별조건 단계에서 「특별한 조건이 없어요」를 선택한다.',
        process: '같은 단계에서 고른 나머지 항목을 모두 해제한다.',
        result: '그 항목 하나만 선택된 상태가 된다.',
      },
      {
        id: 'KIO-WIZ-04',
        action: '관람객이 마지막 단계에서 「다음」을 선택한다.',
        process: '모인 조건으로 추천 엔진을 돌려 후보·점수·제외 사유·근거 문서를 만든다.',
        result: 'AI 분석화면으로 이동한다.',
      },
      {
        id: 'KIO-WIZ-05',
        action: '관람객이 「이전」을 선택한다.',
        process: '단계 번호를 하나 줄인다. 이미 고른 값은 지우지 않는다.',
        result: '앞 단계로 돌아가고 앞서 고른 값이 그대로 표시된다.',
      },
    ],
    guards: [
      '아무것도 고르지 않은 단계는 기본값이 채워져 있어도 「답했음」으로 기록하지 않는다. 연구 로그가 고르지 않은 값을 고른 것으로 세지 않게 한다.',
      '추천 엔진이 예외를 던지면 화면을 비우지 않고 안내 문구로 바꾼다.',
    ],
    exits: ['AI 분석화면', '이전 단계', '무조작 시 대기화면'],
    adminControl: '단계 구성·질문 문구·선택지는 코드(config/wizard.ts)에 있고 관리자 화면에서 바꿀 수 없다.',
  },
  {
    app: 'kiosk',
    id: 'analysis',
    name: 'AI 분석화면',
    area: '분석',
    code: 'ANALYSIS-001',
    route: '/ (phase: analysis)',
    readiness: 'working',
    basis: '제안서 6.3',
    purpose: '추천이 만들어지는 과정을 단계별로 보여 주어 결과가 어디서 나왔는지 알 수 있게 한다.',
    requirement:
      '조건 선택과 결과 사이에서 추천이 만들어지는 과정을 단계별로 표시한다. 대기 시간을 채우는 연출이 아니라 실제 처리 단계의 이름과 그 단계에서 나온 건수를 표시하여, 결과가 어디서 나왔는지 관람객이 확인할 수 있게 한다.',
    entry: ['여행조건 선택 마지막 단계 완료'],
    areas: [
      {
        name: '처리 단계 목록',
        content:
          '취향 분석 → 공식 관광정보 검색(확인 문서 수) → 광주 후보 수 → 전남 후보 수 → 제외 수 → 일정 구성 순으로 한 줄씩 켜진다.',
        source: '직전에 끝난 추천 계산의 실제 결과값',
      },
      {
        name: '진행 막대',
        content: '전체 노출시간 대비 진행 정도.',
        source: 'packages/core/src/config/kiosk.ts',
      },
    ],
    features: [
      {
        id: 'KIO-ANA-01',
        action: '관람객이 분석화면에 들어온다.',
        process: '이미 끝난 계산 결과에서 문서 수·후보 수·제외 수를 읽어 단계 문구를 만든다.',
        result: '단계가 순서대로 켜지며 각 줄에 실제 건수가 표시된다.',
      },
      {
        id: 'KIO-ANA-02',
        action: '관람객이 마지막 단계까지 기다린다.',
        process: '총 노출시간이 지나면 결과화면으로 넘긴다.',
        result: '여행결과 화면이 표시된다.',
      },
    ],
    guards: ['계산 결과가 없으면 건수 자리에 0을 적는다. 없는 숫자를 지어내지 않는다.'],
    exits: ['여행결과 화면'],
    adminControl: '노출시간과 단계 간격은 코드 상수이며 관리자 화면에서 바꿀 수 없다.',
  },
  {
    app: 'kiosk',
    id: 'result',
    name: '여행결과',
    area: '결과',
    code: 'RESULT-001',
    route: '/ (phase: result)',
    readiness: 'working',
    basis: '제안서 6.4 · 6.5',
    purpose: '추천 일정과 그렇게 짠 이유를 함께 보여 주고, 마음에 들지 않으면 그 자리에서 바꿀 수 있게 한다.',
    requirement:
      '추천된 일정을 일자별로 제시하고, 각 관광지가 뽑힌 근거와 제외된 곳의 사유를 같은 화면에서 확인할 수 있게 한다. 결과가 맞지 않을 때 조건 선택으로 돌아가지 않고 그 자리에서 일정을 수정할 수 있도록 수정 요청 단추를 함께 제공한다.',
    entry: ['AI 분석화면 완료', 'QR 화면에서 「일정으로 돌아가기」'],
    areas: [
      { name: '일정 제목·요약', content: '만들어진 일정의 제목과 총 일수.', source: '추천 엔진 결과' },
      { name: '일자 선택 띠', content: '전체 보기와 1일차·2일차… 선택.', source: '추천 엔진 결과' },
      {
        name: '일정 타임라인',
        content: '시각·관광지 이름·머무는 시간·이동시간을 차례로 적은 줄.',
        source: '추천 엔진 결과',
      },
      {
        name: '지표 요약',
        content: '보행부담·이동시간·평균 신뢰도·연계지수 네 가지.',
        source: '추천 엔진 결과',
      },
      {
        name: '근거 시트',
        content: '접혀 있다가 펼치면 관광지별 점수 구성·제외 사유·근거 문서와 갱신일이 나온다.',
        source: '추천 엔진 결과 · officialDocuments.json',
      },
      {
        name: '수정 요청 줄',
        content: '납품 단계에 따라 노출되는 수정 요청 단추.',
        source: 'packages/core/src/config/refinements.ts',
      },
      { name: '지도', content: '일정 방문지의 위치와 이동 경로.', source: 'attractions.json 좌표' },
    ],
    features: [
      {
        id: 'KIO-RES-01',
        action: '관람객이 일자를 선택한다.',
        process: '고른 일자의 방문지만 걸러 낸다.',
        result: '그 날의 일정만 타임라인과 지도에 표시된다.',
      },
      {
        id: 'KIO-RES-02',
        action: '관람객이 관광지 줄을 선택한다.',
        process: '그 관광지의 점수 구성과 근거 문서를 찾는다.',
        result: '근거 시트가 열려 왜 뽑혔는지와 출처가 표시된다.',
      },
      {
        id: 'KIO-RES-03',
        action: '관람객이 수정 요청 단추를 선택한다.',
        process: '요청에 대응하는 조건 변화량을 적용해 최소 변경으로 일정을 다시 짠다.',
        result: '바뀐 일정과 «무엇이 어떻게 바뀌었는지» 비교표가 표시된다.',
      },
      {
        id: 'KIO-RES-04',
        action: '관람객이 비교표를 닫는다.',
        process: '비교 표시만 접고 바뀐 일정은 그대로 둔다.',
        result: '수정된 일정 화면으로 돌아온다.',
      },
      {
        id: 'KIO-RES-05',
        action: '관람객이 「휴대폰으로 가져가기」를 선택한다.',
        process: '일정 내용을 주소 문자열로 부호화한다.',
        result: 'QR 연계화면으로 이동한다.',
      },
    ],
    guards: [
      '수정 요청이 조건을 만족하는 대안을 찾지 못하면 일정을 바꾸지 않고 그 사실을 안내한다.',
      '정보 신뢰도가 기준 점수에 못 미치는 관광지는 후보에서 제외하고, 제외 사유를 근거 시트에 남긴다.',
      '무조작이 이어지면 대기화면으로 돌아간다. 결과화면은 다른 화면보다 대기시간을 길게 둔다.',
    ],
    exits: ['QR 연계화면', '대기화면'],
    adminControl:
      '점수 배점·신뢰도 임계값·후보 수는 「추천 엔진 › 관리」와 「추천 엔진 › 설정」에서 실험값으로 바꿀 수 있다. 운영값은 코드 상수이며 두 값은 구분해 다룬다.',
  },
  {
    app: 'kiosk',
    id: 'handoff',
    name: 'QR 연계화면',
    area: '연계',
    code: 'HANDOFF-001',
    route: '/ (phase: handoff)',
    readiness: 'working',
    basis: '제안서 6.6',
    purpose: '만든 일정을 관람객의 휴대폰으로 옮긴다.',
    requirement:
      '만들어진 일정을 관람객이 가져갈 수 있도록 QR 코드로 제공한다. 서버에 일정을 저장한 뒤 조회 주소를 주는 방식이 아니라 일정 자체를 주소에 담아, 회선이 끊긴 전시장에서도 촬영한 휴대폰이 결과를 열 수 있게 한다.',
    entry: ['여행결과 화면에서 「휴대폰으로 가져가기」'],
    areas: [
      { name: 'QR 코드', content: '모바일 주소와 일정 내용이 함께 담긴 코드.', source: '현재 세션의 일정' },
      { name: '안내 문구', content: '촬영 방법과 개인정보를 수집하지 않는다는 안내.', source: '고정 문구' },
      { name: '이동 단추', content: '일정으로 돌아가기 · 처음으로.', source: '고정 문구' },
    ],
    features: [
      {
        id: 'KIO-QR-01',
        action: '관람객이 QR 화면에 들어온다.',
        process: '일정의 관광지 식별자 목록과 여행조건을 주소에 담아 QR 코드를 그린다.',
        result: 'QR 코드가 표시된다.',
      },
      {
        id: 'KIO-QR-02',
        action: '관람객이 「처음으로」를 선택한다.',
        process: '세션을 로그 한 건으로 굳히고 상태를 비운다.',
        result: '대기화면으로 돌아간다.',
      },
    ],
    guards: ['일정이 없으면 이 화면을 그리지 않는다.'],
    exits: ['여행결과 화면', '대기화면'],
    adminControl: 'QR 에 담기는 내용과 모바일 주소는 코드에 있으며 관리자 화면에서 바꿀 수 없다.',
  },
  {
    app: 'kiosk',
    id: 'presenter',
    name: '진행자 패널',
    area: '운영',
    code: 'PRESENTER-001',
    route: '/ (숨은 제스처)',
    readiness: 'working',
    basis: '제안서 11.5 · 피드백 3.1',
    purpose: '시연 진행자가 대표 사례를 즉시 재생하고, 쌓인 익명 로그를 파일로 꺼낸다.',
    requirement:
      '시연 진행자가 대표 조건 조합을 즉시 재생하고 쌓인 익명 로그를 파일로 꺼낼 수 있도록 한다. 관람객이 우연히 열 수 없어야 하므로 화면에 단추를 두지 않고 숨은 제스처로만 연다.',
    entry: ['대기화면에서 좌측 상단 로고 5회 연속 터치(2초 이내)'],
    areas: [
      {
        name: '시연 시나리오 목록',
        content: '대표 조건 조합을 담은 시나리오 단추.',
        source: 'packages/core/src/data/scenarios.ts',
      },
      {
        name: '내보내기',
        content: '세션 로그를 CSV·JSON·통합문서로 저장.',
        source: '브라우저에 쌓인 세션 로그',
      },
    ],
    features: [
      {
        id: 'KIO-PRE-01',
        action: '진행자가 시연 시나리오를 선택한다.',
        process: '그 시나리오의 여행조건을 그대로 세션에 넣고 추천을 돌린다.',
        result: '해당 조건의 결과화면이 바로 표시된다.',
      },
      {
        id: 'KIO-PRE-02',
        action: '진행자가 로그 내보내기를 선택한다.',
        process: '브라우저에 쌓인 세션 로그를 표 형식으로 바꾼다.',
        result: '파일이 내려받아진다.',
      },
    ],
    guards: ['관람객이 우연히 열 수 없도록 연속 터치 간격이 2초를 넘으면 세던 횟수를 버린다.'],
    exits: ['패널 닫기', '결과화면'],
    adminControl: '시연 시나리오 구성은 코드에 있으며 관리자 화면에서 바꿀 수 없다.',
  },
];

/* ────────────────────────────────────────────────────────────────
   모바일 — QR 로 열리는 결과 열람 (포트 3001)
   ──────────────────────────────────────────────────────────────── */

const MOBILE_SCREENS: readonly DocScreen[] = [
  {
    app: 'mobile',
    id: 'landing',
    name: '안내 화면',
    area: '모바일',
    code: 'MOBILE-001',
    route: '/',
    readiness: 'working',
    purpose: '토큰 없이 주소만 열었을 때 무엇을 해야 하는지 알린다.',
    requirement:
      'QR 없이 주소만 연 이용자에게 무엇을 해야 하는지 알린다. 일정 목록이나 검색을 두지 않는데, 이 서비스는 개인 자료를 저장하지 않으므로 조회할 대상 자체가 없기 때문이다.',
    entry: ['모바일 주소를 직접 입력', '결과 페이지에서 「안내 화면으로」'],
    areas: [
      {
        name: '안내 문구',
        content: '키오스크에서 일정을 만든 뒤 QR 을 촬영하라는 안내와, 설치·가입·개인정보 수집이 없다는 고지.',
        source: '고정 문구',
      },
    ],
    features: [
      {
        id: 'MOB-LAN-01',
        action: '이용자가 토큰 없이 주소를 연다.',
        process: '조회할 일정이 없음을 판정한다.',
        result: '이용 방법 안내가 표시된다.',
      },
    ],
    guards: ['일정 목록이나 검색을 두지 않는다. 저장된 개인 자료가 없기 때문이다.'],
    exits: ['없음'],
    adminControl: '이 화면에는 관리자가 바꿀 수 있는 값이 없다.',
  },
  {
    app: 'mobile',
    id: 'itinerary',
    name: '여행일정 열람',
    area: '모바일',
    code: 'MOBILE-002',
    route: '/t/[token]',
    readiness: 'working',
    basis: '제안서 6.6',
    purpose: '키오스크에서 만든 일정을 관람객의 휴대폰에서 그대로 본다.',
    requirement:
      '키오스크에서 만든 일정을 관람객의 휴대폰에서 그대로 본다. 일정 내용이 주소에 담겨 있어 데이터베이스 조회가 없으며, 그 대가로 잘리거나 손상된 주소를 만날 수 있으므로 복호화 실패를 오류가 아닌 정상 경로로 처리한다.',
    entry: ['키오스크 QR 코드 촬영'],
    areas: [
      { name: '일정 제목·조건 요약', content: '어떤 조건으로 만든 일정인지.', source: '주소에 담긴 값' },
      {
        name: '일자별 일정',
        content: '시각·관광지·머무는 시간·이동시간.',
        source: '주소에 담긴 관광지 식별자로 다시 조회',
      },
      {
        name: '공식 출처',
        content: '관광지별 근거 문서와 갱신일.',
        source: 'packages/core/src/data/officialDocuments.json',
      },
    ],
    features: [
      {
        id: 'MOB-ITI-01',
        action: '이용자가 QR 로 열린 주소에 들어온다.',
        process: '주소의 토큰을 풀어 관광지 식별자와 여행조건을 되살리고, 내장 자료에서 관광지 정보를 다시 찾는다.',
        result: '일자별 일정과 공식 출처가 표시된다.',
      },
    ],
    guards: ['QR 이 일부만 인식되어 토큰을 풀 수 없으면 오류 화면 대신 「다시 촬영해 주세요」 안내를 표시한다.'],
    exits: ['안내 화면'],
    adminControl: '관광지 정보와 출처 문서는 「관광지 › 등록」·「문서 › 관리」의 자료를 따른다. 화면 구성은 바꿀 수 없다.',
  },
];

/* ────────────────────────────────────────────────────────────────
   어드민 — 운영·연구 관리 (포트 3002)
   ──────────────────────────────────────────────────────────────── */

const ADMIN_SCREENS: readonly DocScreen[] = [
  {
    app: 'admin',
    id: 'dashboard',
    name: '대시보드',
    area: '대시보드',
    code: 'DASHBOARD-001',
    route: '/dashboard',
    readiness: 'working',
    purpose: '오늘의 운영 상태와 검수 기준 충족 여부를 한 화면에서 본다.',
    requirement:
      '운영 상태와 검수 기준 충족 여부를 한 화면에서 확인한다. 이 화면의 값은 출처가 둘이므로 — 그 자리에서 재는 검수 지표와 현장에서 모아야 하는 이용 지표 — 두 종류를 구분해 배치하고, 자료가 없는 값에 0을 적지 않는다.',
    entry: ['어드민 첫 화면', '좌측 메뉴 「대시보드」'],
    areas: [
      {
        name: '검수 지표',
        content: '출처 제시율·답변 근거 일치율·응답시간 중앙값을 목표치와 나란히 놓는다.',
        source: '기준 평가질문을 실제로 검색해 그 자리에서 잰 값',
      },
      { name: '현장 지표', content: '세션 수·QR 전환·이용시간.', source: '가져온 키오스크 세션 로그' },
      {
        name: '자료 현황',
        content: '등록된 관광지 수와 공식문서 수.',
        source: 'attractions.json · officialDocuments.json',
      },
    ],
    features: [
      {
        id: 'ADM-DSH-01',
        action: '관리자가 대시보드를 연다.',
        process: '기준 평가질문 전체를 검색기에 돌려 출처 제시율과 근거 일치율을 계산한다.',
        result: '측정값이 목표치와 함께 표시된다.',
      },
      {
        id: 'ADM-DSH-02',
        action: '관리자가 현장 지표 구역을 본다.',
        process: '저장된 세션 로그 건수를 확인한다.',
        result: '로그가 없으면 숫자 대신 「자료 없음」과 무엇을 해야 채워지는지가 표시된다.',
      },
    ],
    guards: [
      '세션 로그가 없으면 현장 지표에 0을 적지 않는다. 0으로 적으면 «측정했는데 0이었다»로 읽히기 때문이다.',
    ],
    exits: ['각 상세 화면'],
    adminControl: '표시 항목과 목표치는 코드 상수이며 이 화면에서 바꿀 수 없다.',
  },
  {
    app: 'admin',
    id: 'poi-manage',
    name: '관광지 › 등록',
    area: '관광지',
    code: 'POI-001',
    route: '/poi-manage · /poi-manage?id={관광지}',
    readiness: 'working',
    purpose: '관광지 하나를 골라 그 값을 고친다.',
    requirement:
      '추천의 대상이 되는 관광지 자료를 조회하고 수정한다. 관광지 하나가 가진 값이 스무 개를 넘으므로 목록과 상세를 나누어, 목록에서는 무엇을 고를지만 보고 상세에서는 그 값을 어떻게 할지만 보게 한다.',
    entry: ['좌측 메뉴 「관광지 › 등록」'],
    areas: [
      {
        name: '목록',
        content: '이름·지역·유형으로 훑고 검색·정렬·쪽 넘김을 한다.',
        source: 'attractions.json 및 브라우저 저장분',
      },
      {
        name: '상세',
        content:
          '이름·주소·좌표·유형·머무는 시간·보행부담·가족/어르신 적합도·우천 적합도·대중교통 접근성·비용수준·인접 관광지 등.',
        source: '선택한 관광지',
      },
    ],
    features: [
      {
        id: 'ADM-POI-01',
        action: '관리자가 목록에서 관광지를 선택한다.',
        process: '주소에 그 관광지 식별자를 적고 상세 자료를 읽는다.',
        result: '상세 화면이 열리고 새로고침해도 같은 관광지가 열린다.',
      },
      {
        id: 'ADM-POI-02',
        action: '관리자가 값을 고치고 저장한다.',
        process: '바뀐 값을 브라우저 저장소에 반영한다.',
        result: '목록과 「관광지 › 관리」의 검증 결과가 함께 바뀐다.',
      },
    ],
    guards: ['목록에 자료가 없으면 표 머리는 그대로 두고 「등록된 내역이 없습니다.」를 표시한다.'],
    exits: ['목록', '관광지 › 관리'],
    adminControl: '이 화면이 관광지 값의 편집 지점이다.',
    backendNeed: '지금은 브라우저 저장소에 남는다. 여러 대에서 같은 자료를 보려면 저장·조회 API 가 필요하다.',
  },
  {
    app: 'admin',
    id: 'poi-meta',
    name: '관광지 › 관리',
    area: '관광지',
    code: 'POI-002',
    route: '/poi-meta',
    readiness: 'working',
    purpose: '등록된 관광지 전체가 쓸 만한 상태인지 보고, 자료를 파일로 꺼낸다.',
    requirement:
      '등록된 관광지 전체가 쓸 만한 상태인지 확인한다. 값이 빠졌는지를 검증으로, 자원이 한쪽에 쏠렸는지를 분포로 보이고, 고친 자료를 파일로 꺼내는 경로를 제공한다.',
    entry: ['좌측 메뉴 「관광지 › 관리」'],
    areas: [
      {
        name: '검증 결과',
        content: '값이 빠졌거나 범위를 벗어난 항목.',
        source: '「등록」에서 고친 자료를 그대로 본다',
      },
      { name: '분포', content: '지역별·유형별로 자원이 쏠렸는지.', source: '같은 자료의 집계' },
      { name: '내보내기', content: '전체 자료를 파일로 저장.', source: '같은 자료' },
    ],
    features: [
      {
        id: 'ADM-POM-01',
        action: '관리자가 검증 구역을 본다.',
        process: '필수 항목 누락과 범위를 벗어난 값을 찾는다.',
        result: '문제가 있는 관광지와 그 항목이 표시된다.',
      },
      {
        id: 'ADM-POM-02',
        action: '관리자가 내보내기를 선택한다.',
        process: '현재 자료를 표 형식으로 바꾼다.',
        result: '파일이 내려받아진다.',
      },
    ],
    guards: ['검증에서 걸리는 항목이 없으면 이상 없음을 표시한다.'],
    exits: ['관광지 › 등록'],
    adminControl: '이 화면은 보기와 내보내기만 한다. 값은 「등록」에서 고친다.',
  },
  {
    app: 'admin',
    id: 'doc-manage',
    name: '문서 › 관리',
    area: '문서',
    code: 'DOC-001',
    route: '/doc-manage · /doc-manage?id={문서}',
    readiness: 'working',
    purpose: '추천의 근거가 되는 공식문서가 어떤 기관 것이고 언제 갱신됐는지 본다.',
    requirement:
      '추천의 근거가 되는 공식문서를 조회한다. 검색기가 이 문서에서 근거를 찾으므로 어떤 기관의 자료가 몇 건이고 언제 갱신됐는지가 곧 추천의 신뢰도가 되며, 화면도 그 기준으로 구성한다.',
    entry: ['좌측 메뉴 「문서 › 관리」'],
    areas: [
      {
        name: '목록',
        content: '제목·발행기관·기관유형·갱신일·다루는 관광지 수.',
        source: 'officialDocuments.json',
      },
      { name: '상세', content: '원문 발췌·주소·키워드·다루는 정보 항목.', source: '선택한 문서' },
    ],
    features: [
      {
        id: 'ADM-DOC-01',
        action: '관리자가 문서를 선택한다.',
        process: '주소에 문서 식별자를 적고 상세를 읽는다.',
        result: '문서 상세가 열린다.',
      },
      {
        id: 'ADM-DOC-02',
        action: '관리자가 갱신일 순으로 정렬한다.',
        process: '갱신일 기준으로 목록을 다시 세운다.',
        result: '오래된 자료가 먼저 보인다.',
      },
    ],
    guards: ['갱신일이 오래된 문서는 신뢰도 계산에서 감점되며, 그 사실을 목록에 표시한다.'],
    exits: ['문서 › 검색 설정'],
    adminControl: '문서 본문은 저장소 자료다. 이 화면에서 새 문서를 올릴 수 없다.',
    backendNeed: '문서 등록·갱신을 화면에서 하려면 문서 저장 API 와 파일 보관소가 필요하다.',
  },
  {
    app: 'admin',
    id: 'doc-config',
    name: '문서 › 검색 설정',
    area: '문서',
    code: 'DOC-002',
    route: '/doc-config',
    readiness: 'working',
    purpose: '검색이 어떤 방식으로 도는지 정하고, 색인에 무엇이 들어 있는지 확인한다.',
    requirement:
      '검색이 어떤 방식으로 도는지 정하고 색인에 무엇이 들어 있는지 확인한다. 지금 검색기는 임베딩 벡터가 아니라 낱말 겹침으로 점수를 매기므로, 없는 벡터를 관리하는 화면을 두는 대신 실제로 쓰는 방식과 그 점수 분포를 표시한다.',
    entry: ['좌측 메뉴 「문서 › 검색 설정」'],
    areas: [
      {
        name: '검색 방식 탭',
        content: '지금 쓰는 판정 방식과 기준 평가질문을 돌렸을 때의 점수 분포.',
        source: '기준 평가질문을 실제로 검색한 결과',
      },
      {
        name: '키워드 분석 탭',
        content: '문서별 키워드 수와 키워드가 적어 검색에 안 걸리는 문서.',
        source: 'officialDocuments.json',
      },
      {
        name: '판정 기준',
        content: '몇 건까지 회수할지, 어느 점수 아래를 버릴지.',
        source: 'apps/admin/src/config/resourceSchemas.ts',
      },
    ],
    features: [
      {
        id: 'ADM-DCF-01',
        action: '관리자가 검색 방식 탭을 연다.',
        process: '기준 평가질문 전체를 검색해 점수를 모은다.',
        result: '점수 분포와 회수 결과가 표시된다.',
      },
      {
        id: 'ADM-DCF-02',
        action: '관리자가 판정 기준 값을 바꾸고 저장한다.',
        process: '바뀐 기준을 브라우저 저장소에 반영한다.',
        result: '저장 완료 안내가 표시된다.',
      },
    ],
    guards: ['지금 검색기는 임베딩 벡터가 아니라 낱말 겹침으로 점수를 매긴다. 화면도 그 사실을 그대로 적는다.'],
    exits: ['문서 › 관리'],
    adminControl: '회수 건수와 점수 하한을 이 화면에서 바꾼다. 점수 계산식 자체는 바꿀 수 없다.',
  },
  {
    app: 'admin',
    id: 'rec-model',
    name: '추천 엔진 › 설정',
    area: '추천 엔진',
    code: 'REC-001',
    route: '/rec-model',
    readiness: 'working',
    purpose: '후보를 어디까지 볼지, 무엇을 함께 내보낼지 정한다.',
    requirement:
      '추천이 만들어질 때 후보를 어디까지 볼지, 무엇을 함께 내보낼지 정한다. 값들을 추천 엔진이 실제로 도는 순서 — 후보 추리기 · 골라 담기 · 근거 붙이기 — 로 나누어 배치하여, 화면을 따라 내려가는 것이 곧 추천 과정을 따라가는 일이 되게 한다.',
    entry: ['좌측 메뉴 「추천 엔진 › 설정」'],
    areas: [
      {
        name: '후보 추리기',
        content: '몇 곳을 후보로 볼지, 어느 점수에서 자를지.',
        source: 'apps/admin/src/config/resourceSchemas.ts',
      },
      { name: '골라 담기', content: '고르는 방식과 같은 유형 반복 허용 범위.', source: '같은 파일' },
      { name: '근거 붙이기', content: '결과에 함께 내보낼 근거 항목.', source: '같은 파일' },
    ],
    features: [
      {
        id: 'ADM-REC-01',
        action: '관리자가 후보 수·하한 점수를 고치고 저장한다.',
        process: '바뀐 값을 브라우저 저장소에 반영한다.',
        result: '저장 완료 안내가 표시된다.',
      },
    ],
    guards: ['화면 구역 순서는 추천 엔진이 실제로 도는 순서와 같게 둔다.'],
    exits: ['추천 엔진 › 관리'],
    adminControl: '이 화면의 값은 실험 설정이다. 키오스크 운영값은 코드 상수를 따른다.',
    backendNeed: '설정을 키오스크에 실제로 반영하려면 설정 조회 API 가 필요하다.',
  },
  {
    app: 'admin',
    id: 'rec-weight',
    name: '추천 엔진 › 관리',
    area: '추천 엔진',
    code: 'REC-002',
    route: '/rec-weight',
    readiness: 'working',
    basis: '제안서 8.4 · 8.5',
    purpose: '무엇을 얼마나 볼지 정하는 배점표를 바꿔 보며 결과가 어떻게 달라지는지 본다.',
    requirement:
      '추천 점수·정보 신뢰도·초광역 연계지수 세 배점표를 한 화면에서 다룬다. 여기서 바꾼 값은 실험값이며 키오스크 운영값과 섞이지 않는데, 섞이면 어떤 배점으로 나온 결과인지 나중에 알 수 없기 때문이다.',
    entry: ['좌측 메뉴 「추천 엔진 › 관리」'],
    areas: [
      {
        name: '추천 점수 배점',
        content: '취향 적합·이동 실현성·지역 연계·자원 다양성·접근성·정보 신뢰도·지역 분산. 합계 100.',
        source: 'packages/core/src/config/scoring.ts',
      },
      {
        name: '신뢰도 배점',
        content: '공식 발행처·최근 갱신·복수 출처 일치·정보 항목 충족. 합계 100.',
        source: '같은 파일',
      },
      {
        name: '연계지수 배점',
        content: '지역 균형·자원 보완성·동선 효율·이야기 연속성. 합계 100.',
        source: '같은 파일',
      },
    ],
    features: [
      {
        id: 'ADM-WGT-01',
        action: '관리자가 배점을 바꾼다.',
        process: '바뀐 배점으로 같은 조건의 추천을 다시 계산한다.',
        result: '바뀐 배점에서의 결과가 표시된다.',
      },
      {
        id: 'ADM-WGT-02',
        action: '관리자가 배점을 되돌린다.',
        process: '코드에 있는 운영값을 다시 읽는다.',
        result: '운영 배점으로 돌아간다.',
      },
    ],
    guards: ['여기서 바꾼 값은 실험값이며 키오스크 운영값과 섞이지 않는다.'],
    exits: ['추천 엔진 › 설정'],
    adminControl: '세 배점표를 모두 이 화면에서 다룬다. 같은 값을 다른 화면에 두지 않는다.',
  },
  {
    app: 'admin',
    id: 'poi-region',
    name: '초광역 연계지수 › 권역',
    area: '초광역 연계지수',
    code: 'ZONE-001',
    route: '/poi-region · /poi-region?id={권역}',
    readiness: 'working',
    purpose: '어느 시군구를 한 덩어리로 볼 것인지 정하고, 그 묶음의 연계지수를 함께 본다.',
    requirement:
      '어느 시군구를 한 덩어리로 볼 것인지 정한다. 묶음이 잘 잡혔는지는 그 권역을 지나는 일정의 연계지수로 드러나므로, 정하는 자리와 결과를 갈라 두지 않고 같은 화면의 탭으로 붙인다.',
    entry: ['좌측 메뉴 「초광역 연계지수 › 권역」'],
    areas: [
      {
        name: '목록',
        content: '권역 이름과 묶인 시군구.',
        source: 'apps/admin/src/config/resourceSchemas.ts',
      },
      { name: '상세 – 구성', content: '권역 이름·설명·포함 시군구 편집.', source: '선택한 권역' },
      { name: '상세 – 지수', content: '이 권역을 지나는 일정의 연계지수 구성요소별 값.', source: '추천 엔진 계산' },
    ],
    features: [
      {
        id: 'ADM-ZON-01',
        action: '관리자가 권역을 등록한다.',
        process: '입력한 이름과 시군구 묶음을 저장한다.',
        result: '목록에 새 권역이 추가된다.',
      },
      {
        id: 'ADM-ZON-02',
        action: '관리자가 권역 상세에서 「지수」 탭을 연다.',
        process: '그 권역을 지나는 일정의 연계지수를 구성요소별로 계산한다.',
        result: '묶음을 바꿨을 때의 효과가 같은 화면에서 표시된다.',
      },
      {
        id: 'ADM-ZON-03',
        action: '관리자가 권역을 삭제한다.',
        process: '삭제 대상 이름을 확인 문구에 넣어 되묻는다.',
        result: '확인하면 목록에서 사라진다.',
      },
    ],
    guards: ['등록된 권역이 없으면 「등록된 내역이 없습니다.」를 표시한다.'],
    exits: ['초광역 연계지수 › 통계'],
    adminControl: '권역 묶음이 이 화면에서 정해진다.',
  },
  {
    app: 'admin',
    id: 'link-stats',
    name: '초광역 연계지수 › 통계',
    area: '초광역 연계지수',
    code: 'LINK-001',
    route: '/link-stats',
    readiness: 'working',
    purpose: '지역을 고르게 다녔는지, 어떤 자원끼리 이어졌는지 결과를 놓고 본다.',
    requirement:
      '이미 나온 추천 결과를 놓고 지역 분포와 자원 연결을 확인한다. 두 탭이 같은 계산을 각자의 각도로 보므로 조회 조건은 위에 한 벌만 두는데, 탭마다 조건을 따로 두면 서로 다른 기준의 결과를 견주게 되기 때문이다.',
    entry: ['좌측 메뉴 「초광역 연계지수 › 통계」'],
    areas: [
      { name: '조회 조건', content: '기준일과 조건. 두 탭이 같은 조건을 함께 쓴다.', source: '관리자 입력' },
      { name: '지역별 탭', content: '지역별 방문 분포.', source: '추천 엔진 계산' },
      { name: '관계 탭', content: '어떤 관광지끼리 같은 일정에 함께 들어갔는지.', source: '추천 엔진 계산' },
    ],
    features: [
      {
        id: 'ADM-LNK-01',
        action: '관리자가 기준일을 바꾼다.',
        process: '그 날짜로 휴무일·운영시간을 판정해 일정을 다시 만든다.',
        result: '문 닫은 곳이 빠지고 분포가 실제로 달라진다.',
      },
      {
        id: 'ADM-LNK-02',
        action: '관리자가 탭을 바꾼다.',
        process: '같은 계산 결과를 다른 각도로 정리한다.',
        result: '조회 조건은 그대로 둔 채 표시만 바뀐다.',
      },
    ],
    guards: ['조회 조건은 위에 한 벌만 둔다. 탭마다 따로 두면 두 탭을 견줄 수 없다.'],
    exits: ['초광역 연계지수 › 권역'],
    adminControl: '조회 조건만 바꾼다. 연계지수 배점은 「추천 엔진 › 관리」에서 다룬다.',
  },
  {
    app: 'admin',
    id: 'log-session',
    name: '로그 › 세션 로그',
    area: '로그',
    code: 'LOG-001',
    route: '/log-session · /log-session?id={세션}',
    readiness: 'pending',
    basis: '제안서 10.4',
    purpose: '키오스크 한 번의 이용을 처음부터 끝까지 되짚는다.',
    requirement:
      '키오스크 한 번의 이용을 처음부터 끝까지 되짚는다. 한 세션에 여행조건·회수 문서·후보 점수·재구성 이력이 모두 들어 있어 표 한 줄에 담을 수 없으므로, 목록에는 훑어보는 값만 두고 줄을 누르면 그 세션의 전모를 보는 상세로 들어간다.',
    entry: ['좌측 메뉴 「로그 › 세션 로그」'],
    areas: [
      {
        name: '목록',
        content: '세션 식별자·시각·설치 위치·화면 모드·재구성 횟수.',
        source: '가져온 세션 로그',
      },
      {
        name: '상세',
        content: '고른 여행조건·회수 문서·후보 점수·제외 사유·재구성 이력·최종 일정.',
        source: '선택한 세션',
      },
    ],
    features: [
      {
        id: 'ADM-LOG-01',
        action: '관리자가 세션 줄을 선택한다.',
        process: '주소에 세션 식별자를 적고 그 세션의 전 과정을 읽는다.',
        result: '세션 상세가 열린다.',
      },
      {
        id: 'ADM-LOG-02',
        action: '관리자가 세션을 검색한다.',
        process: '식별자·일정명으로 목록을 걸러 낸다.',
        result: '해당하는 세션만 표시된다.',
      },
    ],
    guards: ['가져온 로그가 없으면 표 머리는 그대로 두고 「등록된 내역이 없습니다.」를 표시한다.'],
    exits: ['로그 › 검색 로그', '로그 › 추천 로그'],
    adminControl: '로그는 읽기 전용이다. 이 화면에서 고칠 수 없다.',
    backendNeed:
      '키오스크와 어드민은 다른 주소에 배포되어 브라우저 저장소를 공유하지 못한다. 세션을 내려주는 API 가 있어야 이 표가 채워진다.',
  },
  {
    app: 'admin',
    id: 'log-rag',
    name: '로그 › 검색 로그',
    area: '로그',
    code: 'LOG-002',
    route: '/log-rag · /log-rag?id={세션}',
    readiness: 'pending',
    purpose: '어떤 낱말로 무엇을 찾았고 얼마나 비슷했는지 본다.',
    requirement:
      '검색이 어떤 낱말로 무엇을 찾았고 그 점수가 얼마였는지 본다. 출처 제시율이 떨어질 때 원인이 문서에 있는지 질의에 있는지를 가르는 자리다.',
    entry: ['좌측 메뉴 「로그 › 검색 로그」'],
    areas: [
      { name: '목록', content: '세션·질의·걸린 낱말·유사도·회수 문서 수.', source: '세션 로그의 검색 기록' },
      { name: '상세', content: '그 세션이 회수한 문서 전체와 각 문서의 점수.', source: '선택한 세션' },
    ],
    features: [
      {
        id: 'ADM-RAG-01',
        action: '관리자가 검색 줄을 선택한다.',
        process: '그 세션의 회수 문서 목록을 읽는다.',
        result: '문서별 점수와 걸린 낱말이 표시된다.',
      },
    ],
    guards: ['가져온 로그가 없으면 「등록된 내역이 없습니다.」를 표시한다.'],
    exits: ['로그 › 세션 로그'],
    adminControl: '읽기 전용이다.',
    backendNeed: '세션 로그와 같은 API 를 쓴다.',
  },
  {
    app: 'admin',
    id: 'log-rec',
    name: '로그 › 추천 로그',
    area: '로그',
    code: 'LOG-003',
    route: '/log-rec · /log-rec?id={세션}',
    readiness: 'pending',
    purpose: '무엇이 뽑히고 무엇이 밀렸는지, 그 점수 구성이 어땠는지 본다.',
    requirement:
      '무엇이 뽑히고 무엇이 밀렸는지를 점수 구성과 함께 본다. 세션마다 후보가 수십 곳이므로 목록에는 상위 후보만 올리고 나머지는 상세에서 펼친다.',
    entry: ['좌측 메뉴 「로그 › 추천 로그」'],
    areas: [
      { name: '목록', content: '세션별 상위 후보 다섯 곳과 총점·선정 여부.', source: '세션 로그의 후보 점수' },
      { name: '상세', content: '후보별 항목 점수와 제외 사유.', source: '선택한 세션' },
    ],
    features: [
      {
        id: 'ADM-RCL-01',
        action: '관리자가 후보 줄을 선택한다.',
        process: '그 세션의 후보 전체를 점수 높은 순으로 정리한다.',
        result: '항목별 점수와 제외 사유가 표시된다.',
      },
    ],
    guards: ['세션마다 후보가 수십 곳이므로 목록에는 상위 다섯 곳만 올린다.'],
    exits: ['로그 › 세션 로그'],
    adminControl: '읽기 전용이다.',
    backendNeed: '세션 로그와 같은 API 를 쓴다.',
  },
  {
    app: 'admin',
    id: 'log-error',
    name: '로그 › 에러 로그',
    area: '로그',
    code: 'LOG-004',
    route: '/log-error',
    readiness: 'pending',
    purpose: '결과가 기준을 지키지 못한 순간을 모아 본다.',
    requirement:
      '결과가 기준을 지키지 못한 순간을 모은다. 이 시스템은 예외를 던지고 멈추는 대신 조용히 나쁜 결과를 내므로, 예외 스택이 아니라 아무것도 못 찾은 검색·요청을 이루지 못한 재구성·목표를 넘긴 응답시간을 모아 본다.',
    entry: ['좌측 메뉴 「로그 › 에러 로그」'],
    areas: [
      {
        name: '목록',
        content: '아무것도 못 찾은 검색, 요청을 이루지 못한 재구성, 목표를 넘긴 응답시간.',
        source: '세션 로그에서 판정해 뽑아낸다',
      },
    ],
    features: [
      {
        id: 'ADM-ERR-01',
        action: '관리자가 에러 로그를 연다.',
        process: '세션 로그를 훑어 기준을 못 지킨 건을 골라낸다.',
        result: '해당하는 건만 사유와 함께 표시된다.',
      },
    ],
    guards: [
      '예외 스택을 모으지 않는다. 이 시스템은 멈추는 대신 조용히 나쁜 결과를 내므로 그것을 본다.',
      '세션 로그가 없으면 이 표도 비어 있다. 없는 오류를 지어내지 않는다.',
    ],
    exits: ['로그 › 세션 로그'],
    adminControl: '판정 기준은 코드 상수이며 이 화면에서 바꿀 수 없다.',
    backendNeed: '세션 로그와 같은 API 를 쓴다.',
  },
  {
    app: 'admin',
    id: 'field-pattern',
    name: '사용자 › 이용 패턴',
    area: '사용자',
    code: 'FIELD-001',
    route: '/field-pattern · /field-pattern?id={세션}',
    readiness: 'pending',
    purpose: '관람객이 실제로 무엇을 골랐는지 본다.',
    requirement:
      '관람객이 실제로 무엇을 골랐는지 본다. 어떤 동행·관심사 조합이 많았는지가 다음 배치와 자료 보강의 근거가 되므로, 조건 항목을 검색 축으로 세운다.',
    entry: ['좌측 메뉴 「사용자 › 이용 패턴」'],
    areas: [
      { name: '목록', content: '세션·동행·관심사·화면 모드·재구성 횟수.', source: '가져온 세션 로그' },
      { name: '상세', content: '그 세션이 고른 조건 전부.', source: '선택한 세션' },
    ],
    features: [
      {
        id: 'ADM-FPT-01',
        action: '관리자가 동행·관심사로 검색한다.',
        process: '조건에 맞는 세션만 걸러 낸다.',
        result: '해당 세션만 표시된다.',
      },
    ],
    guards: ['가져온 로그가 없으면 「등록된 내역이 없습니다.」를 표시한다.'],
    exits: ['사용자 › QR 전환률'],
    adminControl: '읽기 전용이다.',
    backendNeed: '세션 로그와 같은 API 를 쓴다.',
  },
  {
    app: 'admin',
    id: 'field-qr',
    name: '사용자 › QR 전환률',
    area: '사용자',
    code: 'FIELD-002',
    route: '/field-qr · /field-qr?id={세션}',
    readiness: 'pending',
    purpose: '만든 일정을 관람객이 실제로 가져갔는지 본다.',
    requirement:
      '만든 일정을 관람객이 실제로 가져갔는지 세션마다 한 줄로 쌓는다. QR 을 만들었는지와 휴대폰에서 열었는지를 나누어 적어, 만들지 않은 세션이 열지 않은 세션으로 집계되지 않게 한다.',
    entry: ['좌측 메뉴 「사용자 › QR 전환률」'],
    areas: [
      {
        name: '목록',
        content: '세션·일정명·QR 생성 여부·휴대폰에서 열림 여부.',
        source: '가져온 세션 로그',
      },
    ],
    features: [
      {
        id: 'ADM-FQR-01',
        action: '관리자가 QR 전환 목록을 본다.',
        process: 'QR 을 만든 세션과 그중 휴대폰에서 열린 세션을 가른다.',
        result: '세션마다 생성·열림이 한 줄씩 표시된다.',
      },
    ],
    guards: ['QR 을 만들지 않은 세션에는 「안 열림」을 적지 않는다. 열어 볼 기회가 있었던 것처럼 읽히기 때문이다.'],
    exits: ['사용자 › 이용 패턴'],
    adminControl: '읽기 전용이다.',
    backendNeed: 'QR 열람 여부는 모바일 쪽에서 알려 줘야 채워진다.',
  },
  {
    app: 'admin',
    id: 'field-survey',
    name: '사용자 › 만족도 조사',
    area: '사용자',
    code: 'FIELD-003',
    route: '/field-survey · /field-survey?id={응답}',
    readiness: 'working',
    basis: '제안서 10.5',
    purpose: '현장에서 받은 설문 응답을 옮겨 적는다.',
    requirement:
      '현장에서 받은 설문 응답을 옮겨 적는다. 인지된 적합성·신뢰도·설명 이해도·만족도·방문의도는 설문으로만 얻을 수 있는 값이므로 시스템이 만들어 내지 않으며, 입력 전에는 목록이 비어 있다.',
    entry: ['좌측 메뉴 「사용자 › 만족도 조사」'],
    areas: [
      { name: '목록', content: '응답 식별자와 항목별 점수.', source: '관리자 입력' },
      {
        name: '등록·수정 창',
        content: '인지된 적합성·인지된 신뢰도·설명 이해도·추천 만족도·방문의도(각 1–5)와 자유 응답.',
        source: 'apps/admin/src/config/resourceSchemas.ts',
      },
    ],
    features: [
      {
        id: 'ADM-SRV-01',
        action: '관리자가 응답을 등록한다.',
        process: '입력한 점수와 자유 응답을 저장한다.',
        result: '목록에 새 응답이 추가된다.',
      },
      {
        id: 'ADM-SRV-02',
        action: '관리자가 응답을 삭제한다.',
        process: '대상 응답을 확인 문구에 넣어 되묻는다.',
        result: '확인하면 목록에서 사라진다.',
      },
    ],
    guards: ['설문으로만 얻을 수 있는 값이므로 시스템이 만들어 내지 않는다. 입력 전에는 목록이 비어 있다.'],
    exits: ['대시보드'],
    adminControl: '이 화면이 만족도 값의 유일한 입력 지점이다.',
  },
  {
    app: 'admin',
    id: 'sys-model',
    name: '시스템 설정 › AI 모델',
    area: '시스템 설정',
    code: 'SYSTEM-001',
    route: '/sys-model',
    readiness: 'pending',
    purpose: '답을 만들 때 쓸 모델과 호출 방식을 정한다.',
    requirement:
      '답을 만들 때 쓸 모델과 호출 방식을 정한다. 값의 종류가 서로 달라 한 덩어리로 두면 구분되지 않으므로 모델·응답 변동성·토큰·응답 시간 네 구역으로 나누고, 각 구역의 값은 창에서 받는다.',
    entry: ['좌측 메뉴 「시스템 설정 › AI 모델」'],
    areas: [
      {
        name: '모델 설정',
        content: '부를 모델을 목록에서 고른다.',
        source: 'apps/admin/src/config/resourceSchemas.ts',
      },
      { name: '응답 변동성', content: '같은 질문에 답이 매번 얼마나 달라질지.', source: '같은 파일' },
      { name: '토큰 설정', content: '답을 얼마나 길게 받을지.', source: '같은 파일' },
      { name: '응답 시간', content: '얼마나 기다릴지와 넘겼을 때 몇 번 다시 부를지.', source: '같은 파일' },
    ],
    features: [
      {
        id: 'ADM-MDL-01',
        action: '관리자가 구역의 「설정」을 선택한다.',
        process: '그 구역의 값만 담은 창을 연다.',
        result: '해당 값만 고칠 수 있는 창이 표시된다.',
      },
      {
        id: 'ADM-MDL-02',
        action: '관리자가 값을 고치고 저장한다.',
        process: '바뀐 값을 브라우저 저장소에 반영한다.',
        result: '저장 완료 안내가 표시되고 구역 요약이 바뀐다.',
      },
    ],
    guards: [
      '지금 추천 이유는 생성모델이 아니라 점수 계산에서 나온다. 모델 호출 자체가 없으므로 이 화면은 저장까지만 한다.',
      '응답 시간과 재시도는 한 창에서 함께 다룬다. 따로 두면 한쪽만 고치게 된다.',
    ],
    exits: ['시스템 설정 › 프롬프트'],
    adminControl: '값은 저장되지만 지금은 어떤 화면의 결과도 바꾸지 않는다.',
    backendNeed: '생성모델 호출부가 붙어야 이 값이 실제로 쓰인다.',
  },
  {
    app: 'admin',
    id: 'sys-prompt',
    name: '시스템 설정 › 프롬프트',
    area: '시스템 설정',
    code: 'SYSTEM-002',
    route: '/sys-prompt · /sys-prompt?id={템플릿}',
    readiness: 'pending',
    purpose: '답변 형식을 정하는 문구를 만들고 관리한다.',
    requirement:
      '답변 형식을 정하는 문구를 만들고 관리한다. 본문에 끼워 넣는 변수는 손으로 적다 한 글자 틀리면 실행 시점에 조용히 비므로, 정해진 목록에서 눌러 넣게 하고 목록에 없는 이름은 그 자리에서 알린다.',
    entry: ['좌측 메뉴 「시스템 설정 › 프롬프트」'],
    areas: [
      {
        name: '목록',
        content: '템플릿 이름·용도·사용 여부.',
        source: 'apps/admin/src/config/resourceSchemas.ts',
      },
      { name: '등록 창', content: '템플릿 이름과 용도를 받는 창.', source: '관리자 입력' },
      {
        name: '본문 편집칸',
        content: '여러 줄 입력칸과 그 위의 «변수 넣기» 줄. 변수를 누르면 커서 자리에 넣는다.',
        source: '같은 파일의 변수 목록',
      },
    ],
    features: [
      {
        id: 'ADM-PRM-01',
        action: '관리자가 「템플릿 등록」을 선택한다.',
        process: '이름과 용도를 받는 창을 연다.',
        result: '목록을 그대로 둔 채 등록 창이 표시된다.',
      },
      {
        id: 'ADM-PRM-02',
        action: '관리자가 본문에서 변수를 선택한다.',
        process: '커서 위치에 그 변수 이름을 끼워 넣는다.',
        result: '본문에 변수가 들어가고 커서가 그 뒤에 놓인다.',
      },
      {
        id: 'ADM-PRM-03',
        action: '관리자가 목록에 없는 변수 이름을 직접 적는다.',
        process: '본문의 변수 이름을 정해진 목록과 대조한다.',
        result: '채울 값이 없다는 안내가 편집칸 아래에 표시된다.',
      },
    ],
    guards: [
      '지금은 생성모델을 쓰지 않으므로 저장한 프롬프트가 실행되지 않는다.',
      '변수 이름을 손으로 적다 틀리면 실행 시점에 조용히 비므로 그 자리에서 알린다.',
    ],
    exits: ['시스템 설정 › AI 모델'],
    adminControl: '템플릿 등록·수정·삭제를 이 화면에서 한다.',
    backendNeed: '생성모델 호출부가 붙어야 저장한 프롬프트가 실제로 쓰인다.',
  },
];

/** 문서 전체가 읽는 화면 목록. 앱 순서(키오스크 → 모바일 → 어드민)로 둔다. */
export const DOC_SCREENS: readonly DocScreen[] = [...KIOSK_SCREENS, ...MOBILE_SCREENS, ...ADMIN_SCREENS];

/** 앱 이름. 문서 머리말과 목차에 쓴다. */
export const DOC_APP_LABELS: Record<DocScreen['app'], string> = {
  kiosk: '키오스크 (관람객용)',
  mobile: '모바일 (QR 열람)',
  admin: '어드민 (운영·연구)',
};

/**
 * 요구 ID 표 — `app/id` → `REQ-C-01` 형식.
 *
 * 번호는 화면 목록의 순서를 따른다. 문서 생성기와 캡처 묶음이 같은 번호를 써야
 * 「REQ-C-04 화면 캡처」를 서로 다른 화면으로 가리키는 일이 생기지 않으므로,
 * 매기는 규칙을 여기 한 곳에 둔다.
 */
export const DOC_REQUIREMENT_IDS: Readonly<Record<string, string>> = Object.fromEntries(
  DOC_SCREENS.map((screen) => {
    const isAdmin = screen.app === 'admin';
    const siblings = DOC_SCREENS.filter((entry) => (entry.app === 'admin') === isAdmin);
    const number = String(siblings.indexOf(screen) + 1).padStart(2, '0');
    return [`${screen.app}/${screen.id}`, `${isAdmin ? 'REQ-A' : 'REQ-C'}-${number}`];
  }),
);

/** `app/id` 로 화면을 찾는다. 요구사항·시나리오의 참조를 확인할 때 쓴다. */
export function findDocScreen(key: string): DocScreen | undefined {
  return DOC_SCREENS.find((screen) => `${screen.app}/${screen.id}` === key);
}
