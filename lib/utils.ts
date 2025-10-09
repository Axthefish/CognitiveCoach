import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 安全地将任意值转换为字符串
 * 用于在UI中显示不确定类型的数据
 * 
 * @param v - 要转换的值
 * @returns 字符串表示
 * 
 * @example
 * toText("hello") // "hello"
 * toText(null) // ""
 * toText({ key: "value" }) // '{"key":"value"}'
 * toText(undefined) // ""
 */
export function toText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Note: The following functions have been moved to specialized files:
// - formatFrameworkDescription → lib/framework-utils.ts
// - extractSilentIntent, computeTop2Levers, computeCorePath → lib/s2-utils.ts
