/**
 * Hydration-safe utilities to prevent server-client mismatch
 */

let isClient: boolean;

// 安全的客户端检查 - 确保 hydration 期间的一致性
export function getIsClient(): boolean {
  if (typeof isClient !== 'undefined') {
    return isClient;
  }
  
  isClient = typeof window !== 'undefined';
  return isClient;
}

// 重置 hydration 安全状态 - 在 hydration 完成后调用
export function markHydrationComplete() {
  if (getIsClient()) {
    window.__HYDRATION_COMPLETED__ = true;
  }
}

// 安全的 console.log - 避免服务端客户端输出差异
export function hydrationSafeLog(...args: unknown[]) {
  if (getIsClient() && process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}

// 声明全局变量类型
declare global {
  interface Window {
    __HYDRATION_COMPLETED__?: boolean;
  }
}

// 导出类型
export type HydrationState = 'server' | 'hydrating' | 'hydrated';

export function getHydrationState(): HydrationState {
  if (typeof window === 'undefined') {
    return 'server';
  }
  
  if (window.__HYDRATION_COMPLETED__) {
    return 'hydrated';
  }
  
  return 'hydrating';
}

