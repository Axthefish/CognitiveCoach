"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Gauge, TrendingUp, Target, MessageSquarePlus, Send, X, BarChart3, AlertTriangle, CheckCircle, Zap } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { enhancedFetch, NetworkError } from "@/lib/network-utils"

export default function S4AutonomousOperationView() {
  const { userContext, isLoading, setLoading, setError, resetStore } = useCognitiveCoachStore()
  const [showConsultModal, setShowConsultModal] = useState(false)
  const [consultQuestion, setConsultQuestion] = useState("")
  const [consultResponse, setConsultResponse] = useState("")
  const [isConsulting, setIsConsulting] = useState(false)
  
  // T7: Check-in 轻表单状态
  const [checkInData, setCheckInData] = useState({
    whatDid: "",
    challenges: "",
    nextStep: ""
  })
  const [microSuggestions, setMicroSuggestions] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Proactive coaching state
  const [proactiveSuggestions, setProactiveSuggestions] = useState<Array<{
    id: string;
    type: 'risk' | 'opportunity' | 'milestone';
    title: string;
    description: string;
    action?: string;
    priority: 'high' | 'medium' | 'low';
    timestamp: number;
  }>>([])
  const [lastActivityCheck] = useState<number>(Date.now())
  
  // Calculate metrics
  const completedTasks = userContext.actionPlan?.filter(item => item.isCompleted) || []
  const totalTasks = userContext.actionPlan?.length || 0
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0
  
  // Proactive coaching logic
  const generateProactiveSuggestions = React.useCallback(() => {
    const suggestions = []
    const now = Date.now()
    
    // Risk detection: Low completion rate
    if (completionRate < 30 && totalTasks > 0) {
      suggestions.push({
        id: 'low-completion',
        type: 'risk' as const,
        title: '完成率偏低',
        description: '当前任务完成率较低，可能需要调整学习策略或时间安排。',
        action: '考虑重新评估任务优先级，或将大任务分解为更小的步骤。',
        priority: 'high' as const,
        timestamp: now
      })
    }
    
    // Opportunity: High completion rate
    if (completionRate > 80 && totalTasks > 0) {
      suggestions.push({
        id: 'high-completion',
        type: 'opportunity' as const,
        title: '进展优秀',
        description: '你的学习进度非常好！可以考虑挑战更高级的内容。',
        action: '尝试深入学习或探索相关的高级主题。',
        priority: 'medium' as const,
        timestamp: now
      })
    }
    
    // Milestone: 50% completion
    if (completionRate >= 50 && completionRate < 55 && !proactiveSuggestions.some(s => s.id === 'milestone-50')) {
      suggestions.push({
        id: 'milestone-50',
        type: 'milestone' as const,
        title: '里程碑达成',
        description: '恭喜！你已经完成了一半的学习任务。',
        action: '这是一个很好的时机来回顾已学内容并为下一阶段做准备。',
        priority: 'medium' as const,
        timestamp: now
      })
    }
    
    // Risk: No recent activity (simulated)
    const daysSinceLastActivity = Math.floor((now - lastActivityCheck) / (1000 * 60 * 60 * 24))
    if (daysSinceLastActivity > 3) {
      suggestions.push({
        id: 'inactive',
        type: 'risk' as const,
        title: '学习活动不足',
        description: '最近几天没有学习活动，保持连续性对学习效果很重要。',
        action: '尝试每天安排至少15分钟的学习时间。',
        priority: 'high' as const,
        timestamp: now
      })
    }
    
    return suggestions
  }, [completionRate, totalTasks, lastActivityCheck, proactiveSuggestions])
  
  // Update proactive suggestions periodically
  React.useEffect(() => {
    const newSuggestions = generateProactiveSuggestions()
    if (newSuggestions.length > 0) {
      setProactiveSuggestions(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const uniqueNew = newSuggestions.filter(s => !existingIds.has(s.id))
        return [...prev, ...uniqueNew].slice(-5) // Keep only latest 5 suggestions
      })
    }
  }, [completionRate, totalTasks, lastActivityCheck, generateProactiveSuggestions])
  
  const dismissSuggestion = (suggestionId: string) => {
    setProactiveSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }
  
  const getSuggestionIcon = (type: 'risk' | 'opportunity' | 'milestone') => {
    switch (type) {
      case 'risk': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'opportunity': return <Zap className="w-4 h-4 text-green-500" />
      case 'milestone': return <CheckCircle className="w-4 h-4 text-blue-500" />
    }
  }
  
  const getSuggestionColor = (type: 'risk' | 'opportunity' | 'milestone') => {
    switch (type) {
      case 'risk': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      case 'opportunity': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
      case 'milestone': return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
    }
  }
  
  // T7: Handle check-in analysis
  const handleCheckIn = async () => {
    if (!checkInData.whatDid.trim() && !checkInData.challenges.trim() && !checkInData.nextStep.trim()) {
      return
    }
    
    setIsAnalyzing(true)
    setMicroSuggestions([])
    
    try {
      const response = await enhancedFetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyzeProgress',
          payload: {
            progressData: {
              completedTasks: completedTasks.map(t => t.id),
              challenges: `${checkInData.challenges} | 最近完成: ${checkInData.whatDid} | 下一步计划: ${checkInData.nextStep}`
            },
            userContext: {
              userGoal: userContext.userGoal,
              actionPlan: userContext.actionPlan,
              kpis: userContext.kpis,
              strategySpec: userContext.strategySpec
            }
          }
        }),
        timeout: 30000,
        retries: 2,
      })

      const result = await response.json()

      if (result.status === 'success' && result.data.suggestions) {
        // T7: 只取前2条建议作为微矫正
        setMicroSuggestions(result.data.suggestions.slice(0, 2))
      } else {
        setMicroSuggestions(['保持当前学习节奏，继续专注于主要目标'])
      }
    } catch (error) {
      // 简化错误处理，提供友好的默认建议
      setMicroSuggestions(['网络暂时不可用，建议继续当前学习计划'])
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  // Handle consultation
  const handleConsult = async () => {
    if (!consultQuestion.trim()) return
    
    setIsConsulting(true)
    setConsultResponse("")
    
    try {
      const response = await enhancedFetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'consult',
          payload: {
            question: consultQuestion,
            userContext: {
              userGoal: userContext.userGoal,
              knowledgeFramework: userContext.knowledgeFramework,
              actionPlan: userContext.actionPlan,
              systemDynamics: userContext.systemDynamics
            }
          }
        }),
        timeout: 45000,
        retries: 1,
      })

      const result = await response.json()

      if (result.status === 'success') {
        setConsultResponse(result.data.response)
      } else {
        setConsultResponse('抱歉，咨询服务暂时不可用。请稍后再试。')
      }
    } catch (error) {
      // Error consulting - 错误处理已在上面的条件中处理
      if (error instanceof Error && 'type' in error) {
        const networkError = error as NetworkError;
        if (networkError.type === 'timeout') {
          setConsultResponse('咨询请求超时，请稍后重试。');
        } else if (networkError.type === 'network') {
          setConsultResponse('网络连接失败，请检查您的网络连接后重试。');
        } else if (networkError.type === 'server') {
          setConsultResponse('服务器暂时不可用，请稍后重试。');
        } else {
          setConsultResponse(networkError.message || '咨询失败，请稍后重试。');
        }
      } else {
        setConsultResponse('网络错误，请检查连接后重试。');
      }
    } finally {
      setIsConsulting(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            S4: 自主运营与赋能
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            控制权现在属于你。更新你的进度并使用仪表板监控你的旅程。如果需要分析，我随时在这里。
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              if (confirm('确定要重新开始吗？这将清除所有当前进度。')) {
                resetStore();
              }
            }}
          >
            🔄 重新开始
          </Button>
          <Button variant="outline" onClick={() => setShowConsultModal(true)}>
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            咨询教练
          </Button>
        </div>
      </div>

      {/* T7: 简化为单一界面，移除标签页 */}
      <div className="space-y-6">
        {/* T7: Check-in 轻表单 */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquarePlus className="w-5 h-5 text-blue-600" />
              <span>学习 Check-in</span>
            </CardTitle>
            <CardDescription>
              简单三问，获得精准的微矫正建议
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="what-did" className="text-sm font-medium">
                  1. 今天/最近做了什么？
                </Label>
                <textarea 
                  id="what-did"
                  className="w-full h-16 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  placeholder="简单描述你完成的学习活动..."
                  value={checkInData.whatDid}
                  onChange={(e) => setCheckInData({...checkInData, whatDid: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="challenges" className="text-sm font-medium">
                  2. 遇到了什么困难或疑问？
                </Label>
                <textarea 
                  id="challenges"
                  className="w-full h-16 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  placeholder="描述遇到的挑战或疑问..."
                  value={checkInData.challenges}
                  onChange={(e) => setCheckInData({...checkInData, challenges: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="next-step" className="text-sm font-medium">
                  3. 下一步计划做什么？
                </Label>
                <textarea 
                  id="next-step"
                  className="w-full h-16 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  placeholder="你的下一步学习计划..."
                  value={checkInData.nextStep}
                  onChange={(e) => setCheckInData({...checkInData, nextStep: e.target.value})}
                />
              </div>
            </div>
            
            <Button 
              onClick={handleCheckIn}
              disabled={isAnalyzing || (!checkInData.whatDid.trim() && !checkInData.challenges.trim() && !checkInData.nextStep.trim())}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  正在分析...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  提交并获取建议
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* T7: 微矫正建议显示 */}
        {microSuggestions.length > 0 && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
                <Zap className="w-5 h-5" />
                <span>微矫正建议</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {microSuggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                    <span className="w-6 h-6 bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      {suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
          
        {/* T7: 简化的趋势火花线 */}
        <Card className="bg-white dark:bg-gray-950/50">
          <CardHeader>
            <CardTitle className="text-lg">学习趋势</CardTitle>
            <CardDescription>简化的进度概览</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{completionRate}%</div>
                <div className="text-xs text-gray-500">任务完成率</div>
                <div className="w-full h-1 bg-gray-200 rounded-full mt-2">
                  <div 
                    className="h-1 bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
                <div className="text-xs text-gray-500">已完成任务</div>
                <TrendingUp className="w-4 h-4 mx-auto mt-1 text-green-600" />
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{totalTasks - completedTasks.length}</div>
                <div className="text-xs text-gray-500">剩余任务</div>
                <Target className="w-4 h-4 mx-auto mt-1 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
          
        {/* T7: 保留简化的个性化指标 */}
        {userContext.kpis && userContext.kpis.length > 0 && (
          <Card className="bg-white dark:bg-gray-950/50">
            <CardHeader>
              <CardTitle>个性化指标</CardTitle>
              <CardDescription>基于你的学习目标定制的关键绩效指标</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userContext.kpis.map((kpi, index) => (
                  <div key={index} className="flex items-center p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                    <BarChart3 className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                    <span className="text-gray-700 dark:text-gray-300">{kpi}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Consultation Modal */}
      {showConsultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>咨询认知教练</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowConsultModal(false)
                  setConsultQuestion("")
                  setConsultResponse("")
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">你的问题</Label>
                <textarea 
                  id="question"
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="请输入你想咨询的问题..."
                  value={consultQuestion}
                  onChange={(e) => setConsultQuestion(e.target.value)}
                  disabled={isConsulting}
                />
              </div>
              
              {consultResponse && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <MessageSquarePlus className="w-4 h-4 mr-2" />
                    教练回复：
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {consultResponse}
                  </p>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowConsultModal(false)
                    setConsultQuestion("")
                    setConsultResponse("")
                  }}
                  disabled={isConsulting}
                >
                  关闭
                </Button>
                <Button 
                  onClick={handleConsult}
                  disabled={!consultQuestion.trim() || isConsulting}
                >
                  {isConsulting ? (
                    <>处理中...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      发送问题
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}