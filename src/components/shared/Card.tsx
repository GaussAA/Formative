import React from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'elevated' | 'glass';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  variant?: CardVariant;
}

/**
 * Modern card component with multiple visual variants
 * Seamless design without hard borders
 *
 * @variants
 * - default: Clean white card with subtle shadow
 * - elevated: Card with enhanced shadow
 * - glass: Glassmorphism effect with backdrop blur
 */
export function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  variant = 'default',
}: CardProps) {
  const variantStyles = {
    default:
      'bg-white dark:bg-gray-800 shadow-sm',
    elevated:
      'bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50',
    glass:
      'bg-white dark:bg-gray-800 shadow-lg',
  };

  const hoverStyles = hoverable
    ? 'cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 ease-out'
    : '';

  return (
    <div
      className={cn(
        // Base styles
        'rounded-2xl p-5',
        // Variant styles
        variantStyles[variant],
        // Hover styles
        hoverStyles,
        // Custom styles
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={cn('mb-3', className)}>{children}</div>;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 dark:text-gray-100', className)}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={cn('text-gray-700 dark:text-gray-300', className)}>{children}</div>
  );
}
