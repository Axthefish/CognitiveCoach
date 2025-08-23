"use client"

import React from 'react';
import { Button } from './button';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { NetworkError, getUserFriendlyErrorMessage } from '@/lib/network-utils';

interface ErrorDisplayProps {
  error: NetworkError | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, onDismiss, className = "" }: ErrorDisplayProps) {
  if (!error) return null;

  // Check if it's a NetworkError with enhanced info
  const isNetworkError = error && 'type' in error && 'retryable' in error;
  const networkError = isNetworkError ? error as NetworkError : null;
  
  const errorInfo = networkError 
    ? getUserFriendlyErrorMessage(networkError)
    : {
        title: '出现错误',
        description: error.message || '发生了未知错误',
        suggestions: ['请刷新页面重试']
      };

  const canRetry = networkError ? networkError.retryable : true;

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 ${className}`}>
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            {errorInfo.title}
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {errorInfo.description}
          </p>
          {errorInfo.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
                建议解决方案：
              </p>
              <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-1">
                {errorInfo.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {onRetry && canRetry && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={onRetry}
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            重试
          </Button>
        </div>
      )}
    </div>
  );
}
