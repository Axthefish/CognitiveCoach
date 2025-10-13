/**
 * 移动端底部抽屉组件
 * 用于移动端替代对话框
 */

'use client';

import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  children,
  title,
  className,
}: MobileDrawerProps) {
  // 处理拖拽关闭
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  };
  
  // Escape 键关闭
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  // 锁定背景滚动
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            className="fixed inset-0 glass-overlay z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          
          {/* 抽屉内容 */}
          <motion.div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'glass-card-primary rounded-t-3xl',
              'max-h-[90vh] overflow-hidden flex flex-col',
              className
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'drawer-title' : undefined}
          >
            {/* 拖拽指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
            
            {/* 头部 */}
            {title && (
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 id="drawer-title" className="text-xl font-bold text-white">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="关闭抽屉"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>
            )}
            
            {/* 内容区域（可滚动） */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * 移动端确认对话框（底部抽屉样式）
 */
export function MobileConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'default',
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'destructive';
}) {
  const handleCancel = () => {
    onCancel?.();
    onClose();
  };
  
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  
  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title={title}>
      {description && (
        <p className="text-gray-300 mb-6">{description}</p>
      )}
      
      <div className="flex flex-col gap-3">
        <motion.button
          onClick={handleConfirm}
          className={cn(
            'w-full py-4 rounded-xl font-semibold text-lg',
            'transition-colors',
            confirmVariant === 'destructive'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
          )}
          whileTap={{ scale: 0.98 }}
        >
          {confirmText}
        </motion.button>
        
        <motion.button
          onClick={handleCancel}
          className="w-full py-4 rounded-xl font-semibold text-lg glass-button text-white"
          whileTap={{ scale: 0.98 }}
        >
          {cancelText}
        </motion.button>
      </div>
    </MobileDrawer>
  );
}

