/**
 * 智能错误组件
 * 根据错误类型提供友好的提示和操作建议
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  WifiOff,
  ServerCrash,
  Bug,
  RefreshCw,
  X,
  Mail,
} from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export type ErrorType = 'network' | 'server' | 'validation' | 'unknown';

interface SmartErrorProps {
  type?: ErrorType;
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  onContact?: () => void;
  autoHideDuration?: number;
  className?: string;
}

const ERROR_CONFIGS = {
  network: {
    icon: WifiOff,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    title: '网络连接失败',
    defaultMessage: '请检查您的网络连接，然后重试。',
    actions: ['retry'],
  },
  server: {
    icon: ServerCrash,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    title: '服务器错误',
    defaultMessage: '服务器暂时出现问题，请稍后重试。',
    actions: ['retry', 'contact'],
  },
  validation: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    title: '输入验证失败',
    defaultMessage: '请检查您的输入并重试。',
    actions: ['dismiss'],
  },
  unknown: {
    icon: Bug,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    title: '出现错误',
    defaultMessage: '发生了未知错误，请重试。',
    actions: ['retry', 'dismiss'],
  },
};

export function SmartError({
  type = 'unknown',
  title,
  message,
  onRetry,
  onDismiss,
  onContact,
  autoHideDuration,
  className,
}: SmartErrorProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [timeLeft, setTimeLeft] = React.useState(autoHideDuration);
  
  const config = ERROR_CONFIGS[type];
  const Icon = config.icon;
  
  const handleDismiss = React.useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }, [onDismiss]);
  
  // 自动隐藏倒计时
  React.useEffect(() => {
    if (!autoHideDuration) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === undefined || prev <= 1) {
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [autoHideDuration, handleDismiss]);
  
  const handleRetry = () => {
    setIsVisible(false);
    setTimeout(() => {
      onRetry?.();
    }, 300);
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            'glass-card-primary rounded-xl p-6 border',
            config.bgColor,
            config.borderColor,
            className
          )}
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-4">
            {/* 图标 */}
            <motion.div
              className={cn('flex-shrink-0', config.color)}
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white mb-1">
                {title || config.title}
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                {message || config.defaultMessage}
              </p>
              
              {/* 操作按钮 */}
              <div className="flex flex-wrap gap-2">
                {config.actions.includes('retry') && onRetry && (
                  <Button
                    onClick={handleRetry}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重试
                  </Button>
                )}
                
                {config.actions.includes('contact') && onContact && (
                  <Button
                    onClick={onContact}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    联系支持
                  </Button>
                )}
                
                {config.actions.includes('dismiss') && onDismiss && (
                  <Button
                    onClick={handleDismiss}
                    size="sm"
                    variant="ghost"
                  >
                    知道了
                  </Button>
                )}
              </div>
              
              {/* 自动隐藏倒计时 */}
              {timeLeft !== undefined && timeLeft > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  {timeLeft} 秒后自动关闭
                </p>
              )}
            </div>
            
            {/* 关闭按钮 */}
            {onDismiss && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                aria-label="关闭错误提示"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 错误边界友好错误页面
 */
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="gradient-background" />
      
      <motion.div
        className="glass-card-primary rounded-2xl p-8 max-w-md text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-6"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: 3 }}
        >
          <Bug className="w-8 h-8 text-red-400" />
        </motion.div>
        
        <h1 className="text-2xl font-bold text-white mb-3">
          哎呀，出了点小问题
        </h1>
        
        <p className="text-gray-300 mb-6">
          应用遇到了一个意外错误。别担心，您的数据是安全的。
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left glass-card-secondary rounded-lg p-4 mb-6">
            <summary className="text-sm text-gray-400 cursor-pointer mb-2">
              错误详情（开发模式）
            </summary>
            <pre className="text-xs text-red-400 overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        <div className="flex gap-3 justify-center">
          <Button onClick={resetErrorBoundary} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            重新加载
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="gap-2"
          >
            返回首页
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

