/**
 * 响应式断点 Hook
 * 统一管理应用的响应式断点
 */

'use client';

import { useState, useEffect } from 'react';

// 断点定义（与 Tailwind 保持一致）
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLarge: boolean;
  current: Breakpoint | 'xs';
  width: number;
}

/**
 * 获取当前断点
 */
function getCurrentBreakpoint(width: number): Breakpoint | 'xs' {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * 获取断点状态
 */
function getBreakpointState(width: number): BreakpointState {
  return {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isLarge: width >= BREAKPOINTS.xl,
    current: getCurrentBreakpoint(width),
    width,
  };
}

/**
 * useBreakpoint Hook
 * 
 * @example
 * const { isMobile, isTablet, isDesktop } = useBreakpoint();
 * 
 * if (isMobile) {
 *   return <MobileView />;
 * }
 * return <DesktopView />;
 */
export function useBreakpoint(): BreakpointState {
  const [breakpoint, setBreakpoint] = useState<BreakpointState>(() => {
    // SSR 安全：服务端默认返回桌面端
    if (typeof window === 'undefined') {
      return getBreakpointState(1024);
    }
    return getBreakpointState(window.innerWidth);
  });

  useEffect(() => {
    // 防抖处理
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setBreakpoint(getBreakpointState(window.innerWidth));
      }, 100);
    };

    // 初始化
    handleResize();

    // 监听窗口变化
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return breakpoint;
}

/**
 * useMediaQuery Hook
 * 更灵活的媒体查询 Hook
 * 
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // 现代浏览器使用 addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // 旧版浏览器兼容
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

/**
 * 特定断点检测 Hooks
 */
export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
export const useIsTablet = () => useMediaQuery(`(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`);
export const useIsDesktop = () => useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);

