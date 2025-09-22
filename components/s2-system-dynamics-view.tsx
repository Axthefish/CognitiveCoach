"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { InteractiveMermaid } from "@/components/ui/interactive-mermaid"
import EchartsSystemGraph from "@/components/ui/echarts-system-graph"
import IntentStrip from "@/components/ui/intent-strip"
import KeyLevers from "@/components/ui/key-levers"
import CorePathTimeline from "@/components/ui/core-path-timeline"
import { extractSilentIntent, computeTop2Levers, computeCorePath } from "@/lib/utils"
import { useCognitiveCoachStore } from "@/lib/store"
import { CognitiveStreamAnimator } from "@/components/cognitive-stream-animator"
import { StreamResponseData } from "@/lib/schemas"

interface S2SystemDynamicsViewProps {
  onProceed: () => void
}

export default function S2SystemDynamicsView({ onProceed }: S2SystemDynamicsViewProps) {
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues } = useCognitiveCoachStore();
  const dynamics = userContext.systemDynamics;
  // Extracted but not used in current render - available for future features
  // const mainPath: string[] = (dynamics as unknown as { mainPath?: string[] })?.mainPath || [];
  // const loops: Array<{ id: string; title: string; nodes: string[]; summary?: string }> = (dynamics as unknown as { loops?: Array<{ id: string; title: string; nodes: string[]; summary?: string }> })?.loops || [];

  // 将技术性 QA 提示映射为用户友好文案
  const getFriendlyIssueText = (hint: string): string => {
    if (/Framework ids not found/i.test(hint)) {
      return '为了确保学习计划的连贯性，我们自动为您调整了几个知识点的关联。';
    }
    return hint;
  };

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
          qaIssues: ('qaIssues' in data ? data.qaIssues : undefined) as Array<{ severity: string; area: string; hint: string; targetPath: string }> | undefined,
          // New clarity fields
          ...(('mainPath' in data) ? { mainPath: (data as { mainPath?: string[] }).mainPath } : {}),
          ...(('loops' in data) ? { loops: (data as { loops?: Array<{ id: string; title: string; nodes: string[]; summary?: string }> }).loops } : {}),
          ...(('nodeAnalogies' in data) ? { nodeAnalogies: (data as { nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }> }).nodeAnalogies } : {}),
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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S2：核心结论与关键杠杆</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">聚焦你当前目标的最少必要信息：一句话目标、两处关键杠杆、三到五步核心路径。</p>
        
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
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S2：核心结论与关键杠杆</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">聚焦你当前目标的最少必要信息：一句话目标、两处关键杠杆、三到五步核心路径。</p>

      {dynamics && (dynamics.requiresHumanReview || (dynamics.qaIssues && dynamics.qaIssues.length > 0)) && (
        <details className="mb-6">
          <summary className="cursor-pointer">
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <CardTitle className="text-yellow-900 dark:text-yellow-200">已自动优化若干节点（点击展开查看详情）</CardTitle>
                </div>
              </CardHeader>
            </Card>
          </summary>
          <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800">
            <CardContent>
              <p className="text-yellow-800 dark:text-yellow-300 mb-3">为保证流程不中断，我们自动进行了小幅修复，你可在此复核关键项目。</p>
              {dynamics.qaIssues && dynamics.qaIssues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">发现的问题：</p>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                    {dynamics.qaIssues.map((issue, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-yellow-600 dark:text-yellow-400">•</span>
                        <span>
                          {getFriendlyIssueText(issue.hint)}
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-1">({issue.severity}, {issue.area})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </details>
      )}
      {dynamics ? (
        <div className="space-y-6">
          {/* Intent Strip */}
          {(() => {
            const intent = extractSilentIntent(useCognitiveCoachStore.getState().userContext)
            return (
              <IntentStrip
                goal={intent.goal}
                constraints={intent.constraints}
                onConfirm={(patch) => {
                  useCognitiveCoachStore.getState().updateUserContext({ userGoal: patch.goal ?? intent.goal })
                }}
              />
            )
          })()}

          {/* Top2 Levers */}
          {(() => {
            const levers = computeTop2Levers(useCognitiveCoachStore.getState().userContext)
            return (
              <div>
                <div className="text-sm font-medium mb-2">关键杠杆（仅 2 项）</div>
                <KeyLevers items={levers} onTry={() => { /* 埋点：尝试 */ }} />
              </div>
            )
          })()}

          {/* Core Path Timeline */}
          {(() => {
            const path = computeCorePath(useCognitiveCoachStore.getState().userContext)
            return (
              <div>
                <div className="text-sm font-medium mb-2">核心路径（3–5 步）</div>
                <CorePathTimeline items={path} onStepFocus={(id) => { try { useCognitiveCoachStore.getState().setSelectedNodeId(id) } catch {} }} />
              </div>
            )
          })()}

          {/* Collapsible: System Graph */}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">查看全景系统图</summary>
            <div className="mt-3">
              <Card>
                <CardContent className="p-4">
                  <div className="hidden lg:block">
                    <EchartsSystemGraph 
                      chart={dynamics.mermaidChart}
                      nodes={dynamics.nodes}
                      nodeAnalogies={(dynamics as unknown as { nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }> })?.nodeAnalogies}
                      onNodeClick={(nodeId) => { try { useCognitiveCoachStore.getState().setSelectedNodeId(nodeId) } catch {} }}
                    />
                  </div>
                  <div className="lg:hidden">
                    <InteractiveMermaid 
                      chart={dynamics.mermaidChart} 
                      nodes={dynamics.nodes}
                      nodeAnalogies={(dynamics as unknown as { nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }> })?.nodeAnalogies}
                      onNodeClick={() => {}}
                      onWhatIfSimulation={() => {}}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </details>
        </div>
      ) : (
        <div className="flex justify-center items-center py-16">
          <Card className="bg-white dark:bg-gray-950/50">
            <CardContent className="p-8">
              <p className="text-gray-500 text-center">正在生成核心结论与路径...</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {dynamics && (
        <div className="flex justify-end mt-8">
          <Button onClick={onProceed}>完成系统模型，进入 S3</Button>
        </div>
      )}
    </div>
  )
}
