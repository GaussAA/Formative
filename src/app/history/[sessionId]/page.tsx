/**
 * History detail page with Suspense boundary for PPR support
 * React 19: cacheComponents requires dynamic data to be wrapped in Suspense
 */

'use client';

import React, { Suspense } from 'react';
import HistoryDetailContent from './HistoryDetailContent';

export default function HistoryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      }
    >
      <HistoryDetailContent />
    </Suspense>
  );
}
