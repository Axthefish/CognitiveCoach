"use client";

import { useEffect, useState } from 'react';
import { markHydrationComplete } from '@/lib/hydration-safe';

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  suppressHydrationWarning?: boolean;
}

/**
 * ClientOnly组件 - 确保子组件仅在客户端渲染
 * 
 * 这个组件解决了hydration不匹配的问题，通过：
 * 1. 在服务端渲染时显示fallback（或null）
 * 2. 在客户端hydration完成后再显示实际内容
 * 3. 与hydration-safe工具集成，确保状态一致性
 */
export function ClientOnly({ 
  children, 
  fallback = null, 
  suppressHydrationWarning = true 
}: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    // 标记组件已在客户端挂载
    setHasMounted(true);
    
    // 确保hydration状态被正确标记
    if (typeof window !== 'undefined') {
      markHydrationComplete();
      
      // ClientOnly component mounted
    }
  }, []);
  
  // 服务端渲染或hydration期间显示fallback
  if (!hasMounted) {
    return (
      <div suppressHydrationWarning={suppressHydrationWarning}>
        {fallback}
      </div>
    );
  }
  
  // 客户端渲染时显示实际内容
  return <>{children}</>;
}

/**
 * 用于需要延迟渲染的动态内容的Hook
 */
export function useClientOnly() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    markHydrationComplete();
  }, []);
  
  return isClient;
}
