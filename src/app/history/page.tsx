'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { StageNames } from '@/types';

interface SessionRecord {
  sessionId: string;
  projectName: string | null;
  currentStage: number;
  completeness: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions');
      const result = await response.json();
      if (result.success) {
        setSessions(result.data);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (sessionId: string) => {
    router.push(`/history/${sessionId}`);
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;

    try {
      const response = await fetch(`/api/sessions/${sessionToDelete}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSessions(sessions.filter(s => s.sessionId !== sessionToDelete));
        setDeleteModalOpen(false);
        setSessionToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除失败，请稍后重试');
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? '刚刚' : `${minutes} 分钟前`;
      }
      return `${hours} 小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="mt-4 text-gray-600">加载历史记录...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/')}
                className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <span className="text-white text-xl font-bold">F</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">历史记录</h1>
                <p className="text-xs text-gray-500">查看和管理您的项目方案历史</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="default">{sessions.length} 条记录</Badge>
              <Button onClick={() => router.push('/app')} variant="primary">
                + 新建方案
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">暂无历史记录</h2>
            <p className="text-gray-600 mb-6">开始创建您的第一个产品方案吧！</p>
            <Button onClick={() => router.push('/app')} size="lg">
              立即开始
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card
                key={session.sessionId}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {session.projectName || '未命名项目'}
                        </h3>
                        {session.completed ? (
                          <Badge variant="success">✅ 已完成</Badge>
                        ) : (
                          <Badge variant="default">
                            进行中 - {StageNames[session.currentStage as keyof typeof StageNames]}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span>创建于 {formatDate(session.createdAt)}</span>
                        <span>•</span>
                        <span>最后更新 {formatDate(session.updatedAt)}</span>
                        <span>•</span>
                        <span>完成度 {session.completeness}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => handleView(session.sessionId)}
                        size="sm"
                        variant="primary"
                      >
                        查看详情
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(session.sessionId);
                          setDeleteModalOpen(true);
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSessionToDelete(null);
        }}
        onConfirm={handleDelete}
        title="确认删除"
        content="确定要删除这条历史记录吗？此操作无法撤销。"
        confirmText="确认删除"
        cancelText="取消"
        confirmVariant="danger"
      />
    </div>
  );
}
