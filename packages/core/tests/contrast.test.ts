/**
 * 색 대비 회귀 검증.
 *
 * 팔레트는 "예뻐 보이는지"로 조정하기 쉽고, 그 과정에서 대비가 조용히 무너진다.
 * 접근성이 A안 포함의 근거였으므로(피드백 3.2), 눈이 아니라 수치가 지키게 한다.
 *
 * 색 공간 변환 자체도 함께 검증한다. 변환이 틀리면 대비율은 그럴듯한 숫자로 나오면서
 * 실제와 무관해지므로, 알려진 값으로 먼저 계산을 검증한 뒤 팔레트를 검사한다.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  auditContrast,
  colorDistance,
  contrastRatio,
  DISTINCT_COLOR_PAIRS,
  MINIMUM_COLOR_DISTANCE,
  mixOklab,
  parseTokenBlocks,
  resolveColor,
  resolveTokenTable,
  type ThemeContext,
} from '../src/design/contrast';

// 테스트는 CommonJS 로 컴파일되어 `.build-tests/tests/` 에서 실행되므로,
// 패키지 루트를 거쳐 실제 스타일 파일을 찾는다.
const STYLES_DIR = join(__dirname, '..', '..', 'src', 'styles');
const CSS_TEXTS = ['tokens.primitive.css', 'tokens.semantic.css'].map((file) =>
  readFileSync(join(STYLES_DIR, file), 'utf8'),
);

const CONTEXTS: { context: ThemeContext; label: string }[] = [
  { context: { theme: 'light', contrast: 'normal' }, label: '밝은 배경 · 일반' },
  { context: { theme: 'light', contrast: 'high' }, label: '밝은 배경 · 고대비' },
  { context: { theme: 'exhibition', contrast: 'normal' }, label: '전시 배경 · 일반' },
  { context: { theme: 'exhibition', contrast: 'high' }, label: '전시 배경 · 고대비' },
];

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

describe('색 계산 정확도', () => {
  it('흑백 대비율은 21:1 이다', () => {
    assert.ok(Math.abs(contrastRatio(BLACK, WHITE) - 21) < 0.01);
  });

  it('같은 색끼리는 1:1 이다', () => {
    assert.ok(Math.abs(contrastRatio(WHITE, WHITE) - 1) < 1e-9);
  });

  it('WCAG 기준색의 대비율이 알려진 값과 일치한다', () => {
    // #767676 은 흰 배경에서 정확히 AA 경계(4.54:1)로 알려진 회색이다.
    const gray = resolveColor('#767676', new Map());
    assert.ok(gray);
    assert.ok(Math.abs(contrastRatio(gray, WHITE) - 4.54) < 0.05);
  });

  it('oklab 혼합의 양 끝값이 원본 색과 같다', () => {
    assert.deepEqual(mixOklab(WHITE, BLACK, 1).r > 0.99, true);
    assert.deepEqual(mixOklab(WHITE, BLACK, 0).r < 0.01, true);
  });

  it('반투명 색은 배경 위에 합성한 뒤 계산한다', () => {
    const halfBlack = { r: 0, g: 0, b: 0, a: 0.5 };
    // 합성하지 않으면 21:1 이 나오지만, 실제로는 회색이 되어 훨씬 낮다.
    assert.ok(contrastRatio(halfBlack, WHITE) < 6);
  });
});

describe('토큰 파싱', () => {
  it('주석 안의 콜론을 선언 구분자로 오인하지 않는다', () => {
    // 이 오인이 실제로 있었고, 결과가 "대비율 0"으로 나타나 팔레트 문제처럼 보였다.
    const blocks = parseTokenBlocks(`
      :root {
        /* 색상: 남색 계열 */
        --np-navy-950: #050b16;
      }
    `);
    assert.equal(blocks[0]?.tokens.get('--np-navy-950'), '#050b16');
  });

  it('var() 참조를 끝까지 따라간다', () => {
    const tokens = new Map([
      ['--a', 'var(--b)'],
      ['--b', '#ff0000'],
    ]);
    assert.deepEqual(resolveColor('var(--a)', tokens), { r: 1, g: 0, b: 0, a: 1 });
  });

  it('순환 참조가 있어도 멈춘다', () => {
    const tokens = new Map([
      ['--a', 'var(--b)'],
      ['--b', 'var(--a)'],
    ]);
    assert.equal(resolveColor('var(--a)', tokens), undefined);
  });

  it('color-mix(in oklab) 을 해석한다', () => {
    const tokens = new Map([['--base', '#000000']]);
    const mixed = resolveColor('color-mix(in oklab, #ffffff 50%, var(--base))', tokens);
    assert.ok(mixed);
    // 완전한 흰색도 검정도 아닌 중간값이어야 한다.
    assert.ok(mixed.r > 0.2 && mixed.r < 0.9, `r=${mixed.r}`);
  });

  it('테마별로 서로 다른 토큰 값이 적용된다', () => {
    const light = resolveTokenTable(CSS_TEXTS, { theme: 'light', contrast: 'normal' });
    const exhibition = resolveTokenTable(CSS_TEXTS, { theme: 'exhibition', contrast: 'normal' });
    assert.notEqual(light.get('--surface-page'), exhibition.get('--surface-page'));
  });
});

describe('WCAG AA 대비 준수', () => {
  for (const { context, label } of CONTEXTS) {
    it(`${label} — 모든 글자·배경 조합이 목표 대비를 넘는다`, () => {
      const tokens = resolveTokenTable(CSS_TEXTS, context);
      const results = auditContrast(tokens);

      // 색이 해석되지 않으면 ratio 0 으로 나오므로, 파싱 실패도 여기서 함께 잡힌다.
      const failures = results.filter((result) => !result.passes);
      assert.deepEqual(
        failures.map((failure) => `${failure.label} ${failure.ratio}:1 (기준 ${failure.minimum}:1)`),
        [],
      );
      assert.ok(results.length >= 20, `검사 대상이 ${results.length}건뿐`);
    });
  }

  it('고대비 모드는 일반 모드보다 대비가 낮지 않다', () => {
    for (const theme of ['light', 'exhibition'] as const) {
      const normal = auditContrast(resolveTokenTable(CSS_TEXTS, { theme, contrast: 'normal' }));
      const high = auditContrast(resolveTokenTable(CSS_TEXTS, { theme, contrast: 'high' }));

      for (const [index, result] of normal.entries()) {
        const highResult = high[index];
        assert.ok(highResult);
        assert.ok(
          highResult.ratio >= result.ratio - 0.01,
          `${theme}/${result.label}: 고대비 ${highResult.ratio} < 일반 ${result.ratio}`,
        );
      }
    }
  });
});

describe('색만으로 구분되는 자리', () => {
  for (const { context, label } of CONTEXTS) {
    it(`${label} — 지역 구분색이 서로 충분히 떨어져 있다`, () => {
      const tokens = resolveTokenTable(CSS_TEXTS, context);

      for (const pair of DISTINCT_COLOR_PAIRS) {
        const first = resolveColor(`var(${pair.tokens[0]})`, tokens);
        const second = resolveColor(`var(${pair.tokens[1]})`, tokens);
        assert.ok(first && second, `${pair.label}: 색을 해석하지 못했습니다`);

        const distance = colorDistance(first, second);
        assert.ok(
          distance >= pair.minimum,
          `${pair.label}: ΔE ${distance.toFixed(1)} (기준 ${pair.minimum}) — ${pair.rationale}`,
        );
      }
    });
  }

  it('밝기만 비슷해도 색상이 다르면 거리가 확보된다는 사실을 확인한다', () => {
    // 대비율로는 잡히지 않는 사례. 이 테스트가 지키려는 것이 바로 이 상황이다.
    const teal = resolveColor('#075e68', new Map());
    const green = resolveColor('#14624a', new Map());
    assert.ok(teal && green);

    assert.ok(Math.abs(contrastRatio(teal, green) - 1) < 0.3, '대비율로는 거의 같아 보인다');
    assert.ok(colorDistance(teal, green) < MINIMUM_COLOR_DISTANCE, '거리로는 걸러진다');
  });
});
