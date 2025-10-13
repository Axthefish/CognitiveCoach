/**
 * Export Utils - 导出功能工具
 * 
 * 支持导出为：
 * - JSON
 * - Markdown
 */

import type { PersonalizedPlan, UniversalFramework } from './types-v2';
import { logger } from './logger';

// ============================================
// JSON导出
// ============================================

/**
 * 导出个性化方案为JSON
 */
export function exportPlanAsJSON(plan: PersonalizedPlan): void {
  try {
    const blob = new Blob(
      [JSON.stringify(plan, null, 2)],
      { type: 'application/json' }
    );
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognitive-coach-plan-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logger.info('[Export] Plan exported as JSON');
  } catch (error) {
    logger.error('[Export] Failed to export JSON', { error });
    throw new Error('导出失败，请重试');
  }
}

/**
 * 导出框架为JSON
 */
export function exportFrameworkAsJSON(framework: UniversalFramework): void {
  try {
    const blob = new Blob(
      [JSON.stringify(framework, null, 2)],
      { type: 'application/json' }
    );
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framework-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logger.info('[Export] Framework exported as JSON');
  } catch (error) {
    logger.error('[Export] Failed to export JSON', { error });
    throw new Error('导出失败，请重试');
  }
}

// ============================================
// Markdown导出
// ============================================

/**
 * 导出通用框架为Markdown
 */
export function exportFrameworkAsMarkdown(framework: UniversalFramework): void {
  try {
    const markdown = generateFrameworkMarkdown(framework);
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framework-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logger.info('[Export] Framework exported as Markdown');
  } catch (error) {
    logger.error('[Export] Failed to export Markdown', { error });
    throw new Error('导出失败，请重试');
  }
}

/**
 * 生成框架Markdown内容
 */
