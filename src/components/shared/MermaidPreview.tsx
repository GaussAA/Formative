'use client';

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Modal } from './Modal';

interface MermaidPreviewProps {
  code: string;
  title?: string;
  onError?: (error: string) => void;
}

/**
 * MermaidPreview 组件 - 使用 React.memo 避免不必要的重渲染
 * 添加防抖优化和 requestAnimationFrame 提升渲染性能
 */
function MermaidPreviewComponent({ code, title, onError }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showCopiedModal, setShowCopiedModal] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mermaidInstanceRef = useRef<any>(null);

  /**
   * 使用 useCallback 缓存渲染函数
   * 添加 requestAnimationFrame 优化渲染时序
   */
  const renderDiagram = useCallback(async () => {
    if (!code || !containerRef.current) return;

    setIsRendering(true);
    setError(null);

    try {
      // 动态导入 mermaid（只导入一次）
      if (!mermaidInstanceRef.current) {
        const mermaidModule = await import('mermaid');
        mermaidInstanceRef.current = mermaidModule.default;

        // 配置 mermaid（只配置一次）
        mermaidInstanceRef.current.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        });
      }

      const mermaid = mermaidInstanceRef.current;

      // 清空容器
      containerRef.current.innerHTML = '';

      // 生成唯一 ID
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

      // 使用 requestAnimationFrame 确保在下一帧渲染
      requestAnimationFrame(async () => {
        try {
          // 渲染图表
          const { svg } = await mermaid.render(id, code);

          // 插入 SVG
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }

          setIsRendering(false);
        } catch (renderErr: unknown) {
          throw renderErr;
        }
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '图表渲染失败';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      setIsRendering(false);
    }
  }, [code, onError]);

  useEffect(() => {
    // 添加 300ms 防抖，避免频繁渲染
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      renderDiagram();
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [renderDiagram]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    setShowCopiedModal(true);
  }, [code]);

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCode(!showCode)}
              className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              {showCode ? '隐藏代码' : '查看代码'}
            </button>
            <button
              onClick={handleCopyCode}
              className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              复制代码
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* 显示原始代码 */}
        {showCode && (
          <div className="mb-4">
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto text-xs">
              <code className="text-gray-800">{code}</code>
            </pre>
          </div>
        )}

        {/* 渲染状态 */}
        {isRendering && (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <span className="ml-2">正在渲染图表...</span>
            </div>
          </div>
        )}

        {/* 渲染错误 */}
        {error && !isRendering && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800">图表渲染错误</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <p className="text-xs text-red-600 mt-2">
                  您可以点击上方"查看代码"查看原始 Mermaid 代码，或使用"修改图表"功能让 AI 修复语法错误。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 渲染的图表 */}
        <div
          ref={containerRef}
          className={`mermaid-container flex items-center justify-center overflow-x-auto ${error ? 'hidden' : ''}`}
        />
      </div>
    </div>

      {/* 复制成功提示弹窗 */}
      <Modal
        isOpen={showCopiedModal}
        onClose={() => setShowCopiedModal(false)}
        title="复制成功"
        content="代码已成功复制到剪贴板！"
        confirmText="好的"
        showCancel={false}
        confirmVariant="success"
      />
    </>
  );
}

/**
 * 使用 React.memo 包装组件，避免不必要的重渲染
 * 只有当 code、title、onError 变化时才重新渲染
 */
export const MermaidPreview = memo(MermaidPreviewComponent);
