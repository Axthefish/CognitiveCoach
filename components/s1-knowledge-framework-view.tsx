"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Check } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"
import { FrameworkNode } from "@/lib/types"
import { CognitiveStreamAnimator } from "@/components/cognitive-stream-animator"
import { StreamResponseData } from "@/lib/schemas"

interface S1KnowledgeFrameworkViewProps {
  onProceed: () => void
}

export default function S1KnowledgeFrameworkView({ onProceed }: S1KnowledgeFrameworkViewProps) {
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues } = useCognitiveCoachStore();
  const framework = userContext.knowledgeFramework;

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    if (data.framework) {
      updateUserContext({ knowledgeFramework: data.framework });
      addVersionSnapshot();
      setQaIssues(null, []);
    }
  };

  // 处理流式生成错误
  const handleStreamError = (error: string) => {
    console.error('S1 streaming error:', error);
  };

  // 递归渲染框架节点
  const renderFrameworkNode = (node: FrameworkNode, parentId: string = ''): React.ReactElement => {
    const nodeId = parentId ? `${parentId}-${node.id}` : node.id;
    
    return (
      <AccordionItem key={nodeId} value={nodeId}>
        <AccordionTrigger>{node.title}</AccordionTrigger>
        <AccordionContent>
          <p className="text-gray-600 dark:text-gray-400 mb-2">{node.summary}</p>
          {node.children && node.children.length > 0 && (
            <Accordion type="single" collapsible className="ml-4">
              {node.children.map(child => renderFrameworkNode(child, nodeId))}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  // 如果正在加载且当前阶段是 S1，显示流式动画器
  if (isLoading && streaming.currentStage === 'S1') {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1: Knowledge Framework Construction</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI 正在为您构建结构化的知识框架，这将成为后续学习的基础...
        </p>
        
        <CognitiveStreamAnimator 
          stage="S1"
          onComplete={handleStreamComplete}
          onError={handleStreamError}
          requestPayload={{ 
            userGoal: userContext.userGoal,
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
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1: Knowledge Framework Construction</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Here is the foundational knowledge structure for your goal, retrieved from our verified sources.
      </p>
      <Card className="bg-white dark:bg-gray-950/50 mb-8">
        <CardHeader>
          <CardTitle>Objective Knowledge Framework</CardTitle>
          <CardDescription>
            {userContext.userGoal ? (
              <>Goal: {userContext.userGoal}</>
            ) : (
              <>An interactive outline of key concepts.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {framework && framework.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {framework.map(node => renderFrameworkNode(node))}
            </Accordion>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>正在生成知识框架...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {framework && framework.length > 0 && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <CardHeader className="flex-row items-start space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Check className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <CardTitle>Milestone Summary</CardTitle>
              <CardDescription className="text-blue-900/80 dark:text-blue-200/80">Framework Established</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-blue-900 dark:text-blue-200">
              You now have a structured overview tailored to your goal. This
              framework will be our map for the next stages.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={onProceed} className="ml-auto">
              Proceed to System Dynamics (S2)
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}