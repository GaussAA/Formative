'use client';

import { StageProvider } from '@/contexts/StageContext';
import { AppLayout } from './components/AppLayout';
import { StageRenderer } from './components/StageRenderer';

/**
 * Application page entry point
 * Provides context and layout structure
 */
export default function AppPage() {
  return (
    <StageProvider>
      <AppLayout>
        <StageRenderer />
      </AppLayout>
    </StageProvider>
  );
}
