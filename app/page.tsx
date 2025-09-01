'use client';

import dynamic from 'next/dynamic';

// 动态导入整个客户端页面，完全禁用SSR
const ClientPage = dynamic(
  () => import('./client-page'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在加载 CognitiveCoach...</p>
        </div>
      </div>
    )
  }
);

export default function Home() {
  return <ClientPage />;
}