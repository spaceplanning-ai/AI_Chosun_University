/**
 * 기준질문 시험결과서 (제안서 17.1 최종 산출물).
 *
 * 검수 게이트는 화면에서 값을 보여 주지만, 산출물은 **파일로 남는 문서**여야 한다.
 * 검수 회의에서 "그때 몇 %였습니까"를 화면 재실행으로 답할 수는 없기 때문이다.
 *
 * 화면과 같은 `AcceptanceReport` 를 입력으로 받으므로,
 * 문서의 숫자와 화면의 숫자가 갈라질 수 없다.
 */

import { BENCHMARK_CATEGORY_LABELS } from '../../data/benchmarkQuestions';
import { getDocument } from '../../data/officialDocuments';
import { ATTRACTIONS } from '../../data/attractions';
import { OFFICIAL_DOCUMENTS } from '../../data/officialDocuments';
import { toCsv, type CsvColumn } from '../../lib/logging/csv';
import { EVIDENCE_MATCH_RANK, type AcceptanceReport, type BenchmarkResult } from './acceptance';

const RESULT_COLUMNS: CsvColumn<BenchmarkResult>[] = [
  { header: '질문ID', value: (row) => row.question.id },
  { header: '분류', value: (row) => BENCHMARK_CATEGORY_LABELS[row.question.category] },
  { header: '질문', value: (row) => row.question.question },
  { header: '출처제시', value: (row) => (row.hasCitation ? 'Y' : 'N') },
  { header: '근거일치', value: (row) => (row.matchesEvidence ? 'Y' : 'N') },
  {
    header: '정답문서',
    value: (row) =>
      row.question.expectedDocumentIds
        .map((id) => getDocument(id)?.title ?? id)
        .join(' | '),
  },
  {
    header: '회수문서_상위3',
    value: (row) =>
      row.retrieval.documents
        .slice(0, 3)
        .map((document) => `${getDocument(document.documentId)?.title ?? document.documentId}(${document.similarity.toFixed(2)})`)
        .join(' | '),
  },
  { header: '응답시간ms', value: (row) => row.elapsedMs.toFixed(3) },
];

/** 질문별 결과 CSV. 통계 도구로 다시 집계할 수 있게 원자료 형태로 남긴다. */
export function buildAcceptanceCsv(report: AcceptanceReport): string {
  return toCsv(report.results, RESULT_COLUMNS);
}

function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

export interface AcceptanceReportOptions {
  report: AcceptanceReport;
  /** 시험 시각 (ISO). 호출자가 넘겨야 문서가 언제 만들어졌는지 남는다. */
  executedAt: string;
  /** 신뢰도 갱신일 판정 기준일. */
  referenceDate: string;
}

/** 검수 회의에 그대로 제출할 수 있는 시험결과서. */
export function buildAcceptanceMarkdown({
  report,
  executedAt,
  referenceDate,
}: AcceptanceReportOptions): string {
  const failures = report.results.filter(
    (result) => !result.hasCitation || !result.matchesEvidence,
  );

  const byCategory = new Map<string, { total: number; matched: number }>();
  for (const result of report.results) {
    const key = BENCHMARK_CATEGORY_LABELS[result.question.category];
    const entry = byCategory.get(key) ?? { total: 0, matched: 0 };
    entry.total += 1;
    if (result.matchesEvidence) entry.matched += 1;
    byCategory.set(key, entry);
  }

  return `# 기준질문 시험결과서

**AI 남도 프리즘 — 검수 게이트 실측 결과**

> 이 문서는 어드민 「검수 게이트」 화면에서 실제 검색기를 실행해 자동 생성되었습니다.
> 화면에 표시된 값과 동일한 계산에서 나오므로 수치가 서로 어긋나지 않습니다.

| 항목 | 값 |
| --- | --- |
| 시험 일시 | ${executedAt} |
| 신뢰도 기준일 | ${referenceDate} |
| 기준 평가질문 | ${report.totalQuestions}개 |
| 관광지 데이터 | ${ATTRACTIONS.length}곳 |
| 공식문서 색인 | ${OFFICIAL_DOCUMENTS.length}건 |

---

## 1. 종합 판정

**${report.passed ? '충족 — 모든 지표가 목표를 넘었습니다.' : '미달 — 아래 표에서 미달 지표를 확인하십시오.'}**

${table(
  ['지표', '실측', '목표', '판정'],
  report.metrics.map((metric) => [
    metric.label,
    `${metric.value}${metric.unit}`,
    `${metric.target}${metric.unit}`,
    metric.passed ? '충족' : '**미달**',
  ]),
)}

### 판정 기준

- **출처 제시율** = 검색 결과가 1건 이상인 질문 수 ÷ 전체 질문 수
- **답변–근거 일치율** = 정답 문서 중 최소 1건이 검색 상위 ${EVIDENCE_MATCH_RANK}위 안에 회수된 질문 수 ÷ 전체 질문 수
- **응답시간 중앙값** = 질문별 검색 소요시간의 중앙값 (평균이 아니라 중앙값 — 검수기준 문구를 따름)

> 본 시험은 프런트엔드 오프라인 검색기를 대상으로 합니다.
> 백엔드 임베딩 검색이 연결되면 검색기만 교체하고 같은 판정 로직으로 재측정합니다.

## 2. 분류별 근거 일치율

${table(
  ['분류', '질문 수', '일치', '일치율'],
  [...byCategory.entries()].map(([label, entry]) => [
    label,
    entry.total,
    entry.matched,
    `${Math.round((entry.matched / entry.total) * 100)}%`,
  ]),
)}

## 3. 미달 질문

${
  failures.length === 0
    ? '없습니다. 모든 질문에서 출처가 제시되고 정답 문서가 상위권에 회수되었습니다.'
    : table(
        ['질문', '출처 제시', '근거 일치', '회수 1위'],
        failures.map((result) => [
          result.question.question,
          result.hasCitation ? '제시' : '**없음**',
          result.matchesEvidence ? '일치' : '**불일치**',
          getDocument(result.retrieval.documents[0]?.documentId ?? '')?.title ?? '없음',
        ]),
      )
}

## 4. 질문별 상세

${table(
  ['ID', '분류', '질문', '출처', '근거', '응답(ms)'],
  report.results.map((result) => [
    result.question.id,
    BENCHMARK_CATEGORY_LABELS[result.question.category],
    result.question.question,
    result.hasCitation ? '○' : '✕',
    result.matchesEvidence ? '○' : '✕',
    result.elapsedMs.toFixed(2),
  ]),
)}

---

원자료는 함께 내려받은 CSV 파일에 있습니다. 질문별 회수 문서와 검색점수가 모두 담겨 있어
통계 도구에서 다시 집계할 수 있습니다.
`;
}
