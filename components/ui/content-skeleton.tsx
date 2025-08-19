"use client"

import React from 'react';

interface ContentSkeletonProps {
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
}

export function ContentSkeleton({ stage }: ContentSkeletonProps) {
  // 根据阶段显示不同的骨架屏
  const renderSkeletonByStage = () => {
    switch (stage) {
      case 'S1':
        return (
          <>
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
                    <div className="ml-4 space-y-2">
                      {[...Array(2)].map((_, j) => (
                        <div key={j} className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4 animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'S2':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 图表占位 */}
            <div className="lg:col-span-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse mb-4" />
              <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
                <div className="text-gray-400 dark:text-gray-600 text-center">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 mx-auto animate-pulse" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto animate-pulse" />
                </div>
              </div>
            </div>
            
            {/* 比喻占位 */}
            <div className="lg:col-span-1">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        );

      case 'S3':
        return (
          <div className="space-y-6">
            {/* 行动计划占位 */}
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            
            {/* KPIs 占位 */}
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse mb-4" />
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        );

      case 'S4':
        return (
          <div className="space-y-6">
            {/* 分析报告占位 */}
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            </div>
            
            {/* 建议占位 */}
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse mb-4" />
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full p-6 space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
      </div>
      
      <div className="bg-white dark:bg-gray-950/50 border rounded-lg p-6">
        {renderSkeletonByStage()}
      </div>
      
      {/* 底部提示 */}
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full animate-spin" />
          <span>AI 正在思考中，请稍候...</span>
        </div>
      </div>
    </div>
  );
}
