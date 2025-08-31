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

// 安全的随机数生成 - 在 hydration 期间返回确定性值
let hydrationSafeRandom: number | null = null;

export function getHydrationSafeRandom(): number {
  // 在服务端渲染和首次客户端渲染时返回固定值
  if (!getIsClient() || hydrationSafeRandom === null) {
    if (typeof window === 'undefined') {
      // 服务端 - 返回确定性值
      return 0.5;
    }
    
    // 客户端首次渲染 - 检查是否是 hydration 阶段
    const isHydrating = !window.__HYDRATION_COMPLETED__;
    if (isHydrating) {
      // Hydration 阶段 - 返回与服务端相同的确定性值
      hydrationSafeRandom = 0.5;
    } else {
      // 正常客户端运行 - 可以使用真实随机数
      hydrationSafeRandom = Math.random();
    }
  }
  
  return hydrationSafeRandom;
}

// 安全的时间戳生成 - 在 hydration 期间返回确定性值
let hydrationSafeTimestamp: string | null = null;
const FALLBACK_TIMESTAMP = '2024-01-01T00:00:00.000Z';

export function getHydrationSafeTimestamp(): string {
  if (!getIsClient() || hydrationSafeTimestamp === null) {
    if (typeof window === 'undefined') {
      // 服务端 - 返回确定性时间戳
      return FALLBACK_TIMESTAMP;
    }
    
    // 客户端首次渲染 - 检查是否是 hydration 阶段
    const isHydrating = !window.__HYDRATION_COMPLETED__;
    if (isHydrating) {
      // Hydration 阶段 - 返回与服务端相同的确定性时间戳
      hydrationSafeTimestamp = FALLBACK_TIMESTAMP;
    } else {
      // 正常客户端运行 - 可以使用真实时间戳
      hydrationSafeTimestamp = new Date().toISOString();
    }
  }
  
  return hydrationSafeTimestamp;
}

// 重置 hydration 安全状态 - 在 hydration 完成后调用
export function markHydrationComplete() {
  if (getIsClient()) {
    window.__HYDRATION_COMPLETED__ = true;
    // 重置状态以允许后续真实随机数和时间戳
    hydrationSafeRandom = null;
    hydrationSafeTimestamp = null;
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
