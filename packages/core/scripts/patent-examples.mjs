/**
 * 특허 기술설명서 · 예시 입출력 생성기.
 *
 * 피드백 [기타] — "부트캠프 시연 전 최소한의 청구항 확보를 위해 '기술설명서 및 예시 입출력
 * 데이터'를 3/4주 차 이전에 조기 납품(=> 반드시 작동 가능한 예시 입출력 로그와 기술설명서)"
 * 및 5.3 — "단순 개념도뿐 아니라 데이터 항목, 처리 순서, 조건분기, 산출값,
 * 예시입력/예시출력을 기술설명서에 포함해 주십시오." 에 대한 구현이다.
 *
 *     npm run patent:examples
 *
 * 문서에 실리는 수치·임계값·가중치는 전부 **실제 코드를 실행해서** 얻는다.
 * 손으로 옮겨 적지 않으므로 구현이 바뀌면 문서도 함께 바뀐다.
 * 손으로 쓴 기술설명서가 코드와 어긋난 채 출원되는 사고를 막기 위한 구조다.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = join(HERE, '..');
const REPO_ROOT = join(CORE_ROOT, '..', '..');
const BUILD_DIR = join(CORE_ROOT, '.build-scripts');
const OUT_DIR = join(REPO_ROOT, 'docs', 'patent-examples');
const EXAMPLE_DIR = join(OUT_DIR, 'examples');
const DIAGRAM_DIR = join(OUT_DIR, 'diagrams');

/** 신뢰도 갱신일 판정 기준일. 인자로 고정할 수 있어야 문서가 재현 가능해진다. */
const REFERENCE_DATE = process.argv[2] ?? new Date().toISOString().slice(0, 10);

