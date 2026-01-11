/**
 * 信息字段组件
 * 用于显示单个收集到的信息字段
 */

'use client';

import React from 'react';

interface InfoFieldProps {
  label: string;
  value: string;
  highlight?: boolean;
  multiline?: boolean;
  renderValue?: (value: string) => React.ReactNode;
}

export function InfoField({ label, value, highlight = false, multiline = false, renderValue }: InfoFieldProps) {
  const highlightClass = highlight
    ? 'border-primary shadow-lg shadow-primary/20 animate-highlight-glow'
    : '';

  return (
    <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${highlightClass}`}>
      <div className="flex items-center mb-2">
        <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</div>
      </div>
      <div className={`text-sm text-gray-900 ${multiline ? 'leading-relaxed' : ''} pl-3.5`}>
        {renderValue ? renderValue(value) : value}
      </div>
    </div>
  );
}

interface InfoListFieldProps {
  label: string;
  items: string[];
  highlight?: boolean;
}

export function InfoListField({ label, items, highlight = false }: InfoListFieldProps) {
  const highlightClass = highlight
    ? 'border-primary shadow-lg shadow-primary/20 animate-highlight-glow'
    : '';

  return (
    <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${highlightClass}`}>
      <div className="flex items-center mb-2">
        <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</div>
      </div>
      <ul className="space-y-2 pl-3.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-900 flex items-start">
            <span className="text-primary mr-2 mt-0.5 font-bold">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 内联样式（避免全局样式污染）
export function HighlightStyles() {
  return (
    <style jsx>{`
      @keyframes highlight-glow {
        0% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4),
                      0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        50% {
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2),
                      0 10px 15px -3px rgba(59, 130, 246, 0.2);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0),
                      0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      }

      .animate-highlight-glow {
        animation: highlight-glow 2s ease-out forwards;
      }
    `}</style>
  );
}
