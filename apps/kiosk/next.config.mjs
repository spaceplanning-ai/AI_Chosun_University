import { baseConfig } from '../../next.config.base.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...baseConfig,
  /** 전시장 미니 PC에 통째로 복사해 오프라인 구동하기 위한 산출물 형태. */
  output: 'standalone',
};

export default nextConfig;
