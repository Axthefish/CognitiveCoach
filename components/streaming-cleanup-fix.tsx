// 流式处理清理逻辑的改进方案

// 在 CognitiveStreamAnimator 中，确保：
// 1. 使用 AbortController 正确取消请求
// 2. 在组件卸载时立即停止流
// 3. 忽略已取消的请求错误

export const streamCleanupExample = `
// 在组件中
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => {
    // 组件卸载时立即中止流
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);

// 在 fetch 请求中
try {
  const response = await fetch('/api/coach-stream', {
    signal: abortController.signal,
    // ... 其他配置
  });
} catch (error) {
  // 忽略中止错误
  if (error.name === 'AbortError') {
    console.log('Stream aborted due to navigation');
    return;
  }
  // 处理其他错误
  throw error;
}
`;