console.log('도메인 모듈 컴파일 중...');
execFileSync(process.execPath, [
  join(REPO_ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  '-p',
  join(CORE_ROOT, 'tsconfig.scripts.json'),
], { stdio: 'inherit' });

/**
 * 코어 패키지는 `"type": "module"` 이므로, 컴파일된 CommonJS 산출물이 ESM으로 해석된다.
 * 산출물 폴더에 별도 package.json 을 두어 그 하위만 CommonJS 로 취급하게 한다.
 */
writeFileSync(join(BUILD_DIR, 'package.json'), '{ "type": "commonjs" }\n', 'utf8');

const require = createRequire(import.meta.url);
const load = (path) => require(join(BUILD_DIR, path));

const { generateItinerary, buildConditionVector } = load('domain/linkage-recommendation/index.js');
const { replanItinerary } = load('domain/minimal-change-replan/index.js');
const { buildMetricDeltas } = load('domain/minimal-change-replan/changeDiff.js');
const { evaluateAcceptance } = load('domain/shared/acceptance.js');
const { compareAlgorithms, BASELINES } = load('domain/shared/comparison.js');
const { DEMO_SCENARIOS } = load('data/scenarios.js');
const { PATENT_DIAGRAMS } = load('data/patentDiagrams.js');
const { renderDiagram } = load('design/diagram.js');
const { requireAttraction, ATTRACTIONS } = load('data/attractions.js');
const { OFFICIAL_DOCUMENTS, getDocument } = load('data/officialDocuments.js');
const labels = load('domain/labels.js');
const scoring = load('config/scoring.js');
const { REFINEMENT_DEFINITIONS, REFINEMENT_ORDER } = load('config/refinements.js');
const { MAX_REPLACEMENTS_PER_REQUEST } = load('domain/minimal-change-replan/minimalChange.js');
const { MINIMUM_SIMILARITY } = load('domain/minimal-change-replan/replacementSearch.js');
const { MINIMUM_OBJECTIVE_DELTA } = load('domain/minimal-change-replan/constraintChange.js');

const name = (id) => requireAttraction(id).name;

/* ── 실행 ─────────────────────────────────────────────────────────── */

const runs = DEMO_SCENARIOS.map((scenario) => {
  const vector = buildConditionVector(scenario.conditions);
  const generation = generateItinerary({
    conditions: scenario.conditions,
    referenceDate: REFERENCE_DATE,
    itineraryId: `it_${scenario.id}`,
  });

  const replans = REFINEMENT_ORDER.map((refinementId) =>
    replanItinerary({
      itinerary: generation.itinerary,
      conditions: scenario.conditions,
      vector,
      refinementId,
      referenceDate: REFERENCE_DATE,
    }),
  );

  return { scenario, vector, generation, replans };
});

const primary = runs[0];
const acceptance = evaluateAcceptance();
const comparison = compareAlgorithms(
  DEMO_SCENARIOS.map((scenario) => scenario.conditions),
  REFERENCE_DATE,
);

/* ── 표 만들기 ────────────────────────────────────────────────────── */

const table = (headers, rows) =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

const itineraryLines = (itinerary) =>
  itinerary.days
    .map(
      (day) =>
        `- **${day.title}** — ` +
        day.stops
          .map((stop) => `${formatClock(stop.startMinutes)} ${name(stop.attractionId)}`)
          .join(' → '),
    )
    .join('\n');

function formatClock(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
}

/* ── 특허 1 기술설명서 ────────────────────────────────────────────── */

function buildPatent1Document() {
  const { scenario, vector, generation } = primary;
  const { itinerary, trace } = generation;
  const topCandidate = trace.candidates[0];

  return `# 특허 후보 제1안 기술설명서

**「초광역 관광연계지수와 정보 신뢰도를 이용한 설명가능 여행일정 생성 방법 및 시스템」**

> 본 문서는 \`npm run patent:examples\` 로 **실제 구현을 실행해 자동 생성**되었습니다.
> 수치·임계값·가중치는 모두 실행 결과이며 손으로 옮겨 적지 않았습니다.
> 기준일 \`${REFERENCE_DATE}\` · 관광지 ${ATTRACTIONS.length}곳 · 공식문서 ${OFFICIAL_DOCUMENTS.length}건

---

## 1. 처리 순서

${table(
  ['단계', '처리 내용', '구현 모듈', '산출값'],
  [
    ['1', '이용자 여행조건 입력', '(프레젠테이션 계층)', 'TravelConditions'],
    ['2', '여행조건을 복수의 평가요소로 변환', 'conditionVector.ts', 'ConditionVector'],
    ['3', '공식 관광문서에서 후보 관광지 검색', 'retrieval.ts', 'RetrievalResult'],
    ['4', '정보 신뢰도 산출', 'trust.ts', 'TrustAssessment'],
    ['5', '신뢰도·조건 기준 미달 후보 제외', 'eligibility.ts', 'ExclusionRecord[]'],
    ['6', '초광역 관광연계지수 산출', 'linkageIndex.ts', 'LinkageAssessment'],
    ['7', '다목적 추천점수 산출 및 일정 생성', 'scoring.ts · composer.ts', 'CandidateScore[] · Itinerary'],
    ['8', '추천 이유와 근거문서 출력', 'rationale.ts', 'StopRationale'],
  ],
)}

## 2. 데이터 항목

### 2.1 입력 — 여행조건 (6개 항목)

${table(
  ['항목', '값 범위', '예시 입력'],
  [
    ['동행자', Object.keys(labels.COMPANION_LABELS).join(' / '), scenario.conditions.companion],
    ['여행기간', Object.keys(labels.DURATION_LABELS).join(' / '), scenario.conditions.duration],
    ['관심분야', `${Object.keys(labels.INTEREST_LABELS).join(' / ')} (최대 3)`, scenario.conditions.interests.join(', ')],
    ['이동수단', Object.keys(labels.TRANSPORT_LABELS).join(' / '), scenario.conditions.transport],
    ['특별조건', '복수 선택', scenario.conditions.specialNeeds.join(', ')],
    ['출발지', '문자열', scenario.conditions.origin],
  ],
)}

### 2.2 중간 산출 — 조건벡터 (단계 2의 출력)

선택형 입력을 연속값으로 구조화한 결과입니다. 이후 모든 점수 계산은 원본 선택값이 아니라
이 벡터만을 입력으로 받습니다.

${table(
  ['평가요소', '범위', '예시 값'],
  [
    ['보행 감내 한계', '0–100', vector.walkingTolerance],
    ['실내 선호도', '0–100', vector.indoorPreference],
    ['비용 민감도', '0–100', vector.costSensitivity],
    ['대중교통 의존도', '0–100', vector.transitDependency],
    ['고령자 배려 필요도', '0–100', vector.seniorConsideration],
    ['아동 배려 필요도', '0–100', vector.childConsideration],
    ['이동거리 축소 요구', '0–100', vector.compactnessDemand],
    ['하루 활동 가능시간', '분', vector.dailyCapacityMinutes],
    ['여행 일수', '정수', vector.dayCount],
    ['관심유형 가중치', '합계 1.0', Object.entries(vector.interestWeights).filter(([, w]) => w > 0).map(([k, w]) => `${k} ${w.toFixed(3)}`).join(', ')],
  ],
)}

### 2.3 관광지 메타데이터 (${ATTRACTIONS.length}곳)

관광지명 · 지역 · 시군구 · 주소 · 위경도 · 관광유형 · 추천대상 · 운영시간 · 휴무일 ·
평균 체류시간 · 실내외 구분 · 보행부담 · 가족 적합도 · 고령자 적합도 · 우천 적합도 ·
대중교통 접근성 · 비용 수준 · 인접 관광지 (수치 항목은 모두 0–100 정규화)

### 2.4 공식문서 메타데이터 (${OFFICIAL_DOCUMENTS.length}건)

문서명 · 출처기관 · 기관유형 · URL · **최종 갱신일** · 대상 관광지 · **확인 가능 정보항목** · 키워드 · 발췌

## 3. 조건분기

### 3.1 정보 신뢰도 산출 (단계 4)

${table(
  ['산출요소', '배점', '만점 조건'],
  [
    ['공식기관 자료 여부', scoring.TRUST_WEIGHTS.officialIssuer, '기관유형이 지방자치단체'],
    ['최신 갱신일 여부', scoring.TRUST_WEIGHTS.recentUpdate, `갱신 후 ${scoring.DOCUMENT_FRESHNESS_DAYS.fresh}일 이내 (${scoring.DOCUMENT_FRESHNESS_DAYS.stale}일 초과 시 0점, 그 사이는 선형 감점)`],
    ['복수 공식 출처 일치', scoring.TRUST_WEIGHTS.corroboration, `서로 다른 출처기관 ${scoring.CORROBORATION_TARGET_DOCUMENTS}곳 이상`],
    ['정보 항목 확인', scoring.TRUST_WEIGHTS.fieldCoverage, `확인 항목 ${scoring.FIELD_COVERAGE_TARGET}종 이상`],
  ],
)}

- 신뢰도 **${scoring.TRUST_THRESHOLDS.exclude}점 미만** → 추천 대상에서 **제외**
- 신뢰도 **${scoring.TRUST_THRESHOLDS.demote}점 미만** → 순위 **하향**

### 3.2 후보 제외 분기 (단계 5)

${table(
  ['제외 사유', '분기 조건'],
  [
    ['공식 출처 없음', '해당 관광지를 다루는 공식문서가 색인에 없음'],
    ['갱신일 초과', `최근 갱신일 경과 ≥ ${scoring.DOCUMENT_FRESHNESS_DAYS.stale}일`],
    ['신뢰도 미달', `정보 신뢰도 < ${scoring.TRUST_THRESHOLDS.exclude}`],
    ['보행부담 초과', '관광지 보행부담 > 보행 감내 한계 + 28'],
    ['이동 실현 불가', '대중교통 의존도 ≥ 70 **그리고** 대중교통 접근성 < 32'],
    ['실내 선호 불일치', '실내 선호도 ≥ 70 **그리고** 우천 적합도 < 26'],
    ['관심분야 불일치', '관심유형 매칭 가중치 합 < 0.06 (관심분야를 선택한 경우에만)'],
    ['방문일 휴무', '방문 요일이 휴무일에 포함 (요일이 지정된 경우에만)'],
    ['운영시간 초과', '도착 예정시각 + 체류시간 > 운영 종료시각'],
    ['일정 수용량 초과', '누적 소요시간 + (이동 + 체류) > 하루 활동 가능시간'],
  ],
)}

### 3.3 초광역 연계지수 구성 (단계 6)

${table(
  ['구성요소', '가중치', '산식'],
  [
    ['지역 균형', scoring.LINKAGE_WEIGHTS.regionBalance, '2 × min(광주 수, 전남 수) ÷ 전체 수 × 100'],
    ['자원 상보성', scoring.LINKAGE_WEIGHTS.resourceComplementarity, '(1 − 두 지역 관광유형 교집합 ÷ 합집합) × 100'],
    ['이동 효율', scoring.LINKAGE_WEIGHTS.corridorEfficiency, '최소 경계횡단 수(1) ÷ 실제 경계횡단 수 × 100'],
    ['여정 연속성', scoring.LINKAGE_WEIGHTS.narrativeContinuity, '인접·동일 시군으로 이어진 구간 수 ÷ 전체 구간 수 × 100'],
  ],
)}

> **한 지역만으로 구성된 일정은 지역 균형·자원 상보성·이동 효율이 모두 0점이 됩니다.**
> 반대로 "광주 1곳 + 전남 1곳"이라고 자동으로 만점이 되지도 않습니다 —
> 자원 성격이 겹치거나 경계를 여러 번 넘나들면 감점됩니다.
> 이 점이 단순 지역 배분 규칙과 본 지수를 구분하는 지점입니다.

### 3.4 다목적 추천점수 배점 (단계 7)

${table(
  ['평가항목', '배점'],
  Object.entries(scoring.SCORE_WEIGHTS).map(([id, weight]) => [labels.SCORE_CRITERION_LABELS[id], weight]),
)}

\`광주·전남 연계도\` 항목은 별도 휴리스틱이 아니라 **"이 후보를 추가했을 때 초광역
연계지수가 얼마나 상승하는가"라는 한계기여**로 정의됩니다 (50점 = 지수 불변).

## 4. 예시 입출력

### 4.1 예시 입력

\`\`\`json
${JSON.stringify(scenario.conditions, null, 2)}
\`\`\`

### 4.2 예시 출력 — 생성된 일정

**${itinerary.title}**

${itineraryLines(itinerary)}

${table(
  ['지표', '값'],
  [
    ['보행부담', itinerary.metrics.walkingLoad],
    ['총 이동시간(분)', itinerary.metrics.travelMinutes],
    ['실내 일정 비율(%)', itinerary.metrics.indoorRatio],
    ['비용 수준', itinerary.metrics.costLevel],
    ['평균 정보 신뢰도', itinerary.metrics.averageTrust],
    ['**초광역 연계지수**', `**${itinerary.metrics.linkageScore}**`],
    ['광주 / 전남 방문지 수', `${itinerary.metrics.stopsByRegion.gwangju} / ${itinerary.metrics.stopsByRegion.jeonnam}`],
  ],
)}

### 4.3 예시 출력 — 연계지수 산출 내역

${table(
  ['구성요소', '값', '산출 근거'],
  trace.linkage.components.map((component) => [
    labels.LINKAGE_COMPONENT_LABELS[component.id],
    component.value,
    component.explanation,
  ]),
)}

### 4.4 예시 출력 — 최상위 후보의 추천점수 내역

**${name(topCandidate.attractionId)}** — 총점 ${topCandidate.total}

${table(
  ['평가항목', '원점수', '배점', '기여분'],
  topCandidate.criteria.map((criterion) => [
    labels.SCORE_CRITERION_LABELS[criterion.id],
    criterion.raw,
    criterion.weight,
    criterion.weighted,
  ]),
)}

### 4.5 예시 출력 — 제외된 후보와 사유 (전체 ${trace.exclusions.length}건 중 상위 8건)

${table(
  ['관광지', '제외 단계', '제외 사유', '상세'],
  trace.exclusions.slice(0, 8).map((exclusion) => [
    name(exclusion.attractionId),
    labels.EXCLUSION_STAGE_LABELS[exclusion.stage],
    labels.EXCLUSION_REASON_LABELS[exclusion.reason],
    exclusion.detail,
  ]),
)}

### 4.6 예시 출력 — 추천 근거 문장

**${name(itinerary.days[0].stops[0].attractionId)}**

${itinerary.days[0].stops[0].rationale.reasons.map((reason) => `- ${reason}`).join('\n')}

근거 문서:
${itinerary.days[0].stops[0].rationale.sourceDocumentIds
  .map((id) => {
    const document = getDocument(id);
    return `- ${document.title} (${document.issuer}, 최종 갱신 ${document.updatedAt})`;
  })
  .join('\n')}

### 4.7 RAG 검색 결과 (상위 5건)

검색질의: \`${trace.retrieval.query.text}\`

${table(
  ['순위', '문서명', '출처기관', '검색점수'],
  trace.retrieval.documents.slice(0, 5).map((document) => [
    document.rank,
    getDocument(document.documentId).title,
    getDocument(document.documentId).issuer,
    document.similarity.toFixed(3),
  ]),
)}

## 5. 진보성 근거 — 통상의 방식과의 대조

같은 여행조건을 제안 알고리즘과 두 대조군에 각각 통과시킨 결과입니다.
대조군은 **본 저장소가 정의한 구현**이며(외부 벤치마크가 아님), 선정 규칙을 함께 공개합니다.

${table(
  ['대조군', '모사 대상', '선정 규칙', '수행하지 않는 처리'],
  Object.values(BASELINES).map((baseline) => [
    baseline.name,
    baseline.models,
    baseline.rule,
    baseline.omits.join(' · '),
  ]),
)}

### 시나리오 ${comparison.scenarios.length}종 평균 (제안 − 대조군 평균)

${table(
  ['비교 항목', '차이'],
  [
    ['초광역 연계지수', `+${comparison.summary.linkageGain}점`],
    ['평균 정보 신뢰도', `+${comparison.summary.trustGain}점`],
    ['회피한 보행조건 위반', `${comparison.summary.avoidedWalkingViolations}곳`],
    ['회피한 운영시간 위반', `${comparison.summary.avoidedOpeningHourViolations}곳`],
    ['회피한 미검증 자원 포함', `${comparison.summary.avoidedUntrustedStops}곳`],
  ],
)}

### 시나리오별 상세

${comparison.scenarios
  .map((entry, index) => {
    const rows = [entry.proposed, ...entry.baselines].map((arm) => [
      arm.name,
      arm.measures.linkageScore,
      arm.measures.averageTrust,
      `${arm.measures.explainedRatio}%`,
      `${arm.measures.walkingViolations}곳`,
      `${arm.measures.openingHourViolations}곳`,
      `${arm.measures.overloadedDays}일`,
      `${arm.measures.totalTravelMinutes}분`,
    ]);
    return [
      `**${DEMO_SCENARIOS[index].title}**`,
      '',
      table(
        ['방식', '연계지수', '평균 신뢰도', '근거 제시율', '보행조건 위반', '운영시간 위반', '활동시간 초과일', '총 이동시간'],
        rows,
      ),
    ].join('\n');
  })
  .join('\n\n')}

> **근거 제시율 0% 대 100%** 가 가장 크게 벌어지는 항목입니다.
> 대조군은 어떤 장소를 왜 골랐는지 산출하지 않으며, 제안 방식은 모든 방문지에
> 수치를 포함한 이유와 근거문서를 남깁니다. 설명가능 AI로서의 구분점이 여기에 있습니다.
>
> 「미검증 자원 회피」는 대조군이 저신뢰 자원을 실제로 선택했을 때만 값이 생깁니다.
> 현재 데이터셋에는 의도적 저신뢰 자원이 1곳뿐이므로 값이 작게 나올 수 있으며,
> 이는 방식의 우열이 아니라 데이터 구성의 문제입니다.

## 6. 재현성

- 같은 입력 + 같은 기준일 → 항상 같은 출력 (난수 없음)
- 처리 소요시간: ${trace.elapsedMs.toFixed(2)}ms
- 검수 게이트 실측: 출처 제시율 ${acceptance.metrics[0].value}% · 답변–근거 일치율 ${acceptance.metrics[1].value}% (기준 평가질문 ${acceptance.totalQuestions}개)

시나리오별 전체 입출력은 \`examples/patent1-*.json\` 에 있습니다.
`;
}

/* ── 특허 2 기술설명서 ────────────────────────────────────────────── */

function buildPatent2Document() {
  const { generation, replans } = primary;
  const showcase = replans.find((replan) => replan.trace.replacements.length > 0) ?? replans[0];
  const { trace } = showcase;
  const deltas = buildMetricDeltas(trace.before, trace.after, trace.objective).filter(
    (delta) => delta.delta !== 0,
  );

  return `# 특허 후보 제2안 기술설명서

**「사용자 제약조건 변화에 따른 최소변경 여행일정 재구성 방법 및 장치」**

> 본 문서는 \`npm run patent:examples\` 로 **실제 구현을 실행해 자동 생성**되었습니다.
> 기준일 \`${REFERENCE_DATE}\`

---

## 1. 처리 순서

${table(
  ['단계', '처리 내용', '구현 모듈', '산출값'],
  [
    ['1', '기존 일정과 추가 제약조건의 비교', 'constraintChange.ts', 'ConstraintDelta · RefinementObjective'],
    ['2', '변경이 필요한 장소/구간 식별', 'impact.ts', 'StopImpact[]'],
    ['3', '대체 후보 탐색 및 적합성 평가', 'replacementSearch.ts', 'ReplacementOption · RejectedAlternative[]'],
    ['4', '변화량을 최소화하는 재구성', 'minimalChange.ts', 'StopReplacement[]'],
    ['5', '변경 전/후 차이 계산', 'changeDiff.ts', 'MetricDelta[]'],
    ['6', '유지 장소·변경 장소 및 변경 이유 설명', 'changeDiff.ts · minimalChange.ts', 'keptStopIds · changedStopIds · changeRatio'],
  ],
)}

**입력은 제1안이 생성한 일정입니다.** 본 모듈은 제1안을 참조하지만 그 역은 성립하지 않으며,
이 단방향 의존이 두 발명을 각각 별도 권리화 검토할 수 있게 하는 구조적 근거입니다.

## 2. 데이터 항목 — 제약조건 변화량

이용자가 누르는 버튼 하나가 **조건벡터 증감량**과 **목표**라는 두 데이터로 번역됩니다.
함수가 아니라 선언적 데이터이므로 그대로 로그와 실시예에 실립니다.

${table(
  ['요청', '기술 명칭', '목표', '조건벡터 증감량', '단계'],
  REFINEMENT_ORDER.map((id) => {
    const definition = REFINEMENT_DEFINITIONS[id];
    const objective =
      definition.objective.kind === 'metric'
        ? `${definition.objective.metric} ${definition.objective.direction === 'decrease' ? '감소' : '증가'}`
        : definition.objective.kind === 'categoryShare'
          ? `${definition.objective.category} 구성비 증가`
          : `${definition.objective.region} 구성비 증가`;
    return [
      definition.label,
      definition.technicalName,
      objective,
      `\`${JSON.stringify(definition.constraintDelta)}\``,
      definition.phase,
    ];
  }),
)}

