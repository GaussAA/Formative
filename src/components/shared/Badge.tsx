import React from 'react';
import { RiskSeverity } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  severity?: RiskSeverity;
  className?: string;
}

export function Badge({ children, variant = 'default', severity, className = '' }: BadgeProps) {
  // 如果提供了severity，优先使用severity的颜色
  let colorClass = '';

  if (severity) {
    switch (severity) {
      case RiskSeverity.LOW:
        colorClass = 'bg-green-100 text-green-800 border-green-200';
        break;
      case RiskSeverity.MEDIUM:
        colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
        break;
      case RiskSeverity.HIGH:
        colorClass = 'bg-red-100 text-red-800 border-red-200';
        break;
    }
  } else {
    switch (variant) {
      case 'success':
        colorClass = 'bg-green-100 text-green-800 border-green-200';
        break;
      case 'warning':
        colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
        break;
      case 'danger':
        colorClass = 'bg-red-100 text-red-800 border-red-200';
        break;
      case 'info':
        colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
        break;
      default:
        colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colorClass} ${className}`}>
      {children}
    </span>
  );
}
