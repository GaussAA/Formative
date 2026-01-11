/**
 * LeftPanel 工具函数
 */

import type { SaveStatus } from '@/contexts/StageContext';

/**
 * 格式化时间显示
 */
export function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return '未保存';

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) return '刚刚保存';
  if (seconds < 60) return `${seconds}秒前保存`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前保存`;
  return `${Math.floor(seconds / 3600)}小时前保存`;
}

/**
 * 获取保存状态样式
 */
export function getSaveStatusStyles(status: SaveStatus) {
  switch (status) {
    case 'saving':
      return {
        text: '保存中...',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        icon: (
          <svg className="animate-spin h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ),
      };
    case 'saved':
      return {
        text: '已保存',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        icon: (
          <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    case 'error':
      return {
        text: '保存失败',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        icon: (
          <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
      };
    default:
      return {
        text: '待保存',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-500',
        borderColor: 'border-gray-200',
        icon: null,
      };
  }
}