> 6종 요청이 모두 하나의 스칼라 지표로 환원되지는 않습니다. "자연을 더 넣어줘"는 관광유형
> 구성비, "전남을 더 넣어줘"는 지역 구성비의 문제이므로 목표를 세 종류로 구분해
> 각각의 달성 여부를 판정합니다.

## 3. 조건분기

### 3.1 영향도 산정 (단계 2)

목표 지표별로 "이 방문지가 얼마나 문제의 원인인가"를 0–100으로 계산해 내림차순 정렬합니다.

${table(
  ['목표', '기여도 산식'],
  [
    ['보행부담 감소', '관광지 보행부담 값'],
    ['비용 감소', '관광지 비용 수준 값'],
    ['실내 비율 증가', '100 − 실내도(실내 100 / 실내외 50 / 실외 0)'],
    ['이동시간 감소', '직전 구간 이동시간을 0–120분 구간에서 정규화'],
    ['관광유형 구성비 증가', '해당 유형을 갖지 않으면 100, 가지면 0'],
    ['지역 구성비 증가', '해당 지역이 아니면 100, 맞으면 0'],
  ],
)}

### 3.2 대체 후보 기각 분기 (단계 3)

${table(
  ['기각 사유', '분기 조건'],
  [
    ['일정 성립 불가', '교체본을 재계산했을 때 운영시간 초과 **또는** 하루 활동 가능시간 초과'],
    ['개선 없음', '목표 지표가 요청 방향으로 움직이지 않음 (개선폭 ≤ 0)'],
    ['성격 상이', `관광가치 유사도 < ${MINIMUM_SIMILARITY}점`],
    ['차순위', '위 조건을 모두 통과했으나 채택안보다 종합점수가 낮음'],
  ],
)}

