"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TrendingUp, Target, MessageSquarePlus, Send, X, BarChart3, Zap } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"
import { enhancedFetch, NetworkError } from "@/lib/network-utils"

export default function S4AutonomousOperationView() {
  const { userContext, resetStore } = useCognitiveCoachStore()
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
  
  // Calculate metrics
  const completedTasks = userContext.actionPlan?.filter(item => item.isCompleted) || []
  const totalTasks = userContext.actionPlan?.length || 0
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0
  
  
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
      // 区分 4xx 与网络/服务器错误，给出准确的用户文案
      if (error && typeof error === 'object' && 'type' in error) {
        const networkError = error as NetworkError
        if (networkError.type === 'timeout') {
          setMicroSuggestions(['请求超时，请稍后重试。'])
        } else if (networkError.type === 'network') {
          setMicroSuggestions(['网络连接不可用，请检查网络后重试。'])
        } else if (networkError.type === 'server') {
          if (networkError.status && networkError.status >= 400 && networkError.status < 500) {
            setMicroSuggestions(['AI无法处理您的输入，请尝试调整后重新提交。'])
          } else {
            setMicroSuggestions(['服务暂时出现问题，请稍后重试。'])
          }
        } else {
          setMicroSuggestions([networkError.message || '发生未知错误，请稍后重试。'])
        }
      } else {
        setMicroSuggestions(['出现错误，请稍后重试。'])
      }
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

      {/* Consultation Drawer (Right Side) */}
      {showConsultModal && (
        <div className="fixed inset-0 z-50">
          {/* subtle overlay to preserve context visibility */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px] transition-opacity"
            onClick={() => {
              setShowConsultModal(false)
              setConsultQuestion("")
              setConsultResponse("")
            }}
          />
          {/* right panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
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
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question">你的问题</Label>
                  <textarea 
                    id="question"
                    className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                    placeholder="请输入你想咨询的问题...（右侧保持可见，方便参考页面内容）"
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
              </div>
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}