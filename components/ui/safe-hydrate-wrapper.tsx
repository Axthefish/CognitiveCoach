"use client";

import React, { useEffect, useState } from 'react';

interface SafeHydrateWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * SafeHydrateWrapper - 确保安全的hydration过程
 * 
 * 这个组件通过延迟渲染动态内容来避免hydration错误
 * 在服务端和hydration期间显示fallback内容
 * 只有在客户端完全挂载后才显示实际内容
 */
export function SafeHydrateWrapper({ 
  children, 
  fallback = null,
  className 
}: SafeHydrateWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    // 使用requestIdleCallback确保在浏览器空闲时才标记为已hydrated
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        setIsHydrated(true);
      });
    } else {
      // Fallback for browsers that don't support requestIdleCallback
      const timer = setTimeout(() => {
        setIsHydrated(true);
      }, 1);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // 在hydration完成前，返回静态fallback
  if (!isHydrated) {
    return (
      <div className={className} suppressHydrationWarning>
        {fallback}
      </div>
    );
  }
  
  // Hydration完成后，渲染实际内容
  return <>{children}</>;
}

/**
 * useHydrated - Hook版本的hydration检测
 */
export function useHydrated() {
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  return isHydrated;
}
