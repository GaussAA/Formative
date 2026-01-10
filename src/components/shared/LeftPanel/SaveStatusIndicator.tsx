/**
 * 保存状态指示器组件
 * 显示当前保存状态和时间
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { SaveStatus } from '@/contexts/StageContext';
import { formatTimeAgo, getSaveStatusStyles } from './utils';

interface SaveStatusIndicatorProps {
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  onManualSave: () => Promise<void>;
}

export function SaveStatusIndicator({
  saveStatus,
  lastSavedAt,
  onManualSave,
}: SaveStatusIndicatorProps) {
  const [timeDisplay, setTimeDisplay] = useState(() => formatTimeAgo(lastSavedAt));

  // 更新时间显示（每秒更新）
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeDisplay(formatTimeAgo(lastSavedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  const handleManualSave = useCallback(async () => {
    await onManualSave();
  }, [onManualSave]);

  const saveStatusStyles = getSaveStatusStyles(saveStatus);

  return (
    <div className={`mt-4 w-full px-3 py-2 rounded-lg border flex items-center justify-between ${saveStatusStyles.bgColor} ${saveStatusStyles.borderColor}`}>
      <div className="flex items-center space-x-2">
        {saveStatusStyles.icon}
        <span className={`text-xs font-medium ${saveStatusStyles.textColor}`}>
          {saveStatusStyles.text}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <span className={`text-xs ${saveStatusStyles.textColor}`}>{timeDisplay}</span>
        <button
          onClick={handleManualSave}
          disabled={saveStatus === 'saving'}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            saveStatus === 'saving'
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
          }`}
          title="立即保存"
        >
          保存
        </button>
      </div>
    </div>
  );
}
