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
  
  // Progress tracking state
  const [progressData, setProgressData] = useState({
    confidenceScore: "",
    hoursSpent: "",
    challenges: ""
  })
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: string;
    suggestions: string[];
    encouragement?: string;
  } | null>(null)
  
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
  
  // Handle progress analysis
  const handleAnalyzeProgress = async () => {
    setLoading(true)
    setError(null)
    
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
              confidenceScore: progressData.confidenceScore ? parseInt(progressData.confidenceScore) : undefined,
              hoursSpent: progressData.hoursSpent ? parseInt(progressData.hoursSpent) : undefined,
              challenges: progressData.challenges || undefined
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

      if (result.status === 'success') {
        setAnalysisResult(result.data)
      } else {
        setError(result.error || '分析进度时出错')
      }
    } catch (error) {
      // Error analyzing progress - 错误处理已在上面的条件中处理
      if (error instanceof Error && 'type' in error) {
        const networkError = error as NetworkError;
        if (networkError.type === 'timeout') {
          setError('分析请求超时，请稍后重试');
        } else if (networkError.type === 'network') {
          setError('网络连接失败，请检查您的网络连接');
        } else if (networkError.type === 'server') {
          setError('服务器暂时不可用，请稍后重试');
        } else {
          setError(networkError.message || '分析失败，请重试');
        }
      } else {
        setError('网络错误，请检查连接后重试');
      }
    } finally {
      setLoading(false)
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

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard">监控仪表板</TabsTrigger>
          <TabsTrigger value="progress">进度记录</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          {/* Proactive Coach Suggestions */}
          {proactiveSuggestions.length > 0 && (
            <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-orange-600" />
                  <span>智能教练建议</span>
                </CardTitle>
                <CardDescription>
                  基于你的学习进度，AI教练为你提供个性化建议
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proactiveSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`p-3 rounded-lg border ${getSuggestionColor(suggestion.type)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2 flex-1">
                          {getSuggestionIcon(suggestion.type)}
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{suggestion.title}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {suggestion.description}
                            </p>
                            {suggestion.action && (
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">
                                💡 {suggestion.action}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissSuggestion(suggestion.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* KPI Widgets */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">任务完成率</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {completedTasks.length} / {totalTasks} 任务已完成
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">自评信心</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {progressData.confidenceScore || "待评估"}
                </div>
                <p className="text-xs text-muted-foreground">
                  满分10分
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">学习时长</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {progressData.hoursSpent || "0"} 小时
                </div>
                <p className="text-xs text-muted-foreground">
                  累计投入时间
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Custom KPIs */}
          {userContext.kpis && userContext.kpis.length > 0 && (
            <Card className="bg-white dark:bg-gray-950/50">
              <CardHeader>
                <CardTitle>个性化指标</CardTitle>
                <CardDescription>基于你的学习目标定制的关键绩效指标</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userContext.kpis.map((kpi, index) => (
                    <div key={index} className="flex items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <BarChart3 className="w-5 h-5 mr-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{kpi}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Analysis Results */}
          {analysisResult && (
            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardHeader>
                <CardTitle>进度分析结果</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">分析：</h4>
                  <p className="text-gray-700 dark:text-gray-300">{analysisResult.analysis}</p>
                </div>
                
                {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">建议：</h4>
                    <ul className="space-y-2">
                      {analysisResult.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                          <span className="text-gray-700 dark:text-gray-300">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysisResult.encouragement && (
                  <div className="pt-2 border-t">
                    <p className="text-green-700 dark:text-green-400 font-medium">
                      💪 {analysisResult.encouragement}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="progress">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardHeader>
              <CardTitle>记录你的进度</CardTitle>
              <CardDescription>
                输入你的最新数据点。仪表板将实时更新。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="confidence-score">当前信心评分 (1-10)</Label>
                  <Input 
                    id="confidence-score" 
                    type="number" 
                    min="1"
                    max="10"
                    placeholder="例如：7" 
                    value={progressData.confidenceScore}
                    onChange={(e) => setProgressData({...progressData, confidenceScore: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours-spent">本周学习时长（小时）</Label>
                  <Input 
                    id="hours-spent" 
                    type="number" 
                    min="0"
                    placeholder="例如：5" 
                    value={progressData.hoursSpent}
                    onChange={(e) => setProgressData({...progressData, hoursSpent: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="challenges">遇到的挑战或问题（可选）</Label>
                <textarea 
                  id="challenges"
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  placeholder="描述你在学习过程中遇到的任何困难或挑战..."
                  value={progressData.challenges}
                  onChange={(e) => setProgressData({...progressData, challenges: e.target.value})}
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleAnalyzeProgress}
                  disabled={isLoading || (!progressData.confidenceScore && !progressData.hoursSpent && !progressData.challenges)}
                >
                  {isLoading ? "分析中..." : "提交并获取分析"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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