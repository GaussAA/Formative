import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 性能优化
  compress: true,
  poweredByHeader: false,

  // React Compiler - 自动优化组件重渲染（React 19+）
  // babel-plugin-react-compiler 已安装
  reactCompiler: true,

  // Partial Prerendering (PPR) - 静态内容预渲染，减少 TTFB
  // Next.js 16+: cacheComponents 从 experimental 移至根级别
  cacheComponents: true,

  // 包优化 - 按需导入大型库
  experimental: {
    optimizePackageImports: ['mermaid', 'zod', '@langchain/core', '@langchain/community'],
  },

  // 安全头配置 (P0 优化)
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          // Clickjacking protection
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // MIME type sniffing protection
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // XSS protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // HTTPS enforcement (production only)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' data: https: blob:;",
              "font-src 'self' data:;",
              "connect-src 'self' https://api.deepseek.com https://dashscope.aliyuncs.com http://localhost:11434;",
              "media-src 'self' blob:;",
              "object-src 'none';",
              "base-uri 'self';",
              "form-action 'self';",
              "frame-ancestors 'none';",
              "upgrade-insecure-requests;",
            ].join(' '),
          },
          // Permissions Policy
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
          },
        ],
      },
      // API routes - additional security
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
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
