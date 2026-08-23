/**
 * 산출 문서의 자료형.
 *
 * ── 왜 타입으로 두는가 ─────────────────────────────────────────────
 * 요구사항 정의서·기능 명세서·화면 정의서는 같은 사실을 다른 각도에서 적는다.
 * 세 문서를 따로 손으로 쓰면 화면 하나를 고칠 때 세 곳을 고쳐야 하고,
 * 한 곳을 빠뜨리면 «문서끼리 서로 다른 말을 하는» 상태가 조용히 남는다.
 *
 * 그래서 사실은 이 폴더의 자료에만 적고, 문서는 생성기가 만든다.
 * 타입을 두면 빠뜨린 칸이 컴파일 단계에서 걸리고, 문서 사이의 참조
 * (요구사항 → 화면, 시나리오 → 화면)도 생성기가 대조할 수 있다.
 * ──────────────────────────────────────────────────────────────────
 */

/** 산출물이 다루는 세 앱. 화면 id 는 앱 안에서만 유일하다. */
export type DocAppId = 'kiosk' | 'mobile' | 'admin';

/**
 * 지금 실제로 도는가.
 *
 *   working  — 이 저장소의 자료·엔진만으로 값이 나온다
 *   pending  — 화면은 있으나 채울 자료를 백엔드가 줘야 한다
 *
 * 「예정」을 「됨」으로 적지 않기 위한 칸이다. 검수 때 캡처된 화면이
 * 문서와 어긋나는 일을 막는다.
 */
export type DocReadiness = 'working' | 'pending';

/**
 * 기능 한 줄. [사용자 동작] → [시스템 동작] → [결과] 로만 적는다.
 *
 * 셋 중 하나라도 비면 «무엇을 눌렀을 때 무엇이 되는지»를 읽을 수 없으므로,
 * 생성기가 빈 칸을 발견하면 문서를 만들지 않고 멈춘다.
 */
export interface DocFeature {
  /** 기능 식별자. 요구사항 추적표가 이 값으로 화면과 기능을 잇는다. */
  id: string;
  /** 사용자가 하는 일. 화면에 실제로 있는 조작만 적는다. */
  action: string;
  /** 시스템이 하는 일. 어떤 자료를 읽고 무엇을 계산하는지. */
  process: string;
  /** 사용자가 보게 되는 것. */
  result: string;
}

/** 화면을 이루는 영역 한 칸. 화면 정의서의 «영역 설명» 표가 된다. */
export interface DocArea {
  name: string;
  /** 이 영역이 무엇을 보여 주는지. */
  content: string;
  /** 값이 어디서 오는지 — 파일·상수·사용자 입력 중 하나를 가리킨다. */
  source: string;
}

/** 화면 하나의 정의. 화면 정의서·기능 명세서가 같은 자료를 쓴다. */
export interface DocScreen {
  app: DocAppId;
  /** 앱 안에서 유일한 id. 어드민은 `navigation.ts` 의 id 와 같아야 한다. */
  id: string;
  name: string;
  /** 요구사항 표의 「영역」. 같은 영역끼리 묶여 읽힌다. */
  area: string;
  /** 「대응 기능」 코드. 기능 명세서가 같은 코드로 이 화면을 받는다. */
  code: string;
  /** 요구사항 표에 그대로 실리는 서술. 무엇을 하는 화면이고 왜 그렇게 두는지. */
  requirement: string;
  /** 주소 또는 화면 전환 단계. 키오스크는 단일 주소이므로 단계명을 적는다. */
  route: string;
  readiness: DocReadiness;
  /** 이 화면이 있는 이유. 한 문장. */
  purpose: string;
  /** 이 화면에 닿는 길. */
  entry: readonly string[];
  areas: readonly DocArea[];
  features: readonly DocFeature[];
  /** 자료가 없거나 조건을 못 갖췄을 때의 처리. */
  guards: readonly string[];
  /** 이 화면에서 나가는 길. */
  exits: readonly string[];
  /** 관리자가 이 화면의 무엇을 바꿀 수 있는지. 바꿀 수 없으면 그렇게 적는다. */
  adminControl: string;
  /** 백엔드가 붙어야 채워지는 부분. 지금 다 되는 화면은 비운다. */
  backendNeed?: string;
  /** 근거가 되는 제안서·피드백 절 번호. 코드 주석에 남아 있는 것만 적는다. */
  basis?: string;
}

/** 요구사항 한 건. */
export interface DocRequirement {
  /** SR-키오스크-01 처럼 사람이 읽는 번호. */
  id: string;
  category: string;
  /** 요구 내용. «~한다» 로 끝맺는다. */
  statement: string;
  /** 이 요구가 어디서 왔는지. */
  origin: string;
  /** 이 요구를 실현하는 화면. `app/id` 형식. */
  screens: readonly string[];
  readiness: DocReadiness;
}

/** 과업 범위 항목. */
export interface DocScopeItem {
  /** 무엇을 하는 일인지. */
  title: string;
  /** 그 일에 실제로 들어가는 것들. */
  details: readonly string[];
}

/** 비기능 요구 한 건. */
export interface DocNonFunctional {
  id: string;
  category: string;
  requirement: string;
  /** 지금 코드에 박혀 있는 값. 정해지지 않았으면 'TBD' 를 쓴다. */
  currentValue: string;
  /** 어떻게 확인하는가 — 실행 가능한 명령이나 관측 방법. */
  verification: string;
}

/** 시나리오 한 단계. */
export interface DocScenarioStep {
  /** 이 단계가 일어나는 화면. `app/id` 형식. */
  screen: string;
  action: string;
  expected: string;
}

/** 시나리오 한 건. 시연 대본이자 검수 항목이다. */
export interface DocScenario {
  id: string;
  title: string;
  /** 이 시나리오로 무엇을 확인하는가. */
  goal: string;
  /** 시작하기 전에 갖춰져 있어야 하는 것. */
  preconditions: readonly string[];
  steps: readonly DocScenarioStep[];
  /** 무엇을 보면 통과인가. */
  pass: readonly string[];
}
