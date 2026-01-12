'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SkeletonLoaderProps {
  stage: 'risk' | 'tech' | 'mvp' | 'diagram' | 'document';
}

const stageMessages = {
  risk: ['正在分析潜在风险...', '评估技术可行性...', '构思应对方案...'],
  tech: ['正在分析技术需求...', '匹配合适的技术栈...', '评估技术成本...'],
  mvp: ['正在规划MVP功能...', '划分开发阶段...', '评估开发复杂度...'],
  diagram: ['正在生成系统架构图...', '正在设计流程时序图...', '正在优化图表布局...'],
  document: ['正在生成文档...', '整理需求信息...', '编写开发方案...'],
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
    <div className="flex items-center justify-center min-h-[500px] relative overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Gradient Glow Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-purple-50/20 to-accent-50/30 dark:from-primary-900/20 dark:via-purple-900/10 dark:to-accent-900/10 animate-pulse-subtle" />

      <div className="relative z-10 w-full max-w-4xl px-6">
        {/* Skeleton Cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/30 border border-gray-100 dark:border-gray-700 relative overflow-hidden"
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />

              {/* Skeleton Content */}
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4 animate-pulse" />
                <div
                  className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-full animate-pulse"
                  style={{ animationDelay: '100ms' }}
                />
                <div
                  className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6 animate-pulse"
                  style={{ animationDelay: '200ms' }}
                />
                <div
                  className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-4/6 animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Status Text */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full shadow-lg border border-gray-200/50 dark:border-gray-700/50">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-all duration-500">
              {messages[messageIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
