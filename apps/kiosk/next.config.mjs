/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * React Compiler.
   *
   * 이 저장소는 이미 컴파일러 규칙을 지킨다 — 린트가 그 규칙으로 검사하고 있고,
   * 어긋나는 코드는 그때그때 고쳐 왔다. 켜 두면 그 대가를 실제로 돌려받는다:
   * 손으로 `useMemo`·`useCallback` 을 붙이지 않아도 필요한 곳만 다시 그린다.
   *
   * Turbopack 이 필요한 변환기를 안고 있어 따로 의존성을 더하지 않는다.
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
  /** 전시장 미니 PC에 통째로 복사해 오프라인 구동하기 위한 산출물 형태. */
  output: 'standalone',
};

export default nextConfig;
