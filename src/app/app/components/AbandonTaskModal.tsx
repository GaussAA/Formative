'use client';

import { Modal } from '@/components/shared/Modal';

interface AbandonTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Modal component for confirming task abandonment
 */
export function AbandonTaskModal({ isOpen, onClose, onConfirm }: AbandonTaskModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="放弃当前任务"
      content="确定要放弃当前任务吗？所有进度将会丢失，此操作无法撤销。"
      confirmText="确认放弃"
      cancelText="取消"
      confirmVariant="danger"
    />
  );
}
