'use client';

import { useState, useCallback } from 'react';
import { useStage } from '@/contexts/StageContext';

/**
 * Hook for managing abandon task functionality
 * @returns Object containing abandon task state and handlers
 */
export function useAbandonTask() {
  const [isOpen, setIsOpen] = useState(false);
  const { resetAll } = useStage();

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const confirm = useCallback(() => {
    resetAll();
    // Brief delay to allow state update to complete
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }, [resetAll]);

  return {
    isOpen,
    open,
    close,
    confirm,
  };
}
