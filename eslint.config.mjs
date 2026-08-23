import next from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * eslint-config-next 16은 flat config 를 직접 내보낸다.
 * FlatCompat 래퍼를 거치면 플러그인 객체의 순환 참조 때문에 설정 검증 단계에서 터진다.
 */
const config = [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      '**/*.tsbuildinfo',
      // 라이브러리에서 그대로 복사해 온 지도 일꾼. 우리가 쓴 코드가 아니다.
      '**/public/maplibre/**',
      // 스크립트가 만들어 내는 컴파일 산출물과 자동 생성 문서.
      '**/.build-scripts/**',
      '**/.build-tests/**',
      'docs/patent-examples/**',
      'packages/core/data-csv/**',
      // 전시장 배포 꾸러미. Next 가 생성한 서버 코드가 들어 있다.
      'dist/**',
    ],
  },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // 빌드·인계용 Node 스크립트. 컴파일된 CommonJS 산출물을 불러와야 하므로
    // createRequire 사용은 의도된 것이다.
    files: ['packages/core/scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default config;
