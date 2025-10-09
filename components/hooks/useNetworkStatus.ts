import { useState, useEffect } from 'react';

/**
 * 网络状态监控 Hook
 * 
 * 监听浏览器的在线/离线状态变化
 * 提供重连次数跟踪和离线消息显示控制
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const onlineHandler = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
      setReconnectAttempts(0);
    };
    
    const offlineHandler = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      setReconnectAttempts(prev => prev + 1);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
      
      return () => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      };
    }
  }, []);

  return {
    isOnline,
    reconnectAttempts,
    showOfflineMessage,
  };
}

