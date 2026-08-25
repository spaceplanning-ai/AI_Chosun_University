/**
 * 세 앱이 함께 쓰는 Next 설정.
 *
 * 키오스크·모바일·어드민은 같은 규칙으로 빌드된다. 그런데 설정을 앱마다 적어 두면
 * 같은 설명이 세 벌로 늘고, 한 곳만 고친 뒤 «왜 저 앱만 다르게 도는지»를 나중에
 * 뒤지게 된다. 공통은 여기 한 벌만 두고, 앱은 자기만 다른 것을 얹는다.
 */

/** @type {import('next').NextConfig} */
export const baseConfig = {
  reactStrictMode: true,

  /**
   * React Compiler.
   *
   * 린트가 이미 컴파일러 규칙으로 검사하고 있으므로, 켜 두면 그 대가를 돌려받는다:
   * 손으로 `useMemo`·`useCallback` 을 붙이지 않아도 필요한 곳만 다시 그린다.
   *
   * 켤 때 zustand store 를 `store` 라는 이름의 변수로 받아 쓰던 곳이 깨졌다.
   * 훅인지 아닌지는 이름으로 판단하므로, `use` 로 시작하지 않으면 컴파일러가
   * 보통 함수로 보고 결과를 외운다. 훅을 변수에 담을 때는 이름을 `use…` 로 둔다.
   */
  reactCompiler: true,

  /**
   * Next 16이 앱 폴더마다 AGENTS.md·CLAUDE.md 를 자동 생성하는 것을 끈다.
   * 납품 저장소에 의도하지 않은 파일이 섞이면 인계 범위가 흐려진다.
   */
  agentRules: false,

  poweredByHeader: false,
  typedRoutes: true,

  /**
   * 공용 코어를 소스 그대로 가져다 컴파일한다.
   * 별도 리포로 분리할 때는 이 이름만 그대로 두고
   * package.json 의 의존성을 git/registry 주소로 바꾸면 된다.
   */
  transpilePackages: ['@namdo-prism/core'],
};