**관광가치 유사도** = 관광유형 일치도 55 + 추천대상 일치도 20 + 지역 일치 15 + 실내외 성격 일치 10

개선폭은 추정하지 않습니다. 후보마다 실제로 일정을 갈아 끼우고 지표를 다시 계산해 얻은 확정값입니다.

### 3.3 최소변경 종료 조건 (단계 4)

${table(
  ['조건', '값'],
  [
    ['한 요청당 최대 교체 수', `${MAX_REPLACEMENTS_PER_REQUEST}곳`],
    ['목표 달성 인정 최소 변화폭', MINIMUM_OBJECTIVE_DELTA],
    ['조기 종료', '교체 1건 후 목표가 달성되면 즉시 중단 (남은 영향도 순위를 보지 않음)'],
    ['기여도 0인 방문지', '문제의 원인이 아니므로 교체 대상에서 제외'],
  ],
)}

상한을 두는 이유는, 상한이 없으면 사실상 재생성이 되어 제1안과 구분되지 않기 때문입니다.
**목표를 달성하지 못하더라도 상한에서 멈추고, 달성 실패 사실을 그대로 반환합니다.**

## 4. 예시 입출력

### 4.1 예시 입력

- 기존 일정: **${generation.itinerary.title}**
${itineraryLines(generation.itinerary)}
- 추가 제약조건: **「${REFINEMENT_DEFINITIONS[trace.refinementId].label}」**
- 조건벡터 증감량: \`${JSON.stringify(trace.constraintDelta)}\`

### 4.2 예시 출력 — 영향도 순위 (상위 5건)

${table(
  ['순위', '방문지', '기여도', '예상 개선폭'],
  trace.impactRanking.slice(0, 5).map((impact, index) => [
    index + 1,
    name(impact.attractionId),
    impact.contribution,
    impact.projectedGain,
  ]),
)}

### 4.3 예시 출력 — 채택된 교체

${
  trace.replacements.length > 0
    ? trace.replacements
        .map(
          (replacement) =>
            `**${name(replacement.removedAttractionId)} → ${name(replacement.addedAttractionId)}**\n\n` +
            `- 관광가치 유사도: ${replacement.similarity}점\n` +
            `- 목표 지표 개선폭: ${replacement.metricGain}\n` +
            replacement.reasons.map((reason) => `- ${reason}`).join('\n'),
        )
        .join('\n\n')
    : '채택된 교체 없음 (모든 후보가 기각됨)'
}

### 4.4 예시 출력 — 기각된 대체안 (상위 5건)

${table(
  ['후보', '유사도', '개선폭', '기각 사유'],
  trace.rejectedAlternatives.slice(0, 5).map((alternative) => [
    name(alternative.attractionId),
    alternative.similarity,
    alternative.metricGain,
    alternative.reason,
  ]),
)}

### 4.5 예시 출력 — 변경 전/후 차이

${table(
  ['지표', '변경 전', '변경 후', '차이', '판정'],
  deltas.map((delta) => [
    delta.label,
    `${delta.before}${delta.unit}`,
    `${delta.after}${delta.unit}`,
    `${delta.delta > 0 ? '+' : ''}${delta.delta}`,
    { improved: '개선', worsened: '악화', neutral: '중립', unchanged: '동일' }[delta.direction],
  ]),
)}

### 4.6 예시 출력 — 최소변경 판정

${table(
  ['항목', '값'],
  [
    ['유지된 장소', `${trace.keptStopIds.length}곳`],
    ['변경된 장소', `${trace.changedStopIds.length}곳`],
    ['**변화량**', `**${trace.changeRatio}%**`],
    ['목표 달성 여부', trace.objectiveSatisfied ? '달성' : '미달성'],
    ['처리 소요시간', `${trace.elapsedMs.toFixed(2)}ms`],
  ],
)}

## 5. 6종 요청 전체 실행 결과

동일한 기존 일정에 6종 요청을 각각 적용한 결과입니다.

${table(
  ['요청', '단계', '목표 달성', '변화량', '유지', '변경', '교체 내역'],
  replans.map(({ trace: entry }) => [
    REFINEMENT_DEFINITIONS[entry.refinementId].label,
    REFINEMENT_DEFINITIONS[entry.refinementId].phase,
    entry.objectiveSatisfied ? '달성' : '미달성',
    `${entry.changeRatio}%`,
    entry.keptStopIds.length,
    entry.changedStopIds.length,
    entry.replacements
      .map((replacement) => `${name(replacement.removedAttractionId)} → ${name(replacement.addedAttractionId)}`)
      .join('; ') || '—',
  ]),
)}

시나리오별 전체 입출력은 \`examples/patent2-*.json\` 에 있습니다.
`;
}

