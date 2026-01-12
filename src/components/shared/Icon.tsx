import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconProps {
  icon: LucideIcon;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Icon component wrapper for Lucide React icons
 * Provides consistent sizing and styling
 */
export function Icon({
  icon: IconComponent,
  className = '',
  size = 'md',
}: IconProps) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  }[size];

  return <IconComponent className={cn(sizeClass, className)} />;
}
