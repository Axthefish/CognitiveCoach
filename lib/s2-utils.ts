/**
 * S2 阶段专用工具函数
 * 
 * 职责：
 * - 从用户上下文中提取意图信息
 * - 计算关键杠杆点
 * - 生成核心学习路径
 * 
 * 使用场景：
 * - components/s2-system-dynamics-view.tsx
 */

import type { UserContext } from './types';

// Intent extraction (silent) from existing user context without new Q&A
export interface SilentIntent {
  goal: string;
  constraints?: { time?: string; level?: string };
}

export function extractSilentIntent(userContext: Partial<UserContext>): SilentIntent {
  const goal = (userContext?.userGoal || '').toString().trim()
  const constraints: SilentIntent['constraints'] = {}
  // Derive time from reviewWindow or goal text (very light heuristic)
  if (typeof userContext?.reviewWindow === 'string' && userContext.reviewWindow.trim()) {
    constraints.time = userContext.reviewWindow.trim()
  }
  // Derive level from decisionType or povTags
  const levelTag = Array.isArray(userContext?.povTags) ? userContext.povTags.find((t: string) => /beginner|intermediate|advanced|入门|中级|高级/i.test(t)) : undefined
  if (levelTag) constraints.level = levelTag
  return { goal, constraints }
}

// Compute Top2 levers based on mainPath and evidence gaps
export interface LeverItem { id: string; title: string; impact: string; nextAction: string }

export function computeTop2Levers(userContext: Partial<UserContext>): LeverItem[] {
  const levers: LeverItem[] = []
  const mainPath: string[] = userContext?.systemDynamics?.mainPath || []
  const nodes: Array<{ id: string; title: string }> = userContext?.systemDynamics?.nodes || []

  const idToTitle = new Map(nodes.map(n => [n.id, n.title]))
  const pickTitle = (id: string) => idToTitle.get(id) || id

  if (mainPath.length > 0) {
    const first = mainPath[0]
    levers.push({
      id: first,
      title: pickTitle(first),
      impact: '打通主路径的首要瓶颈，最直接提升整体进度',
      nextAction: '专注完成该节点对应的最小练习'
    })
  }

  // Second lever: pick a later step or a node with no evidence placeholder
  const second = mainPath.find((id) => id !== levers[0]?.id)
  if (second) {
    levers.push({
      id: second,
      title: pickTitle(second),
      impact: '为后续关键步骤建立前置条件，降低学习阻力',
      nextAction: '阅读简短示例并完成 20 分钟检验题'
    })
  }

  return levers.slice(0, 2)
}

export interface CorePathItem { id: string; label: string; note?: string }

export function computeCorePath(userContext: Partial<UserContext>): CorePathItem[] {
  const mainPath: string[] = userContext?.systemDynamics?.mainPath || []
  const nodes: Array<{ id: string; title: string }> = userContext?.systemDynamics?.nodes || []
  const idToTitle = new Map(nodes.map(n => [n.id, n.title]))
  const items: CorePathItem[] = []
  for (const id of mainPath.slice(0, 5)) {
    items.push({ id, label: idToTitle.get(id) || id })
  }
  return items
}

