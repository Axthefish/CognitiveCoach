'use client';

import { useState, useEffect } from 'react';

export default function TestStreamPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState('Starting...');
  
  useEffect(() => {
    const testStream = async () => {
      try {
        setStatus('Fetching /api/test-stream...');
        const response = await fetch('/api/test-stream');
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        setStatus('Reading stream...');
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
              setMessages(prev => [...prev, line]);
            }
          }
        }
        
        setStatus('Stream completed!');
      } catch (error) {
        setStatus(`Error: ${error}`);
      }
    };
    
    testStream();
  }, []);
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Stream API Test</h1>
      <p className="mb-4">Status: {status}</p>
      <div className="bg-gray-100 p-4 rounded">
        {messages.map((msg, i) => (
          <div key={i} className="mb-1 font-mono text-sm">{msg}</div>
        ))}
      </div>
    </div>
  );
}
