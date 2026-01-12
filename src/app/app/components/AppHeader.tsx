'use client';

import { useRouter } from 'next/navigation';
import { History, XCircle } from 'lucide-react';

interface AppHeaderProps {
  onAbandon: () => void;
}

/**
 * Application header with glassmorphism effect
 * Contains logo, title, and action buttons
 */
export function AppHeader({ onAbandon }: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-xl group-hover:shadow-primary-500/30 group-hover:scale-105 transition-all duration-300 ease-out">
              <span className="text-white text-xl font-bold font-display">
                F
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                定型 Formative
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI驱动的产品开发方案生成器
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/history')}
              className="hidden sm:flex px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-all duration-200 items-center gap-2 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="查看历史记录"
            >
              <History className="w-4 h-4" />
              历史记录
            </button>
            {/* Mobile: Icon-only button */}
            <button
              onClick={() => router.push('/history')}
              className="sm:hidden p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-all duration-200"
              aria-label="查看历史记录"
            >
              <History className="w-5 h-5" />
            </button>

            <button
              onClick={onAbandon}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-error-600 dark:text-error-400 hover:text-error-700 dark:hover:text-error-300 hover:bg-error-50/50 dark:hover:bg-error-900/20 rounded-xl transition-all duration-200 flex items-center gap-2 focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
              aria-label="放弃当前任务"
            >
              <XCircle className="w-4 h-4" />
              <span className="hidden sm:inline">放弃任务</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
