'use client';

import { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { AbandonTaskModal } from './AbandonTaskModal';
import { TabNavigation } from '@/components/TabNavigation';
import { useAbandonTask } from '../hooks/useAbandonTask';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Single-page application layout without borders
 * Seamless, flowing design with glassmorphism effects
 */
export function AppLayout({ children }: AppLayoutProps) {
  const abandonTask = useAbandonTask();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header - sticky with glassmorphism effect, no border */}
      <AppHeader onAbandon={abandonTask.open} />

      {/* Tab Navigation - sticky, seamless design */}
      <TabNavigation />

      {/* Main Content - flexible height with overflow */}
      <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-gray-900">
        {children}
      </main>

      {/* Abandon Task Confirmation Modal */}
      <AbandonTaskModal
        isOpen={abandonTask.isOpen}
        onClose={abandonTask.close}
        onConfirm={abandonTask.confirm}
      />
    </div>
  );
}
