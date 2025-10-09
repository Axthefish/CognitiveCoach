/**
 * 质量门控系统 - 确保AI生成内容符合质量标准
 * 
 * 职责：
 * - Schema 合规性验证（阻断性）
 * - 内容覆盖度检查（警告）
 * - 跨阶段一致性验证（警告）
 * - 证据充分性检查（提示）
 * 
 * 使用场景：
 * - 所有Service层在AI响应后调用
 * - 阻断性问题会抛出错误
 * - 警告级别问题记录日志但不阻断
 */

import { z } from 'zod';
import {
  KnowledgeFrameworkSchema,
  SystemDynamicsSchema,
  ActionPlanResponseSchema,
} from './schemas';

/**
 * 问题领域分类
 */
export type IssueArea = 'schema' | 'coverage' | 'consistency' | 'evidence' | 'actionability';

/**
 * 问题严重程度
 * - blocker: 阻断性问题，必须修复
 * - warn: 警告级别，记录但不阻断
 */
export type IssueSeverity = 'blocker' | 'warn';

/**
 * 质量问题描述
 */
export interface QualityIssue {
  severity: IssueSeverity;
  area: IssueArea;
  hint: string;
  targetPath: string;
}

/**
 * 质量门控检查结果
 */
export interface QualityGateResult {
  passed: boolean;
  issues: QualityIssue[];
}

/**
 * 添加质量问题到列表
 * @internal
 */
function addIssue(issues: QualityIssue[], issue: QualityIssue) {
  issues.push(issue);
}

/**
 * 运行质量门控检查
 * 
 * 检查维度：
 * - schema: Schema 合规性（阻断性）
 * - coverage: 内容覆盖度（警告）
 * - consistency: 跨阶段一致性（警告）
 * - evidence: 证据充分性（提示）
 * - actionability: 可操作性（提示）
 * 
 * @param stage - 当前处理阶段 (S1: 知识框架, S2: 系统动力学, S3: 行动计划, S4: 进度分析)
 * @param output - AI生成的输出（未验证）
 * @param context - 额外的上下文信息用于跨阶段一致性检查
 * @param context.framework - S1生成的知识框架（S2阶段使用）
 * @param context.nodes - 系统节点列表（S3阶段使用）
 * @param context.strategyMetrics - 策略指标（S4阶段使用）
 * @returns QualityGateResult - 包含是否通过和具体问题列表
 * 
 * @example
 * ```typescript
 * const qaResult = runQualityGates('S1', aiOutput);
 * if (!qaResult.passed) {
 *   throw new AppError({
 *     code: ErrorCodes.QA_VALIDATION_FAILED,
 *     message: 'Quality gates failed',
 *     details: qaResult.issues
 *   });
 * }
 * ```
 */
