"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lightbulb, AlertTriangle } from "lucide-react"
import { InteractiveMermaid } from "@/components/ui/interactive-mermaid"
import { useCognitiveCoachStore } from "@/lib/store"
import { CognitiveStreamAnimator } from "@/components/cognitive-stream-animator"
import { StreamResponseData } from "@/lib/schemas"

interface S2SystemDynamicsViewProps {
  onProceed: () => void
}

export default function S2SystemDynamicsView({ onProceed }: S2SystemDynamicsViewProps) {
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues } = useCognitiveCoachStore();
  const dynamics = userContext.systemDynamics;

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    if ('mermaidChart' in data && 'metaphor' in data && data.mermaidChart && data.metaphor) {
      updateUserContext({ 
        systemDynamics: {
          mermaidChart: data.mermaidChart,
          metaphor: data.metaphor,
          nodes: ('nodes' in data ? data.nodes : undefined) as Array<{ id: string; title: string }> | undefined,
          // Persist warning flags if present
          requiresHumanReview: ('requiresHumanReview' in data ? data.requiresHumanReview : undefined) as boolean | undefined,
          qaIssues: ('qaIssues' in data ? data.qaIssues : undefined) as Array<{ severity: string; area: string; hint: string; targetPath: string }> | undefined
        }
      });
      addVersionSnapshot();
      setQaIssues(null, []);
    }
  };

  // 处理流式生成错误
  const handleStreamError = (_error: string) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // 可以在这里添加错误处理逻辑
  };
  // 如果正在加载且当前阶段是 S2，显示流式动画器
  if (isLoading && streaming.currentStage === 'S2') {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S2: System Dynamics & Metaphor</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI 正在分析知识点之间的关系，并创建生动的学习比喻...
        </p>
        
        <CognitiveStreamAnimator 
          stage="S2"
          onComplete={handleStreamComplete}
          onError={handleStreamError}
          requestPayload={{ 
            framework: userContext.knowledgeFramework,
            decisionType: userContext.decisionType
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S2: System Dynamics & Metaphor</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Let&apos;s visualize how the components of the system interact and establish a core metaphor to guide your
        understanding.
      </p>
      
      {dynamics && (dynamics.requiresHumanReview || (dynamics.qaIssues && dynamics.qaIssues.length > 0)) && (
        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800 mb-6">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <CardTitle className="text-yellow-900 dark:text-yellow-200">Quality check warnings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-800 dark:text-yellow-300 mb-3">
              Auto-repaired nodes were applied to keep your flow uninterrupted. Please review before proceeding.
            </p>
            {dynamics.qaIssues && dynamics.qaIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Issues found:</p>
                <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                  {dynamics.qaIssues.map((issue, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-yellow-600 dark:text-yellow-400">•</span>
                      <span>
                        {issue.hint.length > 100 ? `${issue.hint.substring(0, 100)}...` : issue.hint}
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-1">
                          ({issue.severity}, {issue.area})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {dynamics ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-950/50 h-full">
              <CardHeader>
                <CardTitle>System Map</CardTitle>
              </CardHeader>
              <CardContent>
                <InteractiveMermaid 
                  chart={dynamics.mermaidChart} 
                  nodes={dynamics.nodes}
                  onNodeClick={(_nodeId) => {/* 可以在这里添加节点点击处理逻辑 */}} // eslint-disable-line @typescript-eslint/no-unused-vars
                  onWhatIfSimulation={(_nodeId) => {/* 可以在这里添加模拟分析逻辑 */}} // eslint-disable-line @typescript-eslint/no-unused-vars
                />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 h-full">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Lightbulb className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  <CardTitle>Core Metaphor</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-amber-900 dark:text-amber-200 font-medium mb-2">核心比喻</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {dynamics.metaphor}
                </p>
              </CardContent>
            </Card>
            {dynamics?.nodes && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>节点清单与覆盖状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dynamics.nodes.map((n) => (
                      <div key={n.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-gray-700 dark:text-gray-300">{n.id}</span>
                        <span className="text-gray-600 dark:text-gray-400">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center py-16">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardContent className="p-8">
              <p className="text-gray-500 text-center">正在生成系统动力学图表...</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {dynamics && (
        <div className="flex justify-end mt-8">
          <Button onClick={onProceed}>Finalize System Model & Proceed to S3</Button>
        </div>
      )}
    </div>
  )
}
