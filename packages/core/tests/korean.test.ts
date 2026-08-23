import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { endsWithFinalConsonant, withParticle } from '../src/lib/korean';

/**
 * 조사 고르기.
 *
 * 화면 문구가 「을(를)」 로 도망치지 않으려면 이 함수가 정확해야 한다.
 * 실제 관광지 이름을 표본으로 쓴다 — 자료에 있는 이름에서 틀리면 화면에서 틀린다.
 */

describe('받침 판별', () => {
  it('받침 있는 이름을 가려낸다', () => {
    for (const name of ['죽녹원', '국립광주박물관', '담양 관방제림', '무등산']) {
      assert.equal(endsWithFinalConsonant(name), true, name);
    }
  });

  it('받침 없는 이름을 가려낸다', () => {
    for (const name of ['무등산국립공원 증심사지구', '목포해상케이블카', '나주 영산포 홍어거리']) {
      assert.equal(endsWithFinalConsonant(name), false, name);
    }
  });

  it('숫자는 읽는 소리로 판단한다', () => {
    // 1913 → 「천구백십삼」 이라 받침이 있다. 2 → 「이」 라 없다.
    assert.equal(endsWithFinalConsonant('1913'), true);
    assert.equal(endsWithFinalConsonant('2'), false);
  });

  it('빈 문자열이나 한글 아닌 끝은 받침 있는 쪽으로 본다', () => {
    assert.equal(endsWithFinalConsonant(''), true);
    assert.equal(endsWithFinalConsonant('ACC'), true);
  });
});

describe('조사 붙이기', () => {
  it('목적격을 받침에 맞춰 고른다', () => {
    assert.equal(withParticle('죽녹원', '목적격'), '죽녹원을');
    assert.equal(withParticle('메타세쿼이아', '목적격'), '메타세쿼이아를');
  });

  it('주격·보조사·공동격·방향격도 함께 갈린다', () => {
    assert.equal(withParticle('죽녹원', '주격'), '죽녹원이');
    assert.equal(withParticle('메타세쿼이아', '주격'), '메타세쿼이아가');
    assert.equal(withParticle('죽녹원', '보조사'), '죽녹원은');
    assert.equal(withParticle('메타세쿼이아', '보조사'), '메타세쿼이아는');
    assert.equal(withParticle('죽녹원', '공동격'), '죽녹원과');
    assert.equal(withParticle('메타세쿼이아', '공동격'), '메타세쿼이아와');
    assert.equal(withParticle('죽녹원', '방향격'), '죽녹원으로');
    assert.equal(withParticle('메타세쿼이아', '방향격'), '메타세쿼이아로');
  });

  it('방향격은 ㄹ 받침을 예외로 둔다', () => {
    // 「서울으로」가 아니라 「서울로」. 목적격은 그대로 「서울을」이다.
    assert.equal(withParticle('서울', '방향격'), '서울로');
    assert.equal(withParticle('서울', '목적격'), '서울을');
    assert.equal(withParticle('가로수길', '방향격'), '가로수길로');
  });
});
