'use client';

import React, { useState, useEffect } from 'react';

// 故意包含一些问题来测试 Bugbot
export default function TestBugbotComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 问题1: useEffect 缺少依赖项，可能导致无限循环
  useEffect(() => {
    fetchData();
  }, []); // 应该包含 fetchData 作为依赖项
  
  // 问题2: 异步函数没有适当的错误处理
  const fetchData = async () => {
    setLoading(true);
    const response = await fetch('/api/test'); // 没有错误处理
    const result = await response.json(); // 没有检查 response.ok
    setData(result);
    setLoading(false); // 如果出错，这行可能不会执行
  };
  
  // 问题3: 直接使用 innerHTML，存在 XSS 风险
  const renderUnsafeContent = (content: string) => {
    return <div dangerouslySetInnerHTML={{__html: content}} />;
  };
  
  // 问题4: 没有清理函数，可能导致内存泄漏
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Timer running...');
    }, 1000);
    // 缺少清理函数
  }, []);
  
  // 问题5: 类型不安全的访问
  const handleClick = () => {
    // @ts-ignore - 忽略类型检查
    const result = data.someProperty.nestedProperty;
    console.log(result);
  };
  
  // 问题6: 硬编码的 API key（安全问题）
  const API_KEY = 'sk-1234567890abcdef'; // 不应该硬编码
  
  return (
    <div>
      <h2>Test Bugbot Component</h2>
      {loading && <p>Loading...</p>}
      {data && (
        <div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
          {renderUnsafeContent('<script>alert("XSS")</script>')}
        </div>
      )}
      <button onClick={handleClick}>
        Click me (unsafe)
      </button>
      <p>API Key: {API_KEY}</p>
    </div>
  );
}