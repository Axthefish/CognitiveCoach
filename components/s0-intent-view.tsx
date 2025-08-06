"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface S0IntentViewProps {
  onProceed: (userInput: string) => void
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  aiQuestion?: string
  isConversationMode?: boolean
}

export default function S0IntentView({ 
  onProceed, 
  conversationHistory = [], 
  aiQuestion,
  isConversationMode = false 
}: S0IntentViewProps) {
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Reset loading state when component receives new props
  useEffect(() => {
    setIsLoading(false)
    setUserInput("")
  }, [aiQuestion])

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
            
            <div className="flex justify-end pt-4">
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
