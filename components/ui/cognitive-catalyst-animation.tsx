'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CognitiveCatalystAnimationProps {
  userGoal: string;
  stage: string;
  onStageChange?: (stage: string) => void;
}

interface Particle {
  id: string;
  keyword: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  opacity: number;
  scale: number;
  phase: 'spawning' | 'expanding' | 'converging' | 'complete';
}

const ANIMATION_STAGES = [
  { id: 'parsing', message: '解析你的意图...', duration: 2000 },
  { id: 'extracting', message: '提取关键概念...', duration: 2500 },
  { id: 'constructing', message: '构建目标画像...', duration: 2000 },
] as const;

export function CognitiveCatalystAnimation({ 
  userGoal, 
  onStageChange 
}: Omit<CognitiveCatalystAnimationProps, 'stage'>) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [animationStage, setAnimationStage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastUpdateTimeRef = useRef<number>(0);
  const isPageVisibleRef = useRef<boolean>(true);

  // Safe requestAnimationFrame with polyfill
  const safeRequestAnimationFrame = useCallback((callback: (time: number) => void) => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      return window.requestAnimationFrame(callback);
    }
    // Fallback for older browsers
    return window.setTimeout(() => callback(Date.now()), 16);
  }, []);

  const safeCancelAnimationFrame = useCallback((id: number) => {
    if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(id);
    } else {
      window.clearTimeout(id);
    }
  }, []);

  // Extract keywords from user goal using simple NLP
  const extractKeywords = useCallback((text: string): string[] => {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set(['的', '是', '在', '有', '和', '与', '或', '但', '如果', '因为', '所以', '这', '那', '我', '你', '他', '她', '它', '们', '了', '着', '过', '把', '被', '让', '使', '给', '对', '向', '从', '到', '为', '以', '用', '由', '关于', 'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // Keep alphanumeric and Chinese characters
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word))
      .slice(0, 8); // Limit to 8 keywords for better visual effect
    
    return words.length > 0 ? words : ['学习', '目标', '成长', '进步'];
  }, []);

  // Initialize particles from keywords
  const initializeParticles = useCallback((): Particle[] => {
    const keywords = extractKeywords(userGoal);
    const centerX = 150; // Half of container width
    const centerY = 75;  // Half of container height
    
    return keywords.map((keyword, index) => ({
      id: `particle-${index}`,
      keyword,
      x: centerX,
      y: centerY,
      targetX: centerX + (Math.cos(index * 2 * Math.PI / keywords.length) * 60),
      targetY: centerY + (Math.sin(index * 2 * Math.PI / keywords.length) * 40),
      opacity: 0,
      scale: 0,
      phase: 'spawning'
    }));
  }, [userGoal, extractKeywords]);

  // Animation loop with performance optimizations
  const animate = useCallback((currentTime: number) => {
    // Skip animation if page is not visible
    if (!isPageVisibleRef.current) {
      animationRef.current = safeRequestAnimationFrame(animate);
      return;
    }

    // Throttle animation updates to ~60fps
    const deltaTime = currentTime - lastUpdateTimeRef.current;
    if (deltaTime < 16) { // ~60fps
      animationRef.current = safeRequestAnimationFrame(animate);
      return;
    }
    
    lastUpdateTimeRef.current = currentTime;

    setParticles(prevParticles => {
      let hasChanges = false;
      
      const newParticles = prevParticles.map(particle => {
        if (particle.phase === 'complete') {
          return particle; // Skip completed particles
        }

        const { phase } = particle;
        const newParticle = { ...particle };

        switch (phase) {
          case 'spawning':
            // Fade in and scale up
            newParticle.opacity = Math.min(1, particle.opacity + 0.05);
            newParticle.scale = Math.min(1, particle.scale + 0.08);
            if (newParticle.opacity >= 1 && newParticle.scale >= 1) {
              newParticle.phase = 'expanding';
            }
            hasChanges = true;
            break;

          case 'expanding':
            // Move to target position
            const dx = particle.targetX - particle.x;
            const dy = particle.targetY - particle.y;
            newParticle.x += dx * 0.1;
            newParticle.y += dy * 0.1;
            
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
              newParticle.phase = 'converging';
              // Set new target back to center
              newParticle.targetX = 150;
              newParticle.targetY = 75;
            }
            hasChanges = true;
            break;

          case 'converging':
            // Move back to center
            const cdx = particle.targetX - particle.x;
            const cdy = particle.targetY - particle.y;
            newParticle.x += cdx * 0.15;
            newParticle.y += cdy * 0.15;
            newParticle.opacity = Math.max(0, particle.opacity - 0.03);
            newParticle.scale = Math.max(0, particle.scale - 0.05);
            
            if (newParticle.opacity <= 0) {
              newParticle.phase = 'complete';
            }
            hasChanges = true;
            break;
        }

        return newParticle;
      });

      // Only update state if there are actual changes
      return hasChanges ? newParticles : prevParticles;
    });

    // Continue animation loop if still animating
    if (isAnimating) {
      animationRef.current = safeRequestAnimationFrame(animate);
    }
  }, [isAnimating, safeRequestAnimationFrame]);

  // Stage progression
  useEffect(() => {
    if (!isAnimating) return;

    const stageTimer = setTimeout(() => {
      if (animationStage < ANIMATION_STAGES.length - 1) {
        const nextStage = animationStage + 1;
        setAnimationStage(nextStage);
        onStageChange?.(ANIMATION_STAGES[nextStage].message);
      } else {
        setIsAnimating(false);
      }
    }, ANIMATION_STAGES[animationStage].duration);

    return () => clearTimeout(stageTimer);
  }, [animationStage, isAnimating, onStageChange]);



  // Page visibility change handler for performance optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, []);

  // Initialize animation
  useEffect(() => {
    const particles = initializeParticles();
    setParticles(particles);
    
    // Start animation loop
    animationRef.current = safeRequestAnimationFrame(animate);
    
    // Notify initial stage
    onStageChange?.(ANIMATION_STAGES[0].message);

    return () => {
      if (animationRef.current !== undefined) {
        safeCancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [userGoal, animate, initializeParticles, onStageChange, safeRequestAnimationFrame, safeCancelAnimationFrame]); // Re-initialize when userGoal changes

  // Stop animation when component unmounts or animation completes
  useEffect(() => {
    if (!isAnimating && animationRef.current !== undefined) {
      safeCancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  }, [isAnimating, safeCancelAnimationFrame]);

  const currentStageInfo = ANIMATION_STAGES[animationStage];

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Main goal text - central focus */}
      <div className="text-center mb-6">
        <div className="text-lg font-medium text-gray-800 dark:text-gray-200 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          {userGoal.slice(0, 60)}{userGoal.length > 60 ? '...' : ''}
        </div>
      </div>

      {/* Particle animation container */}
      <div 
        ref={containerRef}
        className="relative w-[300px] h-[150px] mx-auto overflow-hidden"
      >
        {/* Central pulse effect */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse opacity-60" />
          <div className="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping" />
        </div>

        {/* Particle elements */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute will-change-transform"
            style={{
              opacity: particle.opacity,
              transform: `translate(${particle.x - 150}px, ${particle.y - 75}px) scale(${particle.scale})`,
              transformOrigin: 'center center',
            }}
          >
            <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium rounded-full shadow-lg">
              {particle.keyword}
            </div>
          </div>
        ))}
      </div>

      {/* Stage indicator */}
      <div className="text-center mt-6">
        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
          {currentStageInfo.message}
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center space-x-2">
          {ANIMATION_STAGES.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === animationStage
                  ? 'bg-blue-500 scale-125'
                  : index < animationStage
                  ? 'bg-blue-300'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