export function runQualityGates(
  stage: 'S1' | 'S2' | 'S3' | 'S4',
  output: unknown,
  context?: { framework?: unknown; nodes?: Array<{ id: string }>; strategyMetrics?: Array<{ metricId: string; recovery?: { reviewMetricIds?: string[] } }>; }
): QualityGateResult {
  const issues: QualityIssue[] = [];

  try {
    if (stage === 'S1') {
      KnowledgeFrameworkSchema.parse(output);
    } else if (stage === 'S2') {
      SystemDynamicsSchema.parse(output);
    } else if (stage === 'S3') {
      ActionPlanResponseSchema.parse(output);
    }
  } catch (err) {
    const message = err instanceof z.ZodError ? (err as z.ZodError).issues.map(e => e.message).join('; ') : 'schema error';
    addIssue(issues, { severity: 'blocker', area: 'schema', hint: message, targetPath: stage });
  }

  // S1 -> S2 consistency: key framework ids must appear in S2 nodes (with tolerance)
  if (stage === 'S2' && context?.framework && Array.isArray((output as { nodes?: Array<{ id: string }> })?.nodes)) {
    const fwIds = new Set(extractFrameworkIds(context.framework as Record<string, unknown> | Array<unknown>).map(normalizeId));
    const nodeIds = new Set(((output as { nodes?: Array<{ id: string }> }).nodes || []).map(n => normalizeId(n.id)));
    const missing = [...fwIds].filter(id => !nodeIds.has(id));
    if (missing.length > 0) {
      const severity = classifyS2CoverageSeverity(fwIds.size, missing);
      addIssue(issues, { 
        severity, 
        area: severity === 'blocker' ? 'consistency' : 'coverage', 
        hint: `Framework ids not found in S2.nodes: ${missing.join(', ')} (${missing.length}/${fwIds.size} missing)`, 
        targetPath: 'nodes' 
      });
    }
  }

  // S3 -> S4 consistency (placeholder): ensure S4 references at least one KPI or mentions completion; can be expanded later
  if (stage === 'S4' && context?.strategyMetrics) {
    const referenced: string[] = Array.isArray((output as { referencedMetricIds?: string[] })?.referencedMetricIds)
      ? (output as { referencedMetricIds?: string[] }).referencedMetricIds || []
      : [];
    const metrics = context.strategyMetrics.map(m => normalizeId(m.metricId));
    const bad = referenced.filter(id => !metrics.includes(normalizeId(id)));
    if (bad.length > 0) {
      addIssue(issues, { severity: 'warn', area: 'consistency', hint: `S4 references unknown metric ids: ${bad.join(', ')}`, targetPath: 'referencedMetricIds' });
    }
  }

  // basic coverage: if S2 provides nodes and S3 provides strategySpec.metrics, verify coverage
  if (stage === 'S3' && context?.nodes && Array.isArray((output as { strategySpec?: { metrics?: Array<Record<string, unknown>> } })?.strategySpec?.metrics)) {
    const nodeIds = new Set(context.nodes.map(n => normalizeId(n.id)));
    const metrics: Array<{ metricId: string }> = ((output as { strategySpec?: { metrics?: Array<{ metricId: string }> } }).strategySpec?.metrics) || [];
    const metricIds = new Set(metrics.map(m => normalizeId(m.metricId)));
    const missing = [...nodeIds].filter(id => !metricIds.has(id));
    if (missing.length > 0) {
      addIssue(issues, {
        severity: 'blocker',
        area: 'coverage',
        hint: `Uncovered nodes: ${missing.join(', ')}`,
        targetPath: 'strategySpec.metrics',
      });
    }
    // actionability & stopLoss checks
    const metricsFull: Array<{ metricId: string; triggers?: unknown[]; diagnosis?: unknown[]; options?: unknown[]; recovery?: unknown; stopLoss?: unknown; evidence?: unknown[]; confidence?: number }>
      = (((output as { strategySpec?: { metrics?: Array<Record<string, unknown>> } }).strategySpec?.metrics) || []) as Array<{ metricId: string; triggers?: unknown[]; diagnosis?: unknown[]; options?: unknown[]; recovery?: unknown; stopLoss?: unknown; evidence?: unknown[]; confidence?: number }>;
    for (const m of metricsFull) {
      const path = `strategySpec.metrics(${m.metricId})`;
      if (!Array.isArray(m.triggers) || m.triggers.length === 0) {
        addIssue(issues, { severity: 'blocker', area: 'actionability', hint: 'metric requires at least 1 trigger', targetPath: `${path}.triggers` });
      }
      if (!Array.isArray(m.diagnosis) || m.diagnosis.length === 0) {
        addIssue(issues, { severity: 'blocker', area: 'actionability', hint: 'metric requires at least 1 diagnosis step', targetPath: `${path}.diagnosis` });
      }
      if (!Array.isArray(m.options) || m.options.length === 0) {
        addIssue(issues, { severity: 'blocker', area: 'actionability', hint: 'metric requires options (A/B/C)', targetPath: `${path}.options` });
      }
      if (!m.recovery) {
        addIssue(issues, { severity: 'blocker', area: 'actionability', hint: 'metric requires recovery window', targetPath: `${path}.recovery` });
      }
      if (!m.stopLoss) {
        addIssue(issues, { severity: 'blocker', area: 'actionability', hint: 'metric requires stopLoss', targetPath: `${path}.stopLoss` });
      }
      if (!m.evidence || m.evidence.length === 0) {
        addIssue(issues, { severity: 'warn', area: 'evidence', hint: 'evidence is recommended', targetPath: `${path}.evidence` });
      }
    }
    // POV check (soft in v1)
    const outObj = output as { povTags?: unknown };
    if (!Array.isArray(outObj?.povTags) || (outObj.povTags as unknown[]).length < 2) {
      addIssue(issues, { severity: 'warn', area: 'consistency', hint: 'At least two POVs are recommended', targetPath: 'povTags' });
    }
  }

  // Only blocker issues cause failure
  const blockers = issues.filter(i => i.severity === 'blocker');
  return { passed: blockers.length === 0, issues };
}

// Helper function to classify S2 coverage severity with tolerance
function classifyS2CoverageSeverity(totalIds: number, missing: string[]): IssueSeverity {
  const missingCount = missing.length;
  if (missingCount === 0) return 'warn';

  // Raise coverage threshold to 90%: if missing > 10% → blocker
  const missingRatio = totalIds > 0 ? missingCount / totalIds : 1;

  // Small frameworks tolerance: allow up to 1 missing without blocking
  if (totalIds <= 8 && missingCount <= 1) {
    return 'warn';
  }

  return missingRatio > 0.10 ? 'blocker' : 'warn';
}

export function normalizeId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '-');
}

function extractFrameworkIds(framework: Record<string, unknown> | Array<unknown>): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown> & { children?: unknown[] };
      if (typeof obj.id === 'string') ids.push(obj.id);
      if (Array.isArray(obj.children)) obj.children.forEach(walk);
    }
  };
  if (Array.isArray(framework)) (framework as unknown[]).forEach(walk); else walk(framework);
  return ids;
}