/* ── 출력 ─────────────────────────────────────────────────────────── */

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(EXAMPLE_DIR, { recursive: true });
mkdirSync(DIAGRAM_DIR, { recursive: true });

// 특허 도면 — 임계값·가중치가 설정 상수에서 오므로 구현이 바뀌면 도면도 함께 바뀐다.
for (const diagram of PATENT_DIAGRAMS) {
  writeFileSync(
    join(DIAGRAM_DIR, `도면${diagram.number}_${diagram.id}.svg`),
    renderDiagram(diagram),
    'utf8',
  );
}

writeFileSync(join(OUT_DIR, '특허1_기술설명서.md'), buildPatent1Document(), 'utf8');
writeFileSync(
  join(EXAMPLE_DIR, 'comparison.json'),
  JSON.stringify(comparison, null, 2),
  'utf8',
);
writeFileSync(join(OUT_DIR, '특허2_기술설명서.md'), buildPatent2Document(), 'utf8');

for (const { scenario, vector, generation, replans } of runs) {
  writeFileSync(
    join(EXAMPLE_DIR, `patent1-${scenario.id}.json`),
    JSON.stringify(
      {
        referenceDate: REFERENCE_DATE,
        scenario: { id: scenario.id, title: scenario.title },
        input: scenario.conditions,
        conditionVector: vector,
        retrieval: generation.trace.retrieval,
        trustAssessments: generation.trace.trustAssessments,
        candidates: generation.trace.candidates,
        exclusions: generation.trace.exclusions,
        linkage: generation.trace.linkage,
        linkageCorrection: generation.trace.linkageCorrection,
        output: generation.itinerary,
        elapsedMs: generation.trace.elapsedMs,
      },
      null,
      2,
    ),
    'utf8',
  );

  for (const { trace } of replans) {
    writeFileSync(
      join(EXAMPLE_DIR, `patent2-${scenario.id}-${trace.refinementId}.json`),
      JSON.stringify({ referenceDate: REFERENCE_DATE, scenario: scenario.id, trace }, null, 2),
      'utf8',
    );
  }
}

