"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { GripVertical, Gauge, TrendingUp, Target, BarChart3 } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"

interface S3ActionPlanViewProps {
  onProceed: () => void
}

export default function S3ActionPlanView({ onProceed }: S3ActionPlanViewProps) {
  const { userContext, updateUserContext } = useCognitiveCoachStore()
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  
  // Get action plan and KPIs from store
  const actionPlan = userContext.actionPlan || []
  const kpis = userContext.kpis || []
  
  const handleTaskToggle = (taskId: string) => {
    const newCompletedTasks = new Set(completedTasks)
    if (newCompletedTasks.has(taskId)) {
      newCompletedTasks.delete(taskId)
    } else {
      newCompletedTasks.add(taskId)
    }
    setCompletedTasks(newCompletedTasks)
    
    // Update the action plan in the store
    const updatedPlan = actionPlan.map(item => ({
      ...item,
      isCompleted: newCompletedTasks.has(item.id)
    }))
    updateUserContext({ actionPlan: updatedPlan })
  }
  
  const completionRate = actionPlan.length > 0 
    ? Math.round((completedTasks.size / actionPlan.length) * 100)
    : 0
  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        S3: 个性化行动与监控计划
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        这是从理论到实践的桥梁。以下是为你定制的行动序列和监控仪表板预览。
      </p>
      <Tabs defaultValue="action-plan" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="action-plan">行动计划</TabsTrigger>
          <TabsTrigger value="monitoring-dashboard">监控仪表板</TabsTrigger>
        </TabsList>
        <TabsContent value="action-plan">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardHeader>
              <CardTitle>你的行动计划</CardTitle>
              <CardDescription>
                完成以下步骤，逐步实现你的学习目标。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionPlan.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  正在生成你的个性化行动计划...
                </div>
              ) : (
                actionPlan.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center p-3 rounded-lg border bg-gray-50 dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <GripVertical className="w-5 h-5 text-gray-400 mr-2 cursor-grab" />
                    <Checkbox 
                      id={`task-${item.id}`} 
                      className="mr-3" 
                      checked={completedTasks.has(item.id)}
                      onCheckedChange={() => handleTaskToggle(item.id)}
                    />
                    <label
                      htmlFor={`task-${item.id}`}
                      className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer"
                    >
                      {item.text}
                    </label>
                  </div>
                ))
              )}
              {actionPlan.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      总体进度
                    </span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {completedTasks.size} / {actionPlan.length} 已完成 ({completionRate}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="monitoring-dashboard">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardHeader>
              <CardTitle>仪表板预览</CardTitle>
              <CardDescription>这些是我们将在下一阶段跟踪的关键绩效指标。</CardDescription>
            </CardHeader>
            <CardContent>
              {kpis.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  正在设计你的监控指标...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">任务完成率</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{completionRate}%</div>
                        <p className="text-xs text-muted-foreground">
                          {completedTasks.size} / {actionPlan.length} 任务已完成
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">学习连续性</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">待启动</div>
                        <p className="text-xs text-muted-foreground">将在S4阶段开始跟踪</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">知识掌握度</CardTitle>
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">待评估</div>
                        <p className="text-xs text-muted-foreground">基于自我评估</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      你的个性化KPIs：
                    </h4>
                    <ul className="space-y-2">
                      {kpis.map((kpi, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                          <BarChart3 className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                          {kpi}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end mt-8">
        <Button onClick={onProceed} disabled={actionPlan.length === 0}>
          移交控制权并开始 S4
        </Button>
      </div>
    </div>
  )
}
