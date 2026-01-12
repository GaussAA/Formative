'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { TabStatus } from '@/types';
import { useStage } from '@/contexts/StageContext';
import { StageIcons } from '@/config/icons';
import { cn } from '@/lib/utils';

/**
 * Modern tab navigation with glassmorphism effect
 * Features:
 * - Mobile-first horizontal scrolling
 * - Glassmorphism backdrop blur
 * - Segmented control (pill) design
 * - Full dark mode support
 * - Accessibility with ARIA labels
 * - Seamless design without borders
 */
export function TabNavigation() {
  const { tabs, currentStage, goToStage } = useStage();

  return (
    <nav
      role="navigation"
      aria-label="阶段导航"
      className="sticky top-16 z-40 bg-white dark:bg-gray-900 transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: horizontal scroll container, Desktop: centered flex */}
        <div
          role="tablist"
          aria-label="产品开发阶段"
          className="flex items-center gap-2 sm:gap-3 py-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide"
        >
          {tabs.map((tab, index) => {
            const isActive = tab.stage === currentStage;
            const isCompleted = tab.status === TabStatus.COMPLETED;
            const isLocked = tab.status === TabStatus.LOCKED;
            const isClickable = isCompleted || isActive;
            const IconComponent = StageIcons[tab.stage];

            return (
              <React.Fragment key={tab.id}>
                <button
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${tab.name} ${isCompleted ? '已完成' : isLocked ? '未解锁' : '进行中'}`}
                  aria-disabled={isLocked}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => isClickable && goToStage(tab.stage)}
                  disabled={isLocked}
                  className={cn(
                    // Base styles
                    'relative group flex items-center gap-2 px-4 py-2.5 rounded-full',
                    'font-medium text-sm whitespace-nowrap',
                    'transition-all duration-300 ease-out',
                    'focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900',

                    // Active state
                    isActive &&
                      'bg-primary-500 text-white shadow-lg shadow-primary-500/25 scale-105',

                    // Completed state
                    isCompleted &&
                      'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 hover:scale-105 hover:shadow-md',

                    // Locked state - improved contrast
                    isLocked &&
                      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed',

                    // Clickable but not active
                    isClickable && !isActive && 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                  )}
                >
                  {/* Icon */}
                  {IconComponent && (
                    <IconComponent
                      className={cn(
                        'w-4 h-4 transition-colors duration-200',
                        isActive && 'text-white',
                        isCompleted && 'text-success-700 dark:text-success-400',
                        !isActive && !isCompleted && 'text-gray-600 dark:text-gray-500'
                      )}
                    />
                  )}

                  {/* Label */}
                  <span className="hidden sm:inline">{tab.name}</span>

                  {/* Completion Checkmark */}
                  {isCompleted && (
                    <Check className="w-4 h-4 text-success-600 dark:text-success-400" />
                  )}

                  {/* Active indicator (bottom dot) */}
                  {isActive && (
                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                      <div className="w-1 h-1 bg-primary-500 rounded-full shadow-md animate-pulse-subtle" />
                    </div>
                  )}
                </button>

                {/* Separator Arrow */}
                {index < tabs.length - 1 && (
                  <div className="px-1 sm:px-2 flex-shrink-0">
                    <svg
                      className={cn(
                        'w-4 h-4 transition-colors duration-300 flex-shrink-0',
                        isCompleted ? 'text-success-500' : 'text-gray-400 dark:text-gray-600'
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
