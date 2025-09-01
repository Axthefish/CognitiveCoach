"use client";

import dynamic from 'next/dynamic';

// 动态导入CollapsibleFramework，完全禁用SSR
export const ClientFramework = dynamic(
  () => import('./collapsible-framework').then(mod => mod.CollapsibleFramework),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800/30 animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
        <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800/30 animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    )
  }
);
