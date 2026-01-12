import React from 'react';
import { RiskSeverity } from '@/types';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  severity?: RiskSeverity;
  className?: string;
}

/**
 * Badge component with refined color system and dark mode support
 */
export function Badge({ children, variant = 'default', severity, className = '' }: BadgeProps) {
  let colorClass = '';

  if (severity) {
    colorClass = {
      [RiskSeverity.LOW]:
        'bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800',
      [RiskSeverity.MEDIUM]:
        'bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-800',
      [RiskSeverity.HIGH]:
        'bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-300 border-error-200 dark:border-error-800',
    }[severity];
  } else {
    colorClass = {
      success:
        'bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800',
      warning:
        'bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-800',
      danger:
        'bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-300 border-error-200 dark:border-error-800',
      info: 'bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-300 border-info-200 dark:border-info-800',
      default:
        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    }[variant];
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all duration-200',
        colorClass,
        className
      )}
    >
      {children}
    </span>
  );
}