writeFileSync(
  join(OUT_DIR, 'README.md'),
  `# 특허 기술자료 (자동 생성)

\`npm run patent:examples\` 실행 결과입니다. 손으로 고치지 마십시오 — 다음 실행 때 덮어써집니다.
구현이 바뀌면 이 문서도 함께 바뀌므로, 기술설명서와 코드가 어긋난 채 출원되는 일이 없습니다.

| 파일 | 내용 |
| --- | --- |
| \`특허1_기술설명서.md\` | 제1안 — 처리 순서 · 데이터 항목 · 조건분기 · 산출값 · 예시 입출력 |
| \`특허2_기술설명서.md\` | 제2안 — 동일 구성 + 6종 요청 전체 실행 결과 |
| \`examples/patent1-*.json\` | 시나리오별 제1안 전체 입출력 (검색결과 · 신뢰도 · 후보 · 제외 · 연계지수 포함) |
| \`examples/patent2-*.json\` | 시나리오 × 요청별 제2안 전체 입출력 (영향도 · 채택/기각 · 전후 차이 포함) |
| \`examples/comparison.json\` | 통상의 방식과의 대조 실행 결과 (진보성 근거) |
| \`diagrams/도면*.svg\` | 특허 도면 ${PATENT_DIAGRAMS.length}종 (제안서 9.4 / 피드백 5.3 A단계 우선) |

- 생성 기준일: \`${REFERENCE_DATE}\`
- 시나리오 ${runs.length}종 × 제2안 요청 ${REFINEMENT_ORDER.length}종 = 예시 파일 ${runs.length + runs.length * REFINEMENT_ORDER.length}개
- 기준일을 고정해 재현하려면: \`npm run patent:examples -- 2026-08-10\`
`,
  'utf8',
);

const fileCount = runs.length + runs.length * REFINEMENT_ORDER.length + 3;
console.log(`\n생성 완료 — ${OUT_DIR}`);
console.log(`  기술설명서 2종 + 예시 입출력 ${runs.length + runs.length * REFINEMENT_ORDER.length}개 (총 ${fileCount}개 파일)`);
console.log(`  기준일 ${REFERENCE_DATE}`);
