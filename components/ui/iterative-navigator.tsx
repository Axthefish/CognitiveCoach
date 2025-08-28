"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Circle, CircleDot, ArrowLeft, RotateCcw, AlertTriangle } from "lucide-react"
import type { FSMState } from "@/lib/store"

interface Stage {
  id: FSMState
  name: string
  description: string
  isIterative: boolean
}

interface IterativeNavigatorProps {
  currentState: FSMState
  completedStages: FSMState[]
  onNavigate: (targetState: FSMState) => void
  onRefine: (targetState: FSMState) => void
  hasContextForIteration?: boolean
  iterationCount?: Partial<Record<FSMState, number>>
}

const STAGE_CONFIG: Stage[] = [
  {
    id: 'S0_INTENT_CALIBRATION',
    name: '目标校准',
    description: '明确学习目标和方向',
    isIterative: false
  },
  {
    id: 'S1_KNOWLEDGE_FRAMEWORK',
    name: '知识框架',
    description: '构建学习知识结构',
    isIterative: false
  },
  {
    id: 'S2_SYSTEM_DYNAMICS',
    name: '系统动力学',
    description: '理解知识间关系',
    isIterative: true
  },
  {
    id: 'S3_ACTION_PLAN',
    name: '行动计划',
    description: '制定执行策略',
    isIterative: true
  },
  {
    id: 'S4_AUTONOMOUS_OPERATION',
    name: '自主运营',
    description: '执行和监控进展',
    isIterative: true
  }
]

export function IterativeNavigator({
  currentState,
  completedStages,
  onNavigate,
  onRefine,
  hasContextForIteration = true,
  iterationCount = {}
}: IterativeNavigatorProps) {
  const stages = STAGE_CONFIG

  const canNavigateBack = (stageId: FSMState): boolean => {
    // Can go back to any completed stage from S2 onwards
    const currentIndex = stages.findIndex(s => s.id === currentState)
    const targetIndex = stages.findIndex(s => s.id === stageId)
    
    return (
      completedStages.includes(stageId) && 
      currentIndex >= 2 && // From S2 onwards
      targetIndex < currentIndex &&
      targetIndex >= 2 // Can only go back to S2 or later
    )
  }

  const canRefine = (stageId: FSMState): boolean => {
    return (
      completedStages.includes(stageId) &&
      stages.find(s => s.id === stageId)?.isIterative === true &&
      hasContextForIteration
    )
  }

  const getStageStatus = (stage: Stage) => {
    const isCompleted = completedStages.includes(stage.id)
    const isActive = currentState === stage.id

    if (isActive) return 'active'
    if (isCompleted) return 'completed'
    return 'pending'
  }

  const getStatusIcon = (stage: Stage) => {
    const status = getStageStatus(stage)
    
    switch (status) {
      case 'active':
        return <CircleDot className="w-6 h-6 text-blue-600 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      default:
        return <Circle className="w-6 h-6 text-gray-400 dark:text-gray-600" />
    }
  }

  const getStatusColor = (stage: Stage) => {
    const status = getStageStatus(stage)
    
    switch (status) {
      case 'active':
        return 'text-blue-600 dark:text-blue-400'
      case 'completed':
        return 'text-gray-600 dark:text-gray-300'
      default:
        return 'text-gray-400 dark:text-gray-500'
    }
  }

  return (
    <Card className="bg-white dark:bg-gray-950/50">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">学习进程导航</h3>
            {hasContextForIteration && (
              <Badge variant="secondary" className="text-xs">
                支持迭代优化
              </Badge>
            )}
          </div>

          <nav>
            <ol className="space-y-3">
              {stages.map((stage, index) => {
                const status = getStageStatus(stage)
                const iterations = iterationCount[stage.id] || 0
                const canGoBack = canNavigateBack(stage.id)
                const canRefineStage = canRefine(stage.id)

                return (
                  <li key={stage.id} className="group">
                    <div className="flex items-start space-x-3">
                      {/* Status Icon */}
                      <div className="flex flex-col items-center">
                        {getStatusIcon(stage)}
                        {index < stages.length - 1 && (
                          <div 
                            className={`w-px h-8 mt-2 ${
                              status === 'completed' 
                                ? 'bg-green-500' 
                                : 'bg-gray-300 dark:bg-gray-700'
                            }`} 
                          />
                        )}
                      </div>

                      {/* Stage Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-medium ${getStatusColor(stage)}`}>
                              {stage.id}
                            </p>
                            <h4 className={`text-base font-medium ${
                              status === 'active'
                                ? 'text-gray-900 dark:text-white'
                                : status === 'completed'
                                  ? 'text-gray-600 dark:text-gray-300'
                                  : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {stage.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {stage.description}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-2">
                            {iterations > 0 && (
                              <Badge variant="outline" className="text-xs">
                                第{iterations + 1}轮
                              </Badge>
                            )}
                            
                            {canGoBack && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onNavigate(stage.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="返回此阶段"
                              >
                                <ArrowLeft className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {canRefineStage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRefine(stage.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="优化此阶段"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Iteration Warning */}
                        {status === 'active' && iterations > 0 && (
                          <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              <span className="text-xs text-orange-700 dark:text-orange-300">
                                迭代模式：基于前序阶段的调整重新生成
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Navigation Tips */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <h4 className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
              迭代学习提示：
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• 从S2开始支持返回优化前序阶段</li>
              <li>• 修改前序阶段会智能更新后续内容</li>
              <li>• 迭代次数会被记录用于学习分析</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
