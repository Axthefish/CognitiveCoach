/**
 * 3D布局算法：力导向布局
 * 
 * 功能：计算框架节点的3D位置
 * - XZ平面：力导向布局（避免节点重叠，保持依赖关系）
 * - Y轴：权重映射高度（weight / 10）
 */

import type { FrameworkNode, FrameworkEdge, Node3DRenderData } from '@/lib/types-v2';

/**
 * 主函数：计算所有节点的3D位置
 */
export function calculateNode3DPositions(
  nodes: FrameworkNode[],
  edges: FrameworkEdge[]
): Node3DRenderData[] {
  // Phase 1: 力导向布局确定XZ平面位置
  const positions2D = forceDirectedLayout(nodes, edges);
  
  // Phase 2: 根据权重设置Y轴高度
  return nodes.map((node, i) => ({
    baseNode: node,
    position3D: {
      x: positions2D[i].x,
      y: node.weight / 10, // 0-100 → 0-10
      z: positions2D[i].z,
    },
    heightMultiplier: node.weight / 100,
    glowIntensity: node.weight / 100,
    relatedQuestionIds: [], // 后续由Stage 5-6填充
    isHighlighted: false,
    isSelected: false,
  }));
}

/**
 * 力导向布局算法（简化版）
 * 
 * 原理：
 * 1. 斥力：所有节点互相排斥（防止重叠）
 * 2. 引力：有边连接的节点相互吸引（保持关系）
 * 3. 迭代收敛：反复施加力直到达到平衡
 */
function forceDirectedLayout(
  nodes: FrameworkNode[],
  edges: FrameworkEdge[]
): Array<{ x: number; z: number }> {
  const nodeCount = nodes.length;
  const positions: Array<{ x: number; z: number }> = [];
  
  // 初始化：圆形分布（避免全部堆在一起）
  const radius = Math.max(5, nodeCount * 0.8);
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2;
    positions.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    });
  }
  
  // 力导向迭代
  const iterations = 100;
  const repulsionStrength = 2.0; // 斥力强度
  const attractionStrength = 0.08; // 引力强度
  const damping = 0.8; // 阻尼系数（防止震荡）
  
  // 速度数组（用于平滑移动）
  const velocities: Array<{ vx: number; vz: number }> = positions.map(() => ({ vx: 0, vz: 0 }));
  
  for (let iter = 0; iter < iterations; iter++) {
    // 衰减因子（随迭代次数降低力的强度）
    const decay = 1 - iter / iterations;
    
    // 1. 斥力：所有节点互相排斥
    for (let i = 0; i < nodeCount; i++) {
      let fx = 0;
      let fz = 0;
      
      for (let j = 0; j < nodeCount; j++) {
        if (i === j) continue;
        
        const dx = positions[j].x - positions[i].x;
        const dz = positions[j].z - positions[i].z;
        const distSq = dx * dx + dz * dz;
        const dist = Math.sqrt(distSq) || 0.01;
        
        // 库仑斥力：F = k / r^2
        const force = (repulsionStrength / distSq) * decay;
        fx -= (dx / dist) * force;
        fz -= (dz / dist) * force;
      }
      
      velocities[i].vx = (velocities[i].vx + fx) * damping;
      velocities[i].vz = (velocities[i].vz + fz) * damping;
    }
    
    // 2. 引力：有边连接的节点相互吸引
    edges.forEach(edge => {
      const fromIdx = nodes.findIndex(n => n.id === edge.from);
      const toIdx = nodes.findIndex(n => n.id === edge.to);
      
      if (fromIdx === -1 || toIdx === -1) return;
      
      const dx = positions[toIdx].x - positions[fromIdx].x;
      const dz = positions[toIdx].z - positions[fromIdx].z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
      
      // 胡克引力：F = k * distance * strength
      const force = attractionStrength * edge.strength * decay;
      const fx = (dx / dist) * force * dist;
      const fz = (dz / dist) * force * dist;
      
      velocities[fromIdx].vx += fx;
      velocities[fromIdx].vz += fz;
      velocities[toIdx].vx -= fx;
      velocities[toIdx].vz -= fz;
    });
    
    // 3. 应用速度
    for (let i = 0; i < nodeCount; i++) {
      positions[i].x += velocities[i].vx;
      positions[i].z += velocities[i].vz;
    }
    
    // 4. 居中（防止整体漂移）
    const centerX = positions.reduce((sum, p) => sum + p.x, 0) / nodeCount;
    const centerZ = positions.reduce((sum, p) => sum + p.z, 0) / nodeCount;
    positions.forEach(p => {
      p.x -= centerX;
      p.z -= centerZ;
    });
  }
  
  return positions;
}

/**
 * 工具函数：获取节点的颜色（基于权重）
 */
export function getColorFromWeight(weight: number): string {
  if (weight >= 90) return '#1e40af'; // 深蓝 - 核心必修
  if (weight >= 70) return '#3b82f6'; // 蓝色 - 重要推荐
  if (weight >= 50) return '#60a5fa'; // 浅蓝 - 可选增强
  return '#6b7280'; // 灰色 - 低优先级
}

/**
 * 工具函数：计算贝塞尔曲线的控制点
 * 
 * 用于绘制节点之间的连接线
 * 高度差越大，弧度越明显
 */
export function calculateBezierControlPoint(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  const midX = (from.x + to.x) / 2;
  const midZ = (from.z + to.z) / 2;
  
  // 高度差决定弧度
  const heightDiff = Math.abs(to.y - from.y);
  const arcHeight = Math.max(from.y, to.y) + heightDiff * 0.5;
  
  return {
    x: midX,
    y: arcHeight,
    z: midZ,
  };
}

