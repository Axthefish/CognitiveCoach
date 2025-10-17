'use client';

/**
 * WeightTerrain3D: 主3D可视化组件
 * 
 * 核心功能：
 * - 渲染框架节点为3D球体（高度 = 权重）
 * - 渲染节点间的连接线（贝塞尔曲线）
 * - 支持交互：hover、click、拖拽旋转
 * - 支持Stage 5-6的高亮功能
 */

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import type { WeightTerrain3DProps, Node3DMeshProps, EdgeLineProps } from './types';
import { calculateNode3DPositions, getColorFromWeight, calculateBezierControlPoint } from './layout-algorithm';

/**
 * 主组件
 */
export const WeightTerrain3D: React.FC<WeightTerrain3DProps> = ({
  framework,
  questions,
  onNodeSelect,
  highlightedQuestionIds = [],
  config = {},
  className,
}) => {
  // 计算节点3D位置
  const node3DData = useMemo(() => {
    const baseData = calculateNode3DPositions(framework.nodes, framework.edges);
    
    // 如果有questions，关联问题ID到节点
    if (questions) {
      questions.forEach(q => {
        q.affects.forEach(nodeId => {
          const nodeData = baseData.find(n => n.baseNode.id === nodeId);
          if (nodeData) {
            nodeData.relatedQuestionIds = nodeData.relatedQuestionIds || [];
            nodeData.relatedQuestionIds.push(q.id);
          }
        });
      });
    }
    
    return baseData;
  }, [framework, questions]);

  return (
    <div className={cn("w-full h-full bg-black/90", className)}>
      <Canvas>
        {/* 相机 */}
        <PerspectiveCamera makeDefault position={[8, 8, 8]} />
        
        {/* 轨道控制器 */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          autoRotate={config.autoRotate ?? true}
          autoRotateSpeed={config.rotationSpeed ?? 0.5}
          minDistance={5}
          maxDistance={30}
        />
        
        {/* 光照 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#3b82f6" />
        <pointLight position={[10, -10, 5]} intensity={0.3} color="#60a5fa" />
        
        {/* 网格（可选） */}
        {config.showGrid && (
          <gridHelper args={[20, 20, '#1e40af', '#111827']} position={[0, 0, 0]} />
        )}
        
        {/* 渲染节点 */}
        {node3DData.map(nodeData => {
          const isHighlighted = highlightedQuestionIds.length > 0 && 
            nodeData.relatedQuestionIds?.some(qId => highlightedQuestionIds.includes(qId));
          
          return (
            <Node3DMesh
              key={nodeData.baseNode.id}
              data={nodeData}
              isHighlighted={isHighlighted}
              onSelect={() => onNodeSelect?.(nodeData.baseNode.id)}
            />
          );
        })}
        
        {/* 渲染连接线 */}
        {framework.edges.map((edge, i) => {
          const fromNode = node3DData.find(n => n.baseNode.id === edge.from);
          const toNode = node3DData.find(n => n.baseNode.id === edge.to);
          
          if (!fromNode || !toNode) return null;
          
          return (
            <EdgeLine
              key={`edge-${i}-${edge.from}-${edge.to}`}
              edge={edge}
              fromNode={fromNode}
              toNode={toNode}
            />
          );
        })}
        
        {/* 环境雾化 */}
        <fog attach="fog" args={['#000000', 15, 40]} />
      </Canvas>
    </div>
  );
};

/**
 * Node3DMesh: 3D节点渲染
 */
const Node3DMesh: React.FC<Node3DMeshProps> = ({ data, isHighlighted = false, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // 呼吸动画
  useFrame((state) => {
    if (meshRef.current) {
      const phase = state.clock.elapsedTime * 1.5 + data.baseNode.weight * 0.1;
      const scale = 1 + Math.sin(phase) * 0.08;
      meshRef.current.scale.setScalar(scale);
    }
  });
  
  const color = getColorFromWeight(data.baseNode.weight);
  const position = data.position3D;
  const radius = 0.4 + data.baseNode.weight * 0.003; // 权重越高，球体越大
  
  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 主球体 */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <icosahedronGeometry args={[radius, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHighlighted ? 0.9 : (hovered ? 0.6 : 0.3)}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      
      {/* 外层光晕（hover或highlight时） */}
      {(hovered || isHighlighted) && (
        <mesh scale={1.5}>
          <sphereGeometry args={[radius, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={isHighlighted ? 0.3 : 0.2}
            side={THREE.BackSide}
          />
        </mesh>
      )}
      
      {/* 节点标题（hover时显示） */}
      {hovered && (
        <Text
          position={[0, radius + 0.5, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {data.baseNode.title}
        </Text>
      )}
      
      {/* 权重标签 */}
      <Text
        position={[0, -radius - 0.3, 0]}
        fontSize={0.2}
        color="#60a5fa"
        anchorX="center"
        anchorY="top"
      >
        {data.baseNode.weight}%
      </Text>
    </group>
  );
};

/**
 * EdgeLine: 边连接线渲染
 */
const EdgeLine: React.FC<EdgeLineProps> = ({ edge, fromNode, toNode }) => {
  // 计算贝塞尔曲线和几何体
  const { curve, geometry } = useMemo(() => {
    if (!fromNode || !toNode) {
      return { curve: null, geometry: null };
    }
    
    const from = fromNode.position3D;
    const to = toNode.position3D;
    const control = calculateBezierControlPoint(from, to);
    
    const c = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(control.x, control.y, control.z),
      new THREE.Vector3(to.x, to.y, to.z)
    );
    
    const points = c.getPoints(50);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    
    return { curve: c, geometry: geom };
  }, [fromNode, toNode]);
  
  if (!curve || !geometry) return null;
  
  // 根据edge类型确定颜色和透明度
  const lineColor = edge.type === 'required' ? '#3b82f6' : 
                    edge.type === 'recommended' ? '#60a5fa' : 
                    '#6b7280';
  const opacity = edge.strength * 0.6;
  
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial
        color={lineColor}
        transparent
        opacity={opacity}
      />
    </line>
  );
};

