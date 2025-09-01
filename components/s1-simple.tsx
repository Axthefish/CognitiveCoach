'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface S1SimpleProps {
  userGoal: string;
  onProceed: () => void;
  onBack: () => void;
}

export default function S1Simple({ userGoal, onProceed, onBack }: S1SimpleProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleProceed = () => {
    setIsLoading(true);
    // 模拟异步操作
    setTimeout(() => {
      onProceed();
    }, 500);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        S1: 知识框架构建
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        基于您的目标构建知识框架
      </p>

      <Card className="bg-white dark:bg-gray-950/50 mb-6">
        <CardHeader>
          <CardTitle>您的学习目标</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">{userGoal}</p>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-950/50">
        <CardHeader>
          <CardTitle>知识框架预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              这是一个简化的 S1 组件，用于测试导航功能。
            </p>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-semibold mb-2">框架结构：</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>核心概念定义</li>
                <li>关键原理分析</li>
                <li>实践应用场景</li>
                <li>相关资源推荐</li>
              </ul>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              完整的知识框架功能将在后续步骤中恢复。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          返回修改目标
        </Button>
        <Button
          onClick={handleProceed}
          disabled={isLoading}
        >
          {isLoading ? '处理中...' : '继续到系统动力学'}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
