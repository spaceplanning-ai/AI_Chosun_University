/**
 * 요구사항 정의서 5장(운영 요구사항) 의 원본.
 *
 * 화면 하나에 매이지 않고 서비스 전반에 걸리는 규칙만 모은다.
 * 화면 안에서만 통하는 규칙은 `screens.ts` 의 guards 에 두어야 이 표가 짧게 유지된다.
 */

/** 5장 표 한 줄. `related` 는 `screens.ts` 의 기능 코드다. */
export interface DocOperationRule {
  id: string;
  topic: string;
  target: string;
  requirement: string;
  related: readonly string[];
}

export const DOC_OPERATION_RULES: readonly DocOperationRule[] = [
  {
    id: 'REQ-OP-01',
    topic: '데이터',
    target: '단일 출처',
    requirement:
      '관광지·공식문서·배점 상수는 한 곳에서만 관리한다. 키오스크·모바일·어드민이 같은 자료를 참조하며, 같은 값을 두 화면에서 고칠 수 있게 두지 않는다.',
    related: ['POI-001', 'DOC-001', 'REC-002', 'MOBILE-002'],
  },
  {
    id: 'REQ-OP-02',
    topic: '데이터',
    target: '파생 값',
    requirement:
      '건수·비율·분포처럼 다른 자료에서 도출되는 값은 저장하지 않고 계산한다. 화면마다 따로 세면 화면 수만큼 서로 다른 값이 생긴다.',
    related: ['DASHBOARD-001', 'POI-002', 'LINK-001'],
  },
  {
    id: 'REQ-OP-03',
    topic: '데이터',
    target: '실험값과 운영값',
    requirement:
      '어드민에서 바꾼 배점·설정은 실험값이며 키오스크 운영값과 섞이지 않는다. 두 값을 섞으면 어떤 배점으로 나온 결과인지 나중에 확인할 수 없다.',
    related: ['REC-001', 'REC-002', 'RESULT-001'],
  },
  {
    id: 'REQ-OP-04',
    topic: '표시',
    target: '빈 상태',
    requirement:
      '목록에 보여 줄 자료가 없으면 표 머리는 그대로 두고 아이콘과 함께 「등록된 내역이 없습니다.」를 표시한다. 화면마다 다른 말을 쓰지 않는다.',
    related: ['LOG-001', 'LOG-002', 'LOG-003', 'FIELD-001', 'ZONE-001', 'POI-001'],
  },
  {
    id: 'REQ-OP-05',
    topic: '표시',
    target: '자료 없음과 0',
    requirement:
      '측정하지 못한 값에 0을 적지 않는다. 0으로 적으면 「측정했는데 0이었다」로 읽히므로, 「자료 없음」과 무엇을 해야 채워지는지를 대신 표시한다.',
    related: ['DASHBOARD-001', 'FIELD-002'],
  },
  {
    id: 'REQ-OP-06',
    topic: '표시',
    target: '준비 중 화면',
    requirement:
      '백엔드가 있어야 채워지는 화면에는 그럴듯한 예시 숫자를 넣지 않는다. 무엇이 들어갈 자리이고 무엇이 있어야 채워지는지를 화면에 적는다.',
    related: ['LOG-001', 'LOG-004', 'SYSTEM-001', 'SYSTEM-002'],
  },
  {
    id: 'REQ-OP-07',
    topic: '표시',
    target: '큰 글씨 모드',
    requirement:
      '큰 글씨 모드에서는 선택지의 보조 설명을 숨긴다. 글자만 키우면 한 화면에 들어가지 않아 눌러야 할 것이 화면 밖으로 밀린다.',
    related: ['CONDITION-001', 'RESULT-001'],
  },
  {
    id: 'REQ-OP-08',
    topic: '기록',
    target: '답한 항목',
    requirement:
      '조건 항목에 기본값이 채워져 있어도 관람객이 실제로 누른 항목만 「답했음」으로 기록한다. 두 가지를 섞으면 아무것도 고르지 않은 사람이 특정 조건을 고른 것으로 집계된다.',
    related: ['CONDITION-001', 'FIELD-001'],
  },
  {
    id: 'REQ-OP-09',
    topic: '기록',
    target: '세션 단위',
    requirement:
      '한 번의 이용을 세션 하나로 묶어 조건·검색·후보 점수·제외 사유·재구성 이력·최종 일정을 함께 남긴다. 항목을 따로 저장하면 어느 결과가 어느 조건에서 나왔는지 잇지 못한다.',
    related: ['LOG-001', 'LOG-002', 'LOG-003'],
  },
  {
    id: 'REQ-OP-10',
    topic: '기록',
    target: '내보내기',
    requirement:
      '키오스크와 어드민은 다른 주소에 배포되어 저장소를 공유하지 못한다. 1단계에서는 진행자 패널의 파일 내보내기가 두 서비스를 잇는 유일한 경로이며, 서버가 붙기 전까지 이 경로를 유지한다.',
    related: ['PRESENTER-001', 'LOG-001'],
  },
  {
    id: 'REQ-OP-11',
    topic: '기록',
    target: '오류 판정',
    requirement:
      '오류는 예외 스택이 아니라 결과가 기준을 지키지 못한 순간으로 판정한다. 아무것도 회수하지 못한 검색, 요청을 이루지 못한 재구성, 목표를 넘긴 응답시간이 그 대상이다.',
    related: ['LOG-004'],
  },
  {
    id: 'REQ-OP-12',
    topic: '신뢰도',
    target: '추천 제외',
    requirement:
      '정보 신뢰도가 제외 기준 점수에 못 미치는 관광지는 후보에서 빼고, 강등 기준에 못 미치면 순위를 낮춘다. 뺀 경우에는 사유를 근거에 남긴다.',
    related: ['RESULT-001', 'LOG-003'],
  },
  {
    id: 'REQ-OP-13',
    topic: '신뢰도',
    target: '문서 갱신일',
    requirement:
      '공식문서는 갱신일로 최신 여부를 판정한다. 기준 기간 이내면 만점으로 보고, 오래된 기간을 넘기면 「오래된 정보」로 표시하며 감점한다.',
    related: ['DOC-001', 'RESULT-001'],
  },
  {
    id: 'REQ-OP-14',
    topic: '신뢰도',
    target: '출처 표시',
    requirement:
      '추천된 관광지에는 근거 문서의 이름·발행기관·갱신일을 함께 표시한다. 근거를 붙일 수 없는 곳은 추천하지 않는다.',
    related: ['RESULT-001', 'MOBILE-002'],
  },
  {
    id: 'REQ-OP-15',
    topic: '일정',
    target: '구성 상한',
    requirement:
      '하루 방문지 수와 같은 관광유형의 반복 횟수에 상한을 둔다. 상한이 없으면 화면 밖으로 넘치는 일정이 만들어지고 자원 다양성이 무너진다.',
    related: ['RESULT-001'],
  },
  {
    id: 'REQ-OP-16',
    topic: '일정',
    target: '이동시간 추정',
    requirement:
      '이동시간은 좌표 사이 직선거리에 우회계수와 승하차 비용을 더해 추정하며, 대중교통을 고르면 배율을 적용한다. 실시간 길찾기는 범위 밖이므로 실현 가능성 판단에 필요한 수준의 추정치만 쓴다.',
    related: ['RESULT-001'],
  },
  {
    id: 'REQ-OP-17',
    topic: '일정',
    target: '최소 변경',
    requirement:
      '수정 요청을 받으면 일정을 처음부터 다시 만들지 않고 요청과 관련된 부분만 바꾼다. 무엇이 어떻게 바뀌었는지를 변경 전후로 함께 제시한다.',
    related: ['RESULT-001'],
  },
  {
    id: 'REQ-OP-18',
    topic: '운영',
    target: '자동 초기화',
    requirement:
      '조작이 없으면 안내를 띄운 뒤 대기화면으로 돌아간다. 결과화면은 관람객이 오래 들여다보는 자리이므로 대기시간을 더 길게 둔다.',
    related: ['ATTRACT-001', 'RESULT-001'],
  },
  {
    id: 'REQ-OP-19',
    topic: '운영',
    target: '오프라인 우선',
    requirement:
      '외부에서 받아 오는 것이 실패해도 체험이 끊기지 않는다. 지도 타일을 받지 못하면 내장 도형 안내도로 바꾸고, 서체는 앱과 같은 주소에서 내보내 회선과 무관하게 그려지도록 한다.',
    related: ['ATTRACT-001', 'RESULT-001'],
  },
  {
    id: 'REQ-OP-20',
    topic: '운영',
    target: '오류 복구',
    requirement:
      '추천 계산에서 예외가 나도 화면을 비우지 않는다. 예외를 붙잡아 안내 문구로 바꾸고, 처음으로 돌아갈 수 있는 길을 남긴다.',
    related: ['CONDITION-001', 'RESULT-001'],
  },
  {
    id: 'REQ-OP-21',
    topic: '개인정보',
    target: '수집 범위',
    requirement:
      '개인을 식별할 수 있는 값을 받지 않는다. 로그는 세션 식별자 기준의 익명 기록이며, 회원가입·로그인·본인인증 절차를 두지 않는다.',
    related: ['HANDOFF-001', 'LOG-001'],
  },
  {
    id: 'REQ-OP-22',
    topic: '개인정보',
    target: 'QR 전달 방식',
    requirement:
      'QR 에는 조회 주소가 아니라 일정 내용 자체를 담는다. 서버에 일정을 저장하지 않으므로 남는 기록이 없고, 회선이 끊긴 곳에서도 휴대폰이 결과를 연다.',
    related: ['HANDOFF-001', 'MOBILE-002'],
  },
  {
    id: 'REQ-OP-23',
    topic: '접근 통제',
    target: '진행자 기능',
    requirement:
      '진행자 전용 기능은 화면에 단추를 두지 않고 숨은 제스처로만 연다. 관람객이 우연히 열면 시연 중 화면이 바뀐다.',
    related: ['PRESENTER-001'],
  },
  {
    id: 'REQ-OP-24',
    topic: '이동',
    target: '주소와 화면',
    requirement:
      '어드민은 화면마다 주소를 가지며 상세는 주소에 대상 식별자를 적는다. 새로고침·뒤로가기·링크 전달이 같은 자리를 찾도록 하기 위한 것이다.',
    related: ['POI-001', 'DOC-001', 'LOG-001', 'FIELD-001', 'ZONE-001'],
  },
  {
    id: 'REQ-OP-25',
    topic: '삭제',
    target: '확인 절차',
    requirement:
      '삭제는 대상의 이름을 확인 문구에 넣어 되묻는다. 되돌릴 수 없는 조작이 한 번의 잘못된 터치로 실행되지 않게 한다.',
    related: ['ZONE-001', 'FIELD-003', 'SYSTEM-002'],
  },
];
