import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 性能优化
  compress: true,
  poweredByHeader: false,

  // 包优化 - 按需导入大型库
  experimental: {
    optimizePackageImports: ['mermaid', 'zod', '@langchain/core', '@langchain/community'],
  },

  // 安全头配置
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // 图片优化配置
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Turbopack 配置 (Next.js 16+)
  turbopack: {
    // 空配置表示使用默认的 Turbopack 行为
    // 如需自定义，可以在这里添加规则
  },

  // Webpack 配置优化 (仅在使用 webpack 时生效)
  webpack: (config, { dev, isServer }) => {
    // 生产环境优化
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
