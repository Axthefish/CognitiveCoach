"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { GripVertical, Gauge, TrendingUp, Target, BarChart3, Brain, Download, Calendar } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { normalizeId } from "@/lib/qa"
import { CognitiveStreamAnimator } from "@/components/cognitive-stream-animator"
import { StreamResponseData } from "@/lib/schemas"

interface S3ActionPlanViewProps {
  onProceed: () => void
}

function S3ActionPlanView({ onProceed }: S3ActionPlanViewProps) {
  const { 
    userContext, 
    updateUserContext, 
    streaming, 
    isLoading, 
    addVersionSnapshot, 
    setQaIssues 
  } = useCognitiveCoachStore()
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [expandingTask, setExpandingTask] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Record<string, string[]>>({})
  const [isExpanding, setIsExpanding] = useState(false)

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    if ('actionPlan' in data && data.actionPlan) {
      updateUserContext({ 
        actionPlan: data.actionPlan,
        kpis: 'kpis' in data ? data.kpis : [],
        strategySpec: ('strategySpec' in data ? data.strategySpec : null) || null,
        missingEvidenceTop3: 'missingEvidenceTop3' in data ? data.missingEvidenceTop3 : [],
        reviewWindow: 'reviewWindow' in data ? data.reviewWindow : "P14D",
        povTags: 'povTags' in data ? data.povTags : [],
        requiresHumanReview: 'requiresHumanReview' in data ? data.requiresHumanReview : false,
      });
      addVersionSnapshot();
      setQaIssues(null, []);
    }
  };

  // 处理流式生成错误
  const handleStreamError = (error: string) => {
    console.error('S3 streaming error:', error);
  };
  
  // Get action plan and KPIs from store
  const actionPlan = userContext.actionPlan || []
  const kpis = userContext.kpis || []
  const nodes = userContext.systemDynamics?.nodes || []
  const strategySpec = userContext.strategySpec
  const povTags = userContext.povTags as string[] | undefined
  const requiresHumanReview = userContext.requiresHumanReview as boolean | undefined
  
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

  // AI-assisted task breakdown
  const handleTaskBreakdown = async (taskId: string, taskText: string) => {
    setIsExpanding(true)
    setExpandingTask(taskId)
    
    try {
      // Simulate AI breakdown (in real implementation, this would call the AI API)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const subTasks = [
        `准备阶段: ${taskText.slice(0, 20)}...的前期准备工作`,
        `执行阶段: 开始实际${taskText.slice(0, 15)}...的核心操作`,
        `验证阶段: 检查${taskText.slice(0, 15)}...的完成质量`,
        `总结阶段: 记录${taskText.slice(0, 15)}...的学习收获`
      ]
      
      setExpandedTasks(prev => ({
        ...prev,
        [taskId]: subTasks
      }))
    } catch (error) {
      console.error('Task breakdown failed:', error)
    } finally {
      setIsExpanding(false)
      setExpandingTask(null)
    }
  }

  // Export functions
  const exportToCalendar = () => {
    const calendarData = actionPlan.map((task, index) => {
      const date = typeof window !== 'undefined' ? new Date() : new Date('2024-01-01')
      date.setDate(date.getDate() + index * 2) // Space tasks 2 days apart
      
      return {
        title: task.text,
        start: date.toISOString().split('T')[0],
        description: `学习任务: ${task.text}`
      }
    })
    
    // Create ICS file content
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//CognitiveCoach//Action Plan//EN\n'
    
    calendarData.forEach((event, index) => {
      icsContent += `BEGIN:VEVENT\n`
      icsContent += `UID:task-${index}@cognitivecoach.app\n`
      icsContent += `DTSTART:${event.start.replace(/-/g, '')}T090000Z\n`
      icsContent += `DTEND:${event.start.replace(/-/g, '')}T100000Z\n`
      icsContent += `SUMMARY:${event.title}\n`
      icsContent += `DESCRIPTION:${event.description}\n`
      icsContent += `END:VEVENT\n`
    })
    
    icsContent += 'END:VCALENDAR'
    
    // Download file
    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cognitive-coach-action-plan.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToTodoist = () => {
    // Generate Todoist template
    const todoistTemplate = actionPlan
      .map(task => `- ${task.text}`)
      .join('\n')
    
    const blob = new Blob([todoistTemplate], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cognitive-coach-tasks.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  // 如果正在加载且当前阶段是 S3，显示流式动画器
  if (isLoading && streaming.currentStage === 'S3') {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          S3: 个性化行动与监控计划
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI 正在为您制定个性化的行动计划和关键绩效指标...
        </p>
        
        <CognitiveStreamAnimator 
          stage="S3"
          onComplete={handleStreamComplete}
          onError={handleStreamError}
          requestPayload={{ 
            userGoal: userContext.userGoal,
            framework: userContext.knowledgeFramework,
            systemNodes: userContext.systemDynamics?.nodes || [],
            decisionType: userContext.decisionType,
            runTier: userContext.runTier,
            seed: userContext.seed
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        S3: 个性化行动与监控计划
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        这是从理论到实践的桥梁。以下是为你定制的行动序列和监控仪表板预览。
      </p>
      <Tabs defaultValue="action-plan" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="action-plan">行动计划</TabsTrigger>
          <TabsTrigger value="strategy-spec">策略表</TabsTrigger>
          <TabsTrigger value="monitoring-dashboard">监控仪表板</TabsTrigger>
        </TabsList>
        <TabsContent value="action-plan">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>你的行动计划</CardTitle>
                  <CardDescription>
                    完成以下步骤，逐步实现你的学习目标。
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportToCalendar}>
                    <Calendar className="w-4 h-4 mr-1" />
                    导出日历
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToTodoist}>
                    <Download className="w-4 h-4 mr-1" />
                    导出任务
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionPlan.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  正在生成你的个性化行动计划...
                </div>
              ) : (
                actionPlan.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center p-3 rounded-lg border bg-gray-50 dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTaskBreakdown(item.id, item.text)}
                        disabled={isExpanding || !!expandedTasks[item.id]}
                        className="ml-2"
                      >
                        {expandingTask === item.id ? (
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Expanded subtasks */}
                    {expandedTasks[item.id] && (
                      <div className="ml-8 space-y-1">
                        {expandedTasks[item.id].map((subTask, index) => (
                          <div
                            key={index}
                            className="flex items-center p-2 text-xs bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-200 dark:border-blue-800"
                          >
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0"></span>
                            <span className="text-gray-700 dark:text-gray-300">{subTask}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
              {/* VOI & Review Window */}
              {(userContext.missingEvidenceTop3?.length || userContext.reviewWindow) && (
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-200">最小证据（VOI Top-3）与复评窗口</h4>
                    {userContext.reviewWindow && (
                      <Badge variant="secondary">复评窗口：{userContext.reviewWindow}</Badge>
                    )}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {(userContext.missingEvidenceTop3 || []).map((e, idx) => (
                      <li key={idx} className="text-sm text-amber-900 dark:text-amber-200">
                        <span className="font-mono">{e.metricId}</span> — {e.what}
                        <span className="ml-2 text-amber-700/80 dark:text-amber-300/90">(VOI: {e.voi_reason})</span>
                      </li>
                    ))}
                  </ul>
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
        <TabsContent value="strategy-spec">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardHeader>
              <CardTitle>策略表（覆盖映射）</CardTitle>
              <CardDescription>将 S2 节点映射为可执行指标与策略。未覆盖的节点会标红。</CardDescription>
              <div className="mt-2 flex items-center gap-2">
                {povTags?.map((tag) => (
                  <Badge key={tag} variant="secondary">POV: {tag}</Badge>
                ))}
                {requiresHumanReview && (
                  <Badge variant="destructive">需人审</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!strategySpec ? (
                <div className="text-center py-8 text-gray-500">暂无策略表。</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                        <th className="py-2 pr-4">metricId</th>
                        <th className="py-2 pr-4">what</th>
                        <th className="py-2 pr-4">triggers</th>
                        <th className="py-2 pr-4">diagnosis</th>
                        <th className="py-2 pr-4">options A/B/C</th>
                        <th className="py-2 pr-4">recovery</th>
                        <th className="py-2 pr-4">stopLoss</th>
                        <th className="py-2 pr-4">evidence</th>
                        <th className="py-2 pr-4">confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategySpec.metrics?.map((m) => (
                        <tr key={m.metricId} className="border-b border-gray-100 dark:border-gray-900">
                          <td className="py-2 pr-4 font-mono">{m.metricId}</td>
                          <td className="py-2 pr-4">{m.what}</td>
                          <td className="py-2 pr-4">{m.triggers?.map(t => `${t.comparator}${t.threshold}@${t.window}`).join(', ')}</td>
                          <td className="py-2 pr-4">{m.diagnosis?.map(d => d.description).join(' / ')}</td>
                          <td className="py-2 pr-4">{m.options?.map(o => o.id).join('/')}</td>
                          <td className="py-2 pr-4">{m.recovery?.window}</td>
                          <td className="py-2 pr-4">{m.stopLoss ? '✓' : '—'}</td>
                          <td className="py-2 pr-4">{m.evidence?.length || 0}</td>
                          <td className="py-2 pr-4">{typeof m.confidence === 'number' ? m.confidence.toFixed(2) : '—'}</td>
                        </tr>
                      ))}
                      {/* 未覆盖节点显示 */}
                      {nodes
                        .filter(n => !strategySpec.metrics?.some(m => normalizeId(m.metricId) === normalizeId(n.id)))
                        .map(n => (
                          <tr key={`missing-${n.id}`} className="bg-red-50 dark:bg-red-900/20">
                            <td className="py-2 pr-4 font-mono text-red-700 dark:text-red-300">{n.id}</td>
                            <td colSpan={6} className="py-2 pr-4 text-red-700 dark:text-red-300">未覆盖到策略表</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
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

export default React.memo(S3ActionPlanView);
