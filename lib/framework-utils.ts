/**
 * 框架处理工具函数集合
 * 
 * 职责：
 * - 框架格式化和转换
 * - 框架节点提取和遍历
 * - 框架完整性验证
 * - 框架统计信息
 * 
 * 使用场景：
 * - Prompt构建时格式化框架描述
 * - QA检查时提取节点ID
 * - 跨阶段数据传递时验证完整性
 */

import type { KnowledgeFramework, FrameworkNode } from './schemas';

/**
 * 格式化知识框架为文本描述
 * 
 * 将结构化的知识框架转换为易读的文本格式，用于AI Prompt中。
 * 格式：父节点标题：摘要\n  - 子节点标题：摘要
 * 
 * @param framework - 知识框架数组
 * @returns 格式化的文本描述
 * 
 * @example
 * ```typescript
 * const description = formatFrameworkDescription([
 *   { id: 'react-basics', title: 'React基础', summary: '学习核心概念',
 *     children: [
 *       { id: 'jsx', title: 'JSX语法', summary: 'React的模板语法' }
 *     ]
 *   }
 * ]);
 * // 输出：
 * // React基础: 学习核心概念
 * //   - JSX语法: React的模板语法
 * ```
 */
export function formatFrameworkDescription(framework: KnowledgeFramework): string {
  return framework
    .map((node) => {
      const childrenDesc =
        node.children
          ?.map((child) => `  - ${child.title}: ${child.summary}`)
          .join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    })
    .join('\n\n');
}

/**
 * 提取框架中的所有节点ID
 * 
 * 递归遍历框架树，收集所有节点的ID。
 * 用于QA覆盖率检查，确保后续阶段引用的节点都存在。
 * 
 * @param framework - 知识框架数组或单个节点
 * @returns 所有节点ID的数组
 * 
 * @example
 * ```typescript
 * const ids = extractFrameworkIds(framework);
 * // ['react-basics', 'jsx', 'components', 'hooks']
 * ```
 */
export function extractFrameworkIds(framework: KnowledgeFramework | FrameworkNode): string[] {
  const ids: string[] = [];
  
  const walk = (node: FrameworkNode) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.id === 'string') ids.push(node.id);
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };
  
  if (Array.isArray(framework)) {
    framework.forEach(walk);
  } else {
    walk(framework);
  }
  
  return ids;
}

/**
 * 提取框架节点信息（ID + Title）
 * 
 * 遍历框架树，提取每个节点的ID和标题。
 * S2阶段用于生成系统动力学图时引用节点信息。
 * 
 * @param framework - 知识框架数组
 * @returns 包含id和title的节点信息数组
 * 
 * @example
 * ```typescript
 * const nodes = extractNodesFromFramework(framework);
 * // [{ id: 'react-basics', title: 'React基础' }, ...]
 * ```
 */
export function extractNodesFromFramework(
  framework: KnowledgeFramework
): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  
  const walk = (node: FrameworkNode) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.id === 'string') {
      out.push({
        id: node.id,
        title: typeof node.title === 'string' ? node.title : node.id,
      });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };
  
  framework.forEach(walk);
  return out;
}

/**
 * 验证框架完整性
 * 
 * 检查框架结构是否完整，所有必需字段（id、title、summary）是否存在。
 * 用于在Service层接收AI输出后进行初步验证。
 * 
 * @param framework - 待验证的知识框架
 * @returns 验证结果对象，包含是否有效和问题列表
 * 
 * @example
 * ```typescript
 * const result = validateFrameworkIntegrity(framework);
 * if (!result.valid) {
 *   console.error('Framework issues:', result.issues);
 * }
 * ```
 */
export function validateFrameworkIntegrity(framework: KnowledgeFramework): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!Array.isArray(framework)) {
    issues.push('Framework must be an array');
    return { valid: false, issues };
  }
  
  if (framework.length === 0) {
    issues.push('Framework cannot be empty');
    return { valid: false, issues };
  }
  
  const walk = (node: FrameworkNode, path: string) => {
    if (!node.id) {
      issues.push(`Missing id at ${path}`);
    }
    if (!node.title) {
      issues.push(`Missing title at ${path}`);
    }
    if (!node.summary) {
      issues.push(`Missing summary at ${path}`);
    }
    
    if (node.children) {
      node.children.forEach((child, index) => {
        walk(child, `${path}.children[${index}]`);
      });
    }
  };
  
  framework.forEach((node, index) => {
    walk(node, `framework[${index}]`);
  });
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * 计算框架的总节点数
 * 
 * 递归统计框架中所有节点的数量（包括子节点）。
 * 用于评估框架复杂度和生成统计信息。
 * 
 * @param framework - 知识框架数组
 * @returns 总节点数
 * 
 * @example
 * ```typescript
 * const nodeCount = countFrameworkNodes(framework);
 * console.log(`Framework contains ${nodeCount} nodes`);
 * ```
 */
export function countFrameworkNodes(framework: KnowledgeFramework): number {
  let count = 0;
  
  const walk = (node: FrameworkNode) => {
    count++;
    if (node.children) {
      node.children.forEach(walk);
    }
  };
  
  framework.forEach(walk);
  return count;
}

