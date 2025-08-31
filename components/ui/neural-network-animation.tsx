'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface NeuralNetworkAnimationProps {
  isActive: boolean;
  message?: string;
  stage?: 'parsing' | 'analyzing' | 'synthesizing';
}

interface Neuron {
  id: string;
  x: number;
  y: number;
  layer: number;
  activated: boolean;
  pulsePhase: number;
}

interface Synapse {
  id: string;
  source: string;
  target: string;
  activated: boolean;
  progress: number;
}

export function NeuralNetworkAnimation({ 
  isActive, 
  message = '正在思考中...',
  stage = 'parsing' 
}: NeuralNetworkAnimationProps) {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [synapses, setSynapses] = useState<Synapse[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Initialize neural network structure
  const initializeNetwork = useCallback(() => {
    const layers = [3, 5, 4, 2]; // Network architecture
    const neuronList: Neuron[] = [];
    const synapseList: Synapse[] = [];
    
    // Create neurons
    layers.forEach((count, layerIndex) => {
      const layerWidth = 250;
      const layerHeight = 200;
      const xOffset = (layerIndex + 1) * (layerWidth / (layers.length + 1));
      
      for (let i = 0; i < count; i++) {
        const yOffset = (i + 1) * (layerHeight / (count + 1));
        neuronList.push({
          id: `n-${layerIndex}-${i}`,
          x: xOffset,
          y: yOffset,
          layer: layerIndex,
          activated: false,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    });

    // Create synapses between adjacent layers
    for (let l = 0; l < layers.length - 1; l++) {
      const currentLayer = neuronList.filter(n => n.layer === l);
      const nextLayer = neuronList.filter(n => n.layer === l + 1);
      
      currentLayer.forEach(source => {
        // Connect to 2-3 random neurons in next layer
        const connections = Math.floor(Math.random() * 2) + 2;
        const targets = [...nextLayer].sort(() => Math.random() - 0.5).slice(0, connections);
        
        targets.forEach(target => {
          synapseList.push({
            id: `s-${source.id}-${target.id}`,
            source: source.id,
            target: target.id,
            activated: false,
            progress: 0
          });
        });
      });
    }

    setNeurons(neuronList);
    setSynapses(synapseList);
  }, []);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!canvasRef.current || !isActive) return;

    const deltaTime = timestamp - timeRef.current;
    timeRef.current = timestamp;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw synapses
    synapses.forEach((synapse) => {
      const source = neurons.find(n => n.id === synapse.source);
      const target = neurons.find(n => n.id === synapse.target);
      
      if (!source || !target) return;

      // Activate synapses based on stage
      const activationChance = stage === 'synthesizing' ? 0.3 : stage === 'analyzing' ? 0.2 : 0.1;
      if (Math.random() < activationChance * (deltaTime / 1000)) {
        synapse.activated = true;
        synapse.progress = 0;
      }

      if (synapse.activated) {
        synapse.progress += deltaTime / 500; // 500ms for full traversal
        if (synapse.progress >= 1) {
          synapse.activated = false;
          synapse.progress = 0;
          // Activate target neuron
          const targetNeuron = neurons.find(n => n.id === synapse.target);
          if (targetNeuron) {
            targetNeuron.activated = true;
          }
        }
      }

      // Draw synapse
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      
      if (synapse.activated) {
        // Draw activated synapse with gradient
        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
        gradient.addColorStop(Math.max(0, synapse.progress - 0.1), 'rgba(59, 130, 246, 0)');
        gradient.addColorStop(synapse.progress, 'rgba(59, 130, 246, 0.8)');
        gradient.addColorStop(Math.min(1, synapse.progress + 0.1), 'rgba(59, 130, 246, 0)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
        ctx.lineWidth = 1;
      }
      
      ctx.stroke();
    });

    // Update and draw neurons
    neurons.forEach((neuron) => {
      // Update pulse phase
      neuron.pulsePhase += deltaTime / 1000;

      // Deactivate neurons over time
      if (neuron.activated && Math.random() < 0.05) {
        neuron.activated = false;
      }

      // Draw neuron
      const baseRadius = 4;
      const pulseRadius = neuron.activated ? 2 * Math.sin(neuron.pulsePhase * 2) : 0;
      const radius = baseRadius + pulseRadius;

      // Glow effect for activated neurons
      if (neuron.activated) {
        const glowGradient = ctx.createRadialGradient(
          neuron.x, neuron.y, 0,
          neuron.x, neuron.y, radius * 3
        );
        glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw neuron core
      ctx.fillStyle = neuron.activated ? '#3b82f6' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw neuron border
      ctx.strokeStyle = neuron.activated ? '#1e40af' : '#64748b';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Continue animation
    animationRef.current = requestAnimationFrame(animate);
  }, [neurons, synapses, isActive, stage]);

  // Initialize network on mount
  useEffect(() => {
    initializeNetwork();
  }, [initializeNetwork]);

  // Start/stop animation based on isActive
  useEffect(() => {
    if (isActive) {
      timeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, animate]);

  // Stage-specific visual indicators
  const stageColors = {
    parsing: { primary: '#3b82f6', secondary: '#60a5fa' },
    analyzing: { primary: '#8b5cf6', secondary: '#a78bfa' },
    synthesizing: { primary: '#10b981', secondary: '#34d399' }
  };

  const currentColors = stageColors[stage];

  return (
    <div className="relative">
      {/* Canvas for neural network */}
      <canvas
        ref={canvasRef}
        width={250}
        height={200}
        className="w-full h-auto"
        style={{ maxWidth: '250px', maxHeight: '200px' }}
      />

      {/* Central processing indicator */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div 
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: currentColors.primary }}
        />
      </div>

      {/* Message display */}
      <div className="text-center mt-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </p>
        
        {/* Thinking dots animation */}
        <div className="flex justify-center space-x-1 mt-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"
              style={{
                animation: 'bounce 1.4s infinite',
                animationDelay: `${index * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