function generateFrameworkMarkdown(framework: UniversalFramework): string {
  let markdown = `# ${framework.purpose}\n\n`;
  markdown += `**问题域**: ${framework.domain}\n\n`;
  markdown += `**生成时间**: ${new Date(framework.generatedAt).toLocaleString('zh-CN')}\n\n`;
  markdown += `**框架说明**: ${framework.weightingLogic}\n\n`;
  markdown += `---\n\n`;
  
  // 权重分布统计
  const coreCount = framework.nodes.filter(n => n.weight >= 90).length;
  const importantCount = framework.nodes.filter(n => n.weight >= 70 && n.weight < 90).length;
  const optionalCount = framework.nodes.filter(n => n.weight >= 50 && n.weight < 70).length;
  const lowCount = framework.nodes.filter(n => n.weight < 50).length;
  
  markdown += `## 📊 权重分布\n\n`;
  markdown += `- 🔴 核心必修 (90-100%): ${coreCount}个\n`;
  markdown += `- 🔵 重要推荐 (70-89%): ${importantCount}个\n`;
  markdown += `- 🟦 可选增强 (50-69%): ${optionalCount}个\n`;
  if (lowCount > 0) {
    markdown += `- ⚪️ 低优先级 (<50%): ${lowCount}个\n`;
  }
  markdown += `\n---\n\n`;
  
  // 关键路径
  markdown += `## 🎯 关键路径\n\n`;
  markdown += `以下是从起点到目标的最短必经路径：\n\n`;
  framework.mainPath.forEach((nodeId, index) => {
    const node = framework.nodes.find(n => n.id === nodeId);
    if (node) {
      markdown += `${index + 1}. **${node.title}** (${node.weight}%)\n`;
    }
  });
  markdown += `\n---\n\n`;
  
  // 所有节点（按权重排序）
  markdown += `## 📚 完整框架\n\n`;
  
  const sortedNodes = [...framework.nodes].sort((a, b) => b.weight - a.weight);
  
  // 核心必修
  const coreNodes = sortedNodes.filter(n => n.weight >= 90);
  if (coreNodes.length > 0) {
    markdown += `### 🔴 核心必修 (90-100%)\n\n`;
    coreNodes.forEach(node => {
      markdown += `#### ${node.title} (${node.weight}%)\n\n`;
      markdown += `${node.description}\n\n`;
      markdown += `- **预计时间**: ${node.estimatedTime}\n`;
      if (node.dependencies.length > 0) {
        const depNames = node.dependencies
          .map(depId => framework.nodes.find(n => n.id === depId)?.title || depId)
          .join(', ');
        markdown += `- **前置依赖**: ${depNames}\n`;
      }
      if (node.weightBreakdown && 'reasoning' in node.weightBreakdown) {
        markdown += `- **权重依据**: ${node.weightBreakdown.reasoning || '见权重分析'}\n`;
      }
      markdown += `\n`;
    });
  }
  
  // 重要推荐
  const importantNodes = sortedNodes.filter(n => n.weight >= 70 && n.weight < 90);
  if (importantNodes.length > 0) {
    markdown += `### 🔵 重要推荐 (70-89%)\n\n`;
    importantNodes.forEach(node => {
      markdown += `#### ${node.title} (${node.weight}%)\n\n`;
      markdown += `${node.description}\n\n`;
      markdown += `- **预计时间**: ${node.estimatedTime}\n`;
      if (node.dependencies.length > 0) {
        const depNames = node.dependencies
          .map(depId => framework.nodes.find(n => n.id === depId)?.title || depId)
          .join(', ');
        markdown += `- **前置依赖**: ${depNames}\n`;
      }
      markdown += `\n`;
    });
  }
  
  // 可选增强
  const optionalNodes = sortedNodes.filter(n => n.weight >= 50 && n.weight < 70);
  if (optionalNodes.length > 0) {
    markdown += `### 🟦 可选增强 (50-69%)\n\n`;
    optionalNodes.forEach(node => {
      markdown += `#### ${node.title} (${node.weight}%)\n\n`;
      markdown += `${node.description}\n\n`;
      markdown += `- **预计时间**: ${node.estimatedTime}\n\n`;
    });
  }
  
  markdown += `---\n\n`;
  markdown += `*由 CognitiveCoach 生成的通用框架*\n`;
  markdown += `*这是基于问题域的标准路径，可根据个人情况调整*\n`;
  
  return markdown;
}

/**
 * 导出个性化方案为Markdown
 */
export function exportPlanAsMarkdown(plan: PersonalizedPlan): void {
  try {
    const markdown = generatePlanMarkdown(plan);
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognitive-coach-plan-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logger.info('[Export] Plan exported as Markdown');
  } catch (error) {
    logger.error('[Export] Failed to export Markdown', { error });
    throw new Error('导出失败，请重试');
  }
}

/**
 * 生成Markdown内容
 */
