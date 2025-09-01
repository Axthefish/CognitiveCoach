'use client';

import React, { useEffect, useState } from 'react';

export function SimpleStreamTest({ stage, requestPayload }: { stage: string; requestPayload: Record<string, unknown> }) {
  const [messages, setMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    console.log('🚀 SimpleStreamTest mounting, stage:', stage);
    
    const startStream = async () => {
      try {
        console.log('📡 Starting fetch...');
        
        const response = await fetch('/api/coach-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'generateFramework',
            payload: requestPayload
          }),
        });
        
        console.log('📊 Response:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              console.log('📨 Line:', line);
              setMessages(prev => [...prev, line]);
            }
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('❌ Stream error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };
    
    startStream();
  }, [stage, requestPayload]);
  
  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Simple Stream Test</h3>
      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      <div className="text-xs">
        {messages.map((msg, i) => (
          <div key={i} className="mb-1">{msg}</div>
        ))}
      </div>
    </div>
  );
}
