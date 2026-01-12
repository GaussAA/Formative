'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { History } from 'lucide-react';

export function HeroPage() {
  const router = useRouter();

  const handleStart = useCallback(() => {
    router.push('/app');
  }, [router]);

  const handleHistory = useCallback(() => {
    router.push('/history');
  }, [router]);

  const handleLearnMore = useCallback(() => {
    const firstSection = document.querySelector('.bg-white.rounded-3xl');
    if (firstSection) {
      firstSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-gray-50 to-accent-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                <span className="text-white text-xl font-bold font-display">
                  F
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  定型 Formative
                </h1>
                <p className="text-xs text-gray-500">
                  让想法有形，让 AI 可执行
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleHistory}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-all duration-200 border border-gray-300 flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                历史记录
              </button>
              <button
                onClick={handleStart}
                className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all duration-200"
              >
                立即开始
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16 animate-fadeInUp">
          <div className="inline-block mb-4 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium border border-primary-200">
            VibeCoding 的最前一公里
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight font-display">
            不是 AI 不行，
            <br />
            是需求没<span className="text-primary-500">定型</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            在让 AI 写第一行代码之前，先让你的想法变成可执行的开发方案
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-semibold text-lg hover:shadow-xl hover:shadow-primary-500/25 transition-all duration-200 transform hover:scale-105 hover:-translate-y-1"
            >
              开始定型你的想法 →
            </button>
            <button
              onClick={handleLearnMore}
              className="px-8 py-4 bg-white text-gray-700 rounded-2xl font-semibold text-lg border-2 border-gray-300 hover:border-primary-500 hover:text-primary-500 transition-all duration-200"
            >
              了解更多
            </button>
          </div>
        </div>

        {/* Three-Stage Narrative */}
        <div className="space-y-16 mt-24">
          {/* Stage 1: Problem */}
          <div className="bg-white rounded-3xl p-10 shadow-lg border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-error-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-error-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">❌</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  问题：不是 AI 不行，是人没准备好
                </h2>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
                <p>大多数 VibeCoding 失败，并不是因为 AI 不会写代码。</p>
                <p className="font-semibold text-gray-900">
                  而是因为一开始，用户根本说不清楚自己想要什么。
                </p>

                <div className="bg-error-50 rounded-xl p-6 my-6">
                  <p className="text-gray-600 mb-3">
                    他们往往只有一句话的想法：
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center">
                      <span className="text-error-500 mr-2">•</span>
                      &quot;我想做一个 App&quot;
                    </li>
                    <li className="flex items-center">
                      <span className="text-error-500 mr-2">•</span>
                      &quot;我想搞个 AI 工具&quot;
                    </li>
                    <li className="flex items-center">
                      <span className="text-error-500 mr-2">•</span>
                      &quot;能不能帮我写个网站&quot;
                    </li>
                  </ul>
                </div>

                <p>
                  于是 AI 开始猜，用户开始改；
                  <br />
                  AI 不断生成，用户不断推翻。
                </p>

                <div className="bg-gray-900 text-gray-100 rounded-xl p-6 my-6">
                  <p className="font-semibold mb-3">最后的结果通常只有三种：</p>
                  <ul className="space-y-2">
                    <li>→ 项目越写越乱</li>
                    <li>→ 出了错也看不懂</li>
                    <li>→ 只能不停地说一句话：&quot;不对，改一下&quot;</li>
                  </ul>
                </div>

                <p className="text-xl font-bold text-error-600">
                  问题不在代码，而在&quot;需求没有定型&quot;。
                </p>
              </div>
            </div>
          </div>

          {/* Stage 2: Solution */}
          <div className="bg-white rounded-3xl p-10 shadow-lg border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">💡</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  转折：定型，发生在写代码之前
                </h2>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
                <p className="text-xl font-semibold text-gray-900">
                  定型（Formative）不是一个写代码的工具。
                </p>
                <p>
                  它存在于 VibeCoding 的
                  <span className="font-semibold text-primary-500">
                    最前一公里
                  </span>
                  。
                </p>

                <div className="bg-primary-50 rounded-xl p-6 my-6">
                  <p className="font-semibold text-gray-900 mb-4">
                    在你让 AI 开始写第一行代码之前，定型会做三件关键的事：
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="w-8 h-8 bg-primary-500 text-white rounded-lg flex items-center justify-center shrink-0 mr-3 font-bold">
                        1
                      </div>
                      <p>
                        把一句白话需求，拆解成完整的工程问题
                      </p>
                    </div>
                    <div className="flex items-start">
                      <div className="w-8 h-8 bg-primary-500 text-white rounded-lg flex items-center justify-center shrink-0 mr-3 font-bold">
                        2
                      </div>
                      <p>暴露潜在风险，并给出可选方案</p>
                    </div>
                    <div className="flex items-start">
                      <div className="w-8 h-8 bg-primary-500 text-white rounded-lg flex items-center justify-center shrink-0 mr-3 font-bold">
                        3
                      </div>
                      <p>
                        帮你做出适合你的技术决策，而不是&quot;看起来最酷的那种&quot;
                      </p>
                    </div>
                  </div>
                </div>

                <p>
                  你不需要懂架构、不需要会数据库，
                  <br />
                  你只需要<span className="font-semibold text-primary-500">
                    回答问题、做选择
                  </span>
                  。
                </p>

                <p className="text-xl font-bold text-primary-500">
                  剩下的复杂度，由定型替你承担。
                </p>
              </div>
            </div>
          </div>

          {/* Stage 3: Result */}
          <div className="bg-white rounded-3xl p-10 shadow-lg border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-success-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-success-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  结果：你第一次拥有&quot;AI 能真正执行的方案&quot;
                </h2>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
                <p>当你完成定型流程，你最终拿到的不是聊天记录，而是：</p>

                <div className="grid grid-cols-2 gap-4 my-6">
                  <div className="bg-success-50 rounded-xl p-5 border border-success-200">
                    <div className="font-semibold text-gray-900 mb-2">
                      📋 明确边界的 MVP 定义
                    </div>
                    <p className="text-sm text-gray-600">
                      核心功能 vs 后续版本
                    </p>
                  </div>
                  <div className="bg-success-50 rounded-xl p-5 border border-success-200">
                    <div className="font-semibold text-gray-900 mb-2">
                      🔧 已确定技术栈的开发方案
                    </div>
                    <p className="text-sm text-gray-600">
                      前端、后端、数据库、部署
                    </p>
                  </div>
                  <div className="bg-success-50 rounded-xl p-5 border border-success-200">
                    <div className="font-semibold text-gray-900 mb-2">
                      📊 必要的技术说明
                    </div>
                    <p className="text-sm text-gray-600">
                      数据库 / API / 部署配置
                    </p>
                  </div>
                  <div className="bg-success-50 rounded-xl p-5 border border-success-200">
                    <div className="font-semibold text-gray-900 mb-2">
                      📄 完整的开发文档
                    </div>
                    <p className="text-sm text-gray-600">
                      可以直接交给 AI 执行
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-success-50 to-primary-50 rounded-xl p-6 my-6">
                  <p className="font-semibold text-gray-900 mb-3">这意味着：</p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center">
                      <span className="text-success-600 mr-2 font-bold">✓</span>
                      AI 不再自由发挥
                    </li>
                    <li className="flex items-center">
                      <span className="text-success-600 mr-2 font-bold">✓</span>
                      你不再反复推倒重来
                    </li>
                    <li className="flex items-center">
                      <span className="text-success-600 mr-2 font-bold">✓</span>
                      VibeCoding 变成一个可控、可推进的过程
                    </li>
                  </ul>
                </div>

                <p className="text-xl font-bold text-gray-900">
                  你负责想清楚，
                  <br />
                  定型负责让
                  <span className="text-primary-500">&quot;想清楚&quot;</span>
                  这件事真正落地。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center bg-gradient-to-r from-primary-500 to-primary-600 rounded-3xl p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">
            准备好让你的想法定型了吗？
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            5分钟，从一句话到完整方案
          </p>
          <button
            onClick={handleStart}
            className="px-10 py-5 bg-white text-primary-500 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-primary-500/25 transition-all duration-200 transform hover:scale-105 hover:-translate-y-1"
          >
            开始你的第一个项目 →
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm">
            © 2025 定型 Formative. Powered by Jaguarliu&Trae
          </p>
          <p className="text-xs mt-2">
            让想法有形，让 AI 可执行
          </p>
        </div>
      </footer>
    </div>
  );
}
