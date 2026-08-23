/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
