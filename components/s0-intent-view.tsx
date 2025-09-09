"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCognitiveCoachStore } from "@/lib/store"
import GoalTemplates from "@/components/goal-templates"
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react"

interface S0IntentViewProps {
  onProceed: (userInput: string) => void
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  aiQuestion?: string
  isConversationMode?: boolean
  recommendations?: Array<{
    category: string
    examples: string[]
    description: string
  }>
  forceClarification?: boolean
  onForceProceed?: () => void
}

export default function S0IntentView({ 
  onProceed, 
  conversationHistory = [], 
  aiQuestion,
  isConversationMode = false,
  recommendations,
  forceClarification = false,
  onForceProceed,
}: S0IntentViewProps) {
  const { userContext, updateUserContext } = useCognitiveCoachStore()
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Reset loading state when component receives new props
  useEffect(() => {
    setIsLoading(false)
    setUserInput("")
  }, [aiQuestion])

  // Set default values as per plan
  useEffect(() => {
    if (!userContext.decisionType) {
      updateUserContext({ decisionType: 'plan' })
    }
  }, [userContext.decisionType, updateUserContext])

  const handleSubmit = () => {
    if (userInput.trim()) {
      setIsLoading(true)
      onProceed(userInput)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S0: 意图与目标校准</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        让我们一起明确你的学习方向和目标。
      </p>
      
      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <Card className="bg-gray-50 dark:bg-gray-900/50 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 dark:text-gray-400">对话记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-64 overflow-y-auto">
            {conversationHistory.map((msg, idx) => (
              <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block px-4 py-2 rounded-lg max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-gray-950/50">
        <CardHeader>
          <CardTitle>
            {isConversationMode ? '回答教练的问题' : '定义你的主要目标'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aiQuestion ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-gray-800 dark:text-gray-200 font-medium">
                  教练的问题：
                </p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">
                  {aiQuestion}
                </p>
              </div>
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                欢迎！我是你的认知教练。首先，请告诉我你想要实现的主要目标或想要掌握的主题。
              </p>
            )}
            
            {/* 显示推荐选项 */}
            {recommendations && recommendations.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">推荐的学习方向：</p>
                <div className="grid gap-3">
                  {recommendations.map((rec, index) => (
                    <div 
                      key={index}
                      className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => setUserInput(rec.category)}
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {rec.category}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {rec.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {rec.examples.map((example, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-md text-gray-700 dark:text-gray-300"
                          >
                            {example}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="primary-goal">
                {isConversationMode ? '你的回答' : '你的目标'}
              </Label>
              <Input 
                id="primary-goal" 
                placeholder={isConversationMode 
                  ? "请回答教练的问题..." 
                  : "例如：'学习使用 Next.js 构建可扩展的 Web 应用'"}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
              {!isConversationMode && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  示例：&quot;我想理解行为经济学的原理，以改善我的财务决策。&quot;
                </p>
              )}
            </div>

            {/* 高级设置 - 默认收起 */}
            {!isConversationMode && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 p-0 h-auto"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  高级设置
                </Button>
                
                {showAdvanced && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-1">
                      <Label>决策类型</Label>
                      <select
                        className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                        value={userContext.decisionType}
                        onChange={(e) => updateUserContext({ decisionType: e.target.value as 'explore'|'compare'|'troubleshoot'|'plan' })}
                        disabled={isLoading}
                      >
                        <option value="explore">探索</option>
                        <option value="compare">比较</option>
                        <option value="troubleshoot">排障</option>
                        <option value="plan">规划</option>
                      </select>
                      <p className="text-xs text-gray-500">提示：
                        <span className="ml-1">探索 = 打开视野获取灵感；</span>
                        <span className="ml-1">比较 = 多方案权衡优劣；</span>
                        <span className="ml-1">排障 = 面向问题快速定位与修复；</span>
                        <span className="ml-1">规划 = 产出结构化行动路径。</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label>风险偏好</Label>
                      <select
                        className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                        value={userContext.riskPreference}
                        onChange={(e) => updateUserContext({ riskPreference: e.target.value as 'low'|'medium'|'high' })}
                        disabled={isLoading}
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                      <p className="text-xs text-gray-500">提示：
                        <span className="ml-1">低 = 稳健保守，偏向小步快跑；</span>
                        <span className="ml-1">中 = 风险与回报平衡；</span>
                        <span className="ml-1">高 = 更激进更具挑战，鼓励探索式尝试。</span>
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500">
                        系统将自动选择最适合的模型档位：优先使用 Lite 档位，必要时自动升级到 Pro 档位以确保质量。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!isConversationMode && (
              <div className="flex items-center justify-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  {showTemplates ? '隐藏模板' : '需要灵感？查看学习目标模板'}
                </Button>
              </div>
            )}
            
            {showTemplates && !isConversationMode && (
              <div className="border-t mt-4 pt-4">
                <GoalTemplates 
                  onSelectGoal={(goal) => {
                    setUserInput(goal)
                    setShowTemplates(false)
                  }}
                />
              </div>
            )}
            
            <div className="flex justify-end pt-4 space-x-2">
              {forceClarification && (
                <Button 
                  onClick={onForceProceed}
                  variant="outline"
                  disabled={isLoading}
                >
                  目标已明确，直接开始
                </Button>
              )}
              <Button 
                onClick={handleSubmit}
                disabled={!userInput.trim() || isLoading}
              >
                {isLoading ? "处理中..." : (isConversationMode ? "提交回答" : "开始目标校准")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