function generatePlanMarkdown(plan: PersonalizedPlan): string {
  const { adjustedFramework, actionSteps, milestones, personalizedTips, adjustmentRationale } = plan;
  
  let markdown = `# ${adjustedFramework.purpose}\n\n`;
  markdown += `**问题域**: ${adjustedFramework.domain}\n\n`;
  markdown += `**生成时间**: ${new Date(plan.generatedAt).toLocaleString('zh-CN')}\n\n`;
  markdown += `---\n\n`;
  
  // 调整说明
  markdown += `## 📊 调整说明\n\n`;
  markdown += `${adjustmentRationale}\n\n`;
  markdown += `---\n\n`;
  
  // 框架概览
  markdown += `## 🗺️ 框架概览\n\n`;
  markdown += `${adjustedFramework.weightingLogic}\n\n`;
  
  // 核心节点
  const coreNodes = adjustedFramework.nodes.filter(n => n.weight >= 90);
  if (coreNodes.length > 0) {
    markdown += `### 核心必修模块（90-100%）\n\n`;
    coreNodes.forEach(node => {
      markdown += `- **${node.title}** (${node.weight}%)\n`;
      markdown += `  - ${node.description}\n`;
      markdown += `  - 预计时间: ${node.estimatedTime}\n\n`;
    });
  }
  
  // 重要节点
  const importantNodes = adjustedFramework.nodes.filter(n => n.weight >= 70 && n.weight < 90);
  if (importantNodes.length > 0) {
    markdown += `### 重要推荐模块（70-89%）\n\n`;
    importantNodes.forEach(node => {
      markdown += `- **${node.title}** (${node.weight}%)\n`;
      markdown += `  - ${node.description}\n`;
      markdown += `  - 预计时间: ${node.estimatedTime}\n\n`;
    });
  }
  
  markdown += `---\n\n`;
  
  // 行动步骤
  markdown += `## 📋 行动步骤\n\n`;
  
  const sortedSteps = [...actionSteps].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  sortedSteps.forEach((step, index) => {
    const priorityEmoji = step.priority === 'high' ? '🔴' : step.priority === 'medium' ? '🟡' : '🟢';
    markdown += `### ${index + 1}. ${step.title} ${priorityEmoji}\n\n`;
    markdown += `**描述**: ${step.description}\n\n`;
    markdown += `**时间**: ${step.startTime} - ${step.endTime}\n\n`;
    markdown += `**优先级**: ${step.priority === 'high' ? '高' : step.priority === 'medium' ? '中' : '低'}\n\n`;
    
    if (step.prerequisites.length > 0) {
      markdown += `**前置条件**: ${step.prerequisites.join(', ')}\n\n`;
    }
  });
  
  markdown += `---\n\n`;
  
  // 里程碑
  if (milestones.length > 0) {
    markdown += `## 🎯 里程碑\n\n`;
    
    milestones.forEach((milestone, index) => {
      markdown += `### ${index + 1}. ${milestone.title}\n\n`;
      markdown += `**预期时间**: ${milestone.expectedTime}\n\n`;
      markdown += `**成功标准**:\n\n`;
      
      milestone.successCriteria.forEach(criteria => {
        markdown += `- ✓ ${criteria}\n`;
      });
      
      markdown += `\n`;
    });
    
    markdown += `---\n\n`;
  }
  
  // 个性化建议
  if (personalizedTips.length > 0) {
    markdown += `## 💡 个性化建议\n\n`;
    
    personalizedTips.forEach(tip => {
      markdown += `- ${tip}\n`;
    });
    
    markdown += `\n---\n\n`;
  }
  
  // 脚注
  markdown += `*由 CognitiveCoach 生成* | [cognitivecoach.ai](https://cognitivecoach.ai)\n`;
  
  return markdown;
}

// ============================================
// 复制到剪贴板
// ============================================

/**
 * 复制方案摘要到剪贴板
 */
export async function copyPlanSummary(plan: PersonalizedPlan): Promise<void> {
  try {
    const summary = `
目的: ${plan.adjustedFramework.purpose}
核心步骤: ${plan.actionSteps.length}个
里程碑: ${plan.milestones.length}个

${plan.actionSteps.slice(0, 3).map((step, i) => 
  `${i + 1}. ${step.title}`
).join('\n')}

${plan.actionSteps.length > 3 ? `... 还有${plan.actionSteps.length - 3}个步骤` : ''}
    `.trim();
    
    await navigator.clipboard.writeText(summary);
    logger.info('[Export] Plan summary copied to clipboard');
  } catch (error) {
    logger.error('[Export] Failed to copy to clipboard', { error });
    throw new Error('复制失败，请重试');
  }
}

// ============================================
// 打印优化
// ============================================

/**
 * 触发打印预览
 */
export function printPlan(): void {
  try {
    // 添加打印样式类
    document.body.classList.add('printing');
    
    // 触发打印
    window.print();
    
    // 移除打印样式类
    setTimeout(() => {
      document.body.classList.remove('printing');
    }, 1000);
    
    logger.info('[Export] Print triggered');
  } catch (error) {
    logger.error('[Export] Failed to print', { error });
    throw new Error('打印失败，请重试');
  }
}

