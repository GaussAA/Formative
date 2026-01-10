'use client';

import React, { useEffect, useState } from 'react';

interface SkeletonLoaderProps {
  stage: 'risk' | 'tech' | 'mvp' | 'diagram' | 'document';
}

const stageMessages = {
  risk: [
    '正在分析潜在风险...',
    '评估技术可行性...',
    '构思应对方案...',
  ],
  tech: [
    '正在分析技术需求...',
    '匹配合适的技术栈...',
    '评估技术成本...',
  ],
  mvp: [
    '正在规划MVP功能...',
    '划分开发阶段...',
    '评估开发复杂度...',
  ],
  diagram: [
    '正在生成系统架构图...',
    '正在设计流程时序图...',
    '正在优化图表布局...',
  ],
  document: [
    '正在生成文档...',
    '整理需求信息...',
    '编写开发方案...',
  ],
};

export function SkeletonLoader({ stage }: SkeletonLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = stageMessages[stage];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex items-center justify-center min-h-[500px] relative overflow-hidden">
      {/* Gradient Glow Background */}
      <div className="absolute inset-0 bg-linear-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 animate-gradient-shift"></div>

      <div className="relative z-10 w-full max-w-4xl px-6">
        {/* Skeleton Cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 relative overflow-hidden"
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/60 to-transparent"></div>

              {/* Skeleton Content */}
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 rounded-lg w-1/4 animate-pulse"></div>
                <div className="h-3 bg-slate-200 rounded-lg w-full animate-pulse" style={{ animationDelay: '100ms' }}></div>
                <div className="h-3 bg-slate-200 rounded-lg w-5/6 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                <div className="h-3 bg-slate-200 rounded-lg w-4/6 animate-pulse" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Status Text */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-200">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-sm font-medium text-gray-700 transition-all duration-500">
              {messages[messageIndex]}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }

        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 6s ease infinite;
        }
      `}</style>
    </div>
  );
}
