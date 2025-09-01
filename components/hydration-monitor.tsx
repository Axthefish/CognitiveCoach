"use client";

import { useEffect } from 'react';
import { markHydrationComplete, getHydrationState } from '@/lib/hydration-safe';

/**
 * HydrationMonitor - 全局hydration状态监控组件
 * 
 * 这个组件负责：
 * 1. 在应用启动时标记hydration完成状态
 * 2. 在开发模式下提供调试信息
 * 3. 防止hydration不匹配错误
 */
export function HydrationMonitor() {
  useEffect(() => {
    // 确保只在客户端执行
    if (typeof window !== 'undefined') {
      // 标记hydration已完成
      markHydrationComplete();
      
      // 设置全局标记
      window.__HYDRATION_COMPLETED__ = true;
      
      // 开发模式下的调试信息
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 HydrationMonitor: Hydration completed successfully');
        console.log('🔧 Current hydration state:', getHydrationState());
        
        // 监听页面卸载，重置状态
        const handleBeforeUnload = () => {
          window.__HYDRATION_COMPLETED__ = false;
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      }
    }
  }, []);

  // 这个组件不渲染任何视觉内容
  return null;
}
