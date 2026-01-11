/**
 * Modal Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/shared/Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    content: 'Test content',
  };

  beforeEach(() => {
    // Reset body styles before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Clean up body styles after each test
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('should render string content as paragraph', () => {
      render(<Modal {...defaultProps} content="String content" />);
      const paragraph = screen.getByText('String content');
      expect(paragraph.tagName).toBe('P');
    });

    it('should render React node content', () => {
      render(
        <Modal
          {...defaultProps}
          content={
            <div>
              <span>Custom content</span>
            </div>
          }
        />
      );
      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });

    it('should render with custom button texts', () => {
      render(
        <Modal
          {...defaultProps}
          confirmText="确认"
          cancelText="取消"
        />
      );
      expect(screen.getByText('确认')).toBeInTheDocument();
      expect(screen.getByText('取消')).toBeInTheDocument();
    });

    it('should not render cancel button when showCancel is false', () => {
      render(<Modal {...defaultProps} showCancel={false} />);
      expect(screen.queryByText('取消')).not.toBeInTheDocument();
      expect(screen.getByText('确定')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByText('取消'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm and onClose when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} onConfirm={onConfirm} />);

      await user.click(screen.getByText('确定'));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when confirm button is clicked without onConfirm', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByText('确定'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked with closeOnOverlay', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlay={true} />);

      // Click on the overlay (the outer div)
      const overlay = screen.getByText('Test Modal').closest('.fixed');
      if (overlay) {
        await user.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not call onClose when overlay is clicked without closeOnOverlay', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlay={false} />);

      const overlay = screen.getByText('Test Modal').closest('.fixed');
      if (overlay) {
        await user.click(overlay);
        expect(onClose).not.toHaveBeenCalled();
      }
    });

    it('should not call onClose when modal content is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlay={true} />);

      // Click on the modal content (inner div)
      const modalContent = screen.getByText('Test content').closest('.bg-white');
      if (modalContent) {
        await user.click(modalContent);
        expect(onClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('keyboard interactions', () => {
    it('should call onClose when Escape key is pressed', async () => {
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} />);

      await userEvent.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when Escape key is pressed and modal is closed', async () => {
      const onClose = vi.fn();

      render(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);

      await userEvent.keyboard('{Escape}');

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('side effects', () => {
    it('should prevent body scroll when open', async () => {
      render(<Modal {...defaultProps} />);

      await waitFor(() => {
        expect(document.body.style.overflow).toBe('hidden');
      });
    });

    it('should restore body scroll when closed', async () => {
      const { rerender } = render(<Modal {...defaultProps} />);

      // First verify scroll is disabled
      await waitFor(() => {
        expect(document.body.style.overflow).toBe('hidden');
      });

      // Close the modal
      rerender(<Modal {...defaultProps} isOpen={false} />);

      await waitFor(() => {
        expect(document.body.style.overflow).toBe('unset');
      });
    });

    it('should add and remove Escape key listener', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = render(<Modal {...defaultProps} />);

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      });

      rerender(<Modal {...defaultProps} isOpen={false} />);

      await waitFor(() => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      });

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('confirm variant styles', () => {
    it('should apply primary variant styles by default', () => {
      render(<Modal {...defaultProps} />);
      const confirmButton = screen.getByText('确定');
      expect(confirmButton).toHaveClass('bg-primary');
    });

    it('should apply danger variant styles', () => {
      render(<Modal {...defaultProps} confirmVariant="danger" />);
      const confirmButton = screen.getByText('确定');
      expect(confirmButton).toHaveClass('bg-red-600');
    });

    it('should apply success variant styles', () => {
      render(<Modal {...defaultProps} confirmVariant="success" />);
      const confirmButton = screen.getByText('确定');
      expect(confirmButton).toHaveClass('bg-green-600');
    });
  });
});
