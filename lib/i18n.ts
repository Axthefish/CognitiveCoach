/**
 * 国际化配置
 * 支持中文和英文
 */

import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';
import { logger } from './logger';

export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh';

/**
 * 从请求头检测语言
 */
async function detectLocale(): Promise<Locale> {
  try {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    
    if (acceptLanguage) {
      // 简单的语言检测
      if (acceptLanguage.includes('zh')) return 'zh';
      if (acceptLanguage.includes('en')) return 'en';
    }
  } catch (error) {
    // headers() 在某些情况下可能失败
    logger.warn('Failed to detect locale from headers', { error });
  }
  
  return defaultLocale;
}

export default getRequestConfig(async () => {
  // 可以从 cookie、URL 参数或浏览器语言检测
  const locale = await detectLocale();

  return {
    locale,
    messages: {
      ...(await import(`../locales/${locale}/common.json`)).default,
      ...(await import(`../locales/${locale}/stage0.json`)).default,
      ...(await import(`../locales/${locale}/stage1.json`)).default,
      ...(await import(`../locales/${locale}/stage2.json`)).default,
    },
  };
});

/**
 * 客户端语言切换 Hook
 * 注：当前版本语言切换在 LanguageSwitcher 组件中实现
 * 此Hook保留用于未来扩展（如服务端语言切换）
 */
export function useLocale() {
  return {
    locale: defaultLocale,
    setLocale: (locale: Locale) => {
      // Language switching is handled by LanguageSwitcher component
      logger.info('Locale switch requested', { locale });
    },
  };
}

