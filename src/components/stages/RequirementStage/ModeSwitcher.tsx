/**
 * 模式切换器组件
 * 用于在对话模式和表单模式之间切换
 */

import React from 'react';
import type { ModeSwitcherProps } from './types';

export function ModeSwitcher({ mode, setMode, title }: ModeSwitcherProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'chat'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            对话模式
          </button>
          <button
            onClick={() => setMode('form')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'form'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            表单模式
          </button>
        </div>
      </div>
    </div>
  );
}
