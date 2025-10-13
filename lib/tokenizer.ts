/**
 * Tokenizer - 真实Token计数与估算
 * 
 * 集成Google AI的实际tokenizer，提供准确的token计数
 * 保留启发式方法作为fallback
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { logger } from '@/lib/logger';

// ============================================
// 配置
// ============================================

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * 初始化tokenizer
 */
function initTokenizer() {
  if (genAI) return;
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!apiKey) {
    logger.warn('[Tokenizer] No API key found, will use heuristic fallback');
    return;
  }
  
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    // 使用Pro模型的tokenizer
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    logger.info('[Tokenizer] Initialized with real tokenizer');
  } catch (error) {
    logger.error('[Tokenizer] Failed to initialize', { error });
    genAI = null;
    model = null;
  }
}

// ============================================
// 启发式估算（Fallback）
// ============================================

/**
 * 启发式token估算
 * 用作fallback或离线场景
 */
export function estimateTokensHeuristic(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // 分离中文和其他字符
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const otherChars = text.replace(/[\u4e00-\u9fa5]/g, '');
  
  // 中文：约1.5字符/token
  // 英文/标点：约4字符/token
  const chineseTokens = chineseChars.length / 1.5;
  const otherTokens = otherChars.length / 4;
  
  return Math.ceil(chineseTokens + otherTokens);
}

// ============================================
// 真实Token计数
// ============================================

/**
 * 使用真实tokenizer计数tokens
 * 如果失败则使用启发式方法
 */
export async function countTokens(text: string): Promise<number> {
  if (!text || text.length === 0) return 0;
  
  // 尝试使用真实tokenizer
  try {
    if (!model) {
      initTokenizer();
    }
    
    if (model) {
      const result = await model.countTokens(text);
      return result.totalTokens;
    }
  } catch (error) {
    logger.debug('[Tokenizer] Real tokenizer failed, using heuristic', { error });
  }
  
  // Fallback to heuristic
  return estimateTokensHeuristic(text);
}

/**
 * 同步版本：只使用启发式估算
 * 用于需要立即返回的场景
 */
export function countTokensSync(text: string): number {
  return estimateTokensHeuristic(text);
}

/**
 * 批量计数tokens（异步）
 */
export async function countTokensBatch(texts: string[]): Promise<number[]> {
  if (!texts || texts.length === 0) return [];
  
  // 尝试使用真实tokenizer
  try {
    if (!model) {
      initTokenizer();
    }
    
    if (model) {
      // 并行计数
      const results = await Promise.all(
        texts.map(text => countTokens(text))
      );
      return results;
    }
  } catch (error) {
    logger.debug('[Tokenizer] Batch tokenizer failed, using heuristic', { error });
  }
  
  // Fallback: use heuristic for all
  return texts.map(estimateTokensHeuristic);
}

// ============================================
// 缓存层（可选优化）
// ============================================

interface TokenCache {
  text: string;
  tokens: number;
  timestamp: number;
}

const tokenCache = new Map<string, TokenCache>();
const CACHE_TTL = 60 * 60 * 1000;  // 1小时
const MAX_CACHE_SIZE = 1000;

/**
 * 带缓存的token计数
 */
export async function countTokensCached(text: string): Promise<number> {
  if (!text || text.length === 0) return 0;
  
  // 检查缓存
  const cached = tokenCache.get(text);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tokens;
  }
  
  // 计数
  const tokens = await countTokens(text);
  
  // 更新缓存
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    // 清理最旧的条目
    const oldestKey = Array.from(tokenCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    tokenCache.delete(oldestKey);
  }
  
  tokenCache.set(text, {
    text,
    tokens,
    timestamp: Date.now(),
  });
  
  return tokens;
}

/**
 * 清理过期缓存
 */
export function cleanTokenCache(): number {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, value] of tokenCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      tokenCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.debug('[Tokenizer] Cleaned token cache', { cleanedCount });
  }
  
  return cleanedCount;
}

/**
 * 获取缓存统计
 */
export function getTokenCacheStats() {
  return {
    size: tokenCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 比较真实tokenizer与启发式估算的差异
 */
export async function compareTokenizers(text: string): Promise<{
  real: number;
  heuristic: number;
  difference: number;
  percentDiff: number;
}> {
  const real = await countTokens(text);
  const heuristic = estimateTokensHeuristic(text);
  const difference = Math.abs(real - heuristic);
  const percentDiff = real > 0 ? (difference / real) * 100 : 0;
  
  return {
    real,
    heuristic,
    difference,
    percentDiff,
  };
}

/**
 * 测试tokenizer准确性
 */
export async function testTokenizerAccuracy(
  testCases: string[]
): Promise<{
  avgPercentDiff: number;
  maxPercentDiff: number;
  results: Array<{
    text: string;
    real: number;
    heuristic: number;
    percentDiff: number;
  }>;
}> {
  const results = await Promise.all(
    testCases.map(async (text) => {
      const comparison = await compareTokenizers(text);
      return {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        real: comparison.real,
        heuristic: comparison.heuristic,
        percentDiff: comparison.percentDiff,
      };
    })
  );
  
  const avgPercentDiff = results.reduce((sum, r) => sum + r.percentDiff, 0) / results.length;
  const maxPercentDiff = Math.max(...results.map(r => r.percentDiff));
  
  return {
    avgPercentDiff,
    maxPercentDiff,
    results,
  };
}

// ============================================
// 导出便捷函数
// ============================================

/**
 * 默认导出：优先使用缓存版本
 */
export const tokenizer = {
  count: countTokensCached,
  countSync: countTokensSync,
  countBatch: countTokensBatch,
  heuristic: estimateTokensHeuristic,
  compare: compareTokenizers,
  testAccuracy: testTokenizerAccuracy,
  cache: {
    clean: cleanTokenCache,
    stats: getTokenCacheStats,
  },
};

// 自动清理缓存（每小时）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanTokenCache, 60 * 60 * 1000);
}

