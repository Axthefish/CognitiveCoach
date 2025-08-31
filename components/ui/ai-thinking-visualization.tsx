'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Lightbulb, Target, Sparkles, Zap, Search, Filter } from 'lucide-react';

interface ThoughtBubble {
  id: string;
  text: string;
  icon: React.ReactNode;
  position: { x: number; y: number };
  opacity: number;
  scale: number;
}

interface AIThinkingVisualizationProps {
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  userGoal?: string;
  isThinking: boolean;
}

export function AIThinkingVisualization({ stage, userGoal, isThinking }: AIThinkingVisualizationProps) {
  const [thoughtBubbles, setThoughtBubbles] = useState<ThoughtBubble[]>([]);
  const [currentThought, setCurrentThought] = useState('');
  const [brainPulse, setBrainPulse] = useState(0);

  // Stage-specific thought patterns
  const thoughtPatterns = {
    S0: [
      { text: '理解核心意图...', icon: <Target className="w-3 h-3" /> },
      { text: '识别关键概念...', icon: <Search className="w-3 h-3" /> },
      { text: '分析可行路径...', icon: <Filter className="w-3 h-3" /> },
      { text: '构建清晰目标...', icon: <Lightbulb className="w-3 h-3" /> }
    ],
    S1: [
      { text: '搜索知识库...', icon: <Brain className="w-3 h-3" /> },
      { text: '建立概念联系...', icon: <Zap className="w-3 h-3" /> },
      { text: '构建知识框架...', icon: <Sparkles className="w-3 h-3" /> }
    ],
    S2: [
      { text: '分析系统要素...', icon: <Brain className="w-3 h-3" /> },
      { text: '发现关键杠杆...', icon: <Target className="w-3 h-3" /> },
      { text: '建模因果关系...', icon: <Zap className="w-3 h-3" /> }
    ],
    S3: [
      { text: '规划行动步骤...', icon: <Target className="w-3 h-3" /> },
      { text: '评估资源需求...', icon: <Filter className="w-3 h-3" /> },
      { text: '设计检查点...', icon: <Lightbulb className="w-3 h-3" /> }
    ],
    S4: [
      { text: '分析执行情况...', icon: <Search className="w-3 h-3" /> },
      { text: '识别改进空间...', icon: <Sparkles className="w-3 h-3" /> },
      { text: '优化下一步...', icon: <Target className="w-3 h-3" /> }
    ]
  };

  const thoughts = thoughtPatterns[stage] || thoughtPatterns.S0;

  // Generate floating thought bubbles
  useEffect(() => {
    if (!isThinking) {
      setThoughtBubbles([]);
      return;
    }

    const interval = setInterval(() => {
      const thoughtIndex = Math.floor(Math.random() * thoughts.length);
      const thought = thoughts[thoughtIndex];
      
      const newBubble: ThoughtBubble = {
        id: Date.now().toString(),
        text: thought.text,
        icon: thought.icon,
        position: {
          x: Math.random() * 80 + 10, // 10% to 90% width
          y: Math.random() * 60 + 20  // 20% to 80% height
        },
        opacity: 0,
        scale: 0
      };

      setThoughtBubbles(prev => [...prev, newBubble]);

      // Remove old bubbles
      setTimeout(() => {
        setThoughtBubbles(prev => prev.filter(b => b.id !== newBubble.id));
      }, 3000);
    }, 1500);

    return () => clearInterval(interval);
  }, [isThinking, thoughts]);

  // Animate bubbles
  useEffect(() => {
    const animationInterval = setInterval(() => {
      setThoughtBubbles(prev => prev.map(bubble => {
        // Fade in
        if (bubble.opacity < 1) {
          return {
            ...bubble,
            opacity: Math.min(1, bubble.opacity + 0.1),
            scale: Math.min(1, bubble.scale + 0.1)
          };
        }
        // Fade out after 2 seconds
        return {
          ...bubble,
          opacity: Math.max(0, bubble.opacity - 0.05),
          scale: Math.max(0, bubble.scale - 0.02)
        };
      }));
    }, 50);

    return () => clearInterval(animationInterval);
  }, []);

  // Brain pulse animation
  useEffect(() => {
    if (!isThinking) return;

    const pulseInterval = setInterval(() => {
      setBrainPulse(prev => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(pulseInterval);
  }, [isThinking]);

  // Update current thought
  useEffect(() => {
    if (!isThinking) {
      setCurrentThought('');
      return;
    }

    let thoughtIndex = 0;
    const thoughtInterval = setInterval(() => {
      setCurrentThought(thoughts[thoughtIndex].text);
      thoughtIndex = (thoughtIndex + 1) % thoughts.length;
    }, 2000);

    // Set initial thought
    setCurrentThought(thoughts[0].text);

    return () => clearInterval(thoughtInterval);
  }, [isThinking, thoughts]);

  if (!isThinking) return null;

  return (
    <div className="relative w-full h-64">
      {/* Central AI brain */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          {/* Pulse rings */}
          {[0, 1, 2].map((ring) => (
            <div
              key={ring}
              className={`absolute inset-0 rounded-full border-2 border-blue-400/30 ${
                brainPulse === ring ? 'animate-ping' : ''
              }`}
              style={{
                transform: `scale(${1 + ring * 0.3})`,
                animationDelay: `${ring * 0.2}s`
              }}
            />
          ))}
          
          {/* Brain icon */}
          <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <Brain className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>
      </div>

      {/* Floating thought bubbles */}
      {thoughtBubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="absolute"
          style={{
            left: `${bubble.position.x}%`,
            top: `${bubble.position.y}%`,
            opacity: bubble.opacity,
            transform: `translate(-50%, -50%) scale(${bubble.scale})`
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md px-3 py-2 flex items-center space-x-2 text-xs">
            <span className="text-blue-500">{bubble.icon}</span>
            <span className="text-gray-700 dark:text-gray-300">{bubble.text}</span>
          </div>
        </div>
      ))}

      {/* Current thought display */}
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 rounded-full px-4 py-2">
          <div className="flex space-x-1">
            {[0, 1, 2].map((dot) => (
              <div
                key={dot}
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: `${dot * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {currentThought}
          </span>
        </div>
      </div>

      {/* User goal context */}
      {userGoal && (
        <div className="absolute top-0 left-0 right-0">
          <div className="text-center">
            <div className="inline-block bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1 text-xs text-gray-600 dark:text-gray-400">
              目标: {userGoal.slice(0, 50)}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
