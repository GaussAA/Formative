'use client';

import React from 'react';
import { TabStatus } from '@/types';
import { useStage } from '@/contexts/StageContext';

export function TabNavigation() {
  const { tabs, currentStage, goToStage } = useStage();

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-1">
            {tabs.map((tab, index) => {
              const isActive = tab.stage === currentStage;
              const isCompleted = tab.status === TabStatus.COMPLETED;
              const isLocked = tab.status === TabStatus.LOCKED;
              const isClickable = isCompleted || isActive;

              return (
                <React.Fragment key={tab.id}>
                  <button
                    onClick={() => isClickable && goToStage(tab.stage)}
                    disabled={isLocked}
                    className={`
                      relative px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300
                      ${isActive ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105' : ''}
                      ${isCompleted ? 'bg-green-50 text-green-700 hover:bg-green-100 hover:scale-105' : ''}
                      ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-80' : ''}
                      ${isClickable && !isActive ? 'hover:bg-gray-50 cursor-pointer' : ''}
                    `}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-base">{tab.icon}</span>
                      <span>{tab.name}</span>
                      {isCompleted && <span className="text-green-600 font-bold text-lg">✓</span>}
                    </div>
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                        <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-md"></div>
                      </div>
                    )}
                  </button>

                  {index < tabs.length - 1 && (
                    <div className="px-2">
                      <svg
                        className={`w-4 h-4 transition-colors duration-300 ${
                          isCompleted ? 'text-green-400' : 'text-gray-300'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
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
        </nav>
      </div>
    </div>
  );
}
