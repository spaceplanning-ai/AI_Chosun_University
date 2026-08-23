import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { retrieveForQuestion } from '../src/domain/linkage-recommendation/retrieval';
import { BENCHMARK_QUESTIONS } from '../src/data/benchmarkQuestions';

/**
 * 검색 판정 기준이 실제로 검색을 바꾸는가.
 *
 * 어드민의 「검색 설정」은 값을 저장만 하고 아무것도 안 바꾸면 소용이 없다.
 * 최소 유사도와 회수 개수가 결과에 그대로 먹히는지 확인한다.
 */

const question = BENCHMARK_QUESTIONS[0]?.question ?? '';

describe('검색 판정 기준', () => {
  it('회수 개수만큼만 돌려준다', () => {
    const three = retrieveForQuestion(question, undefined, { limit: 3 });
    assert.ok(three.documents.length <= 3);

    const one = retrieveForQuestion(question, undefined, { limit: 1 });
    assert.ok(one.documents.length <= 1);
  });

  it('최소 유사도 아래는 걸러 낸다', () => {
    const all = retrieveForQuestion(question, undefined, { limit: 50 });
    assert.ok(all.documents.length > 0, '기준 질문이 아무것도 못 찾으면 이 검사가 무의미하다');

    const floor = 0.9;
    const strict = retrieveForQuestion(question, undefined, { limit: 50, minSimilarity: floor });
    for (const document of strict.documents) {
      assert.ok(document.similarity >= floor, `${document.documentId}: ${document.similarity}`);
    }
    assert.ok(strict.documents.length <= all.documents.length);
  });

  it('기준을 안 주면 예전처럼 돈다', () => {
    // 키오스크·모바일은 설정을 넘기지 않는다. 그쪽 동작이 달라지면 안 된다.
    const plain = retrieveForQuestion(question);
    const zero = retrieveForQuestion(question, undefined, { minSimilarity: 0 });
    assert.equal(plain.documents.length, zero.documents.length);
  });
});
