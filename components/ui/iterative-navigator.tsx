"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Circle, CircleDot, ArrowLeft, RotateCcw, AlertTriangle, ChevronDown, ChevronUp, Eye, X } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"
import type { FSMState } from "@/lib/types"

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
  const [collapsed, setCollapsed] = React.useState(false)
  const [density, setDensity] = React.useState<'standard' | 'compact'>('standard')
  const [showPreview, setShowPreview] = React.useState(false)
  const [previewStage, setPreviewStage] = React.useState<Stage | null>(null)
  const [showOnboardTip, setShowOnboardTip] = React.useState(false)

  const activeIndex = stages.findIndex(s => s.id === currentState)
  const activeStage = stages[activeIndex]
  const totalStages = stages.length
  const progressPercent = Math.max(0, Math.min(100, Math.round(((activeIndex) / Math.max(1, totalStages - 1)) * 100)))

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('iterativeNavigatorCollapsed')
    if (saved === null) {
      const isSmall = window.matchMedia('(max-width: 640px)').matches
      setCollapsed(isSmall)
    } else {
      setCollapsed(saved === '1')
    }
    const savedDensity = window.localStorage.getItem('iterativeNavigatorDensity')
    if (savedDensity === 'compact' || savedDensity === 'standard') setDensity(savedDensity)
    const onboardSeen = window.localStorage.getItem('iterativeNavigatorOnboardV1')
    setShowOnboardTip(onboardSeen !== '1')
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('iterativeNavigatorCollapsed', collapsed ? '1' : '0')
  }, [collapsed])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('iterativeNavigatorDensity', density)
  }, [density])

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

  const spacingClass = density === 'compact' ? 'space-y-2' : 'space-y-3'
  const connectorHeightClass = density === 'compact' ? 'h-6' : 'h-8'

  const userContext = useCognitiveCoachStore(state => state.userContext)

  const renderPreviewContent = (stageId: FSMState) => {
    switch (stageId) {
      case 'S1_KNOWLEDGE_FRAMEWORK': {
        const kf = userContext.knowledgeFramework
        if (!kf || kf.length === 0) return <div className="text-gray-500">暂无知识框架结果</div>
        const titles = kf.slice(0, 8).map(n => n.title)
        return (
          <div>
            <div className="text-sm mb-2">节点数：{kf.length}</div>
            <ul className="list-disc pl-5 space-y-1">
              {titles.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )
      }
      case 'S2_SYSTEM_DYNAMICS': {
        const sd = userContext.systemDynamics
        if (!sd) return <div className="text-gray-500">暂无系统动力学结果</div>
        return (
          <div className="space-y-2">
            {sd.metaphor && (<div className="text-sm">隐喻：{sd.metaphor}</div>)}
            {sd.mermaidChart && (
              <pre className="text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-auto">{sd.mermaidChart.slice(0, 2000)}{sd.mermaidChart.length > 2000 ? '…' : ''}</pre>
            )}
          </div>
        )
      }
      case 'S3_ACTION_PLAN': {
        const plan = userContext.actionPlan
        if (!plan || plan.length === 0) return <div className="text-gray-500">暂无行动计划</div>
        return (
          <ol className="list-decimal pl-5 space-y-1">
            {plan.slice(0, 8).map(item => (<li key={item.id} className="text-sm">{item.text}</li>))}
          </ol>
        )
      }
      case 'S4_AUTONOMOUS_OPERATION': {
        const kpis = userContext.kpis
        if (!kpis || kpis.length === 0) return <div className="text-gray-500">暂无运营指标</div>
        return (
          <ul className="list-disc pl-5 space-y-1">
            {kpis.slice(0, 8).map((k, i) => (<li key={i} className="text-sm">{k}</li>))}
          </ul>
        )
      }
      default:
        return <div className="text-gray-500">暂无可预览内容</div>
    }
  }

  return (
    <Card className="bg-white dark:bg-gray-950/50">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">学习进程导航</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">第{activeIndex + 1}/{totalStages}阶段</span>
            </div>
            <div className="flex items-center gap-1">
              {hasContextForIteration && (
                <Badge variant="secondary" className="text-xs">
                  支持迭代优化
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDensity(d => d === 'compact' ? 'standard' : 'compact')}
                title={density === 'compact' ? '切换为标准密度' : '切换为紧凑密度'}
                aria-label="切换列表密度"
              >
                <span className="text-xs">{density === 'compact' ? '紧凑' : '标准'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(v => !v)}
                aria-expanded={!collapsed}
                aria-controls="iterative-nav-content"
                title={collapsed ? "展开导航" : "收起导航"}
              >
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                <span className="sr-only">{collapsed ? "展开" : "收起"}</span>
              </Button>
            </div>
            {showOnboardTip && !collapsed && (
              <div className="absolute right-0 mt-10 w-max max-w-xs p-2 pr-1 rounded-md bg-yellow-50 border border-yellow-200 text-[11px] text-yellow-900 shadow-sm">
                <div className="flex items-start gap-2">
                  <span>小提示：导航可收起，移动端默认收起。</span>
                  <button
                    className="ml-1 text-yellow-700 hover:text-yellow-900"
                    onClick={() => {
                      setShowOnboardTip(false)
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('iterativeNavigatorOnboardV1', '1')
                      }
                    }}
                    aria-label="关闭提示"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden" aria-hidden>
            <div
              className="absolute left-0 top-0 h-full bg-blue-500/70 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {collapsed && activeStage && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              当前：{activeStage.name}
            </p>
          )}

          {!collapsed && (
            <>
          <nav id="iterative-nav-content">
            <ol className={spacingClass}>
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
                            className={`w-px ${connectorHeightClass} mt-2 ${
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
                            {density === 'standard' && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {stage.description}
                              </p>
                            )}
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
                            {status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setPreviewStage(stage); setShowPreview(true) }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="查看结果"
                              >
                                <Eye className="w-4 h-4" />
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
            </>
          )}
        </div>
        {showPreview && previewStage && (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowPreview(false)} />
            <div className="relative z-[61] mx-auto mt-20 max-w-2xl w-[90%]">
              <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{previewStage.name} 结果预览</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} aria-label="关闭预览">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-3 max-h-[60vh] overflow-auto text-sm text-gray-800 dark:text-gray-200">
                    {renderPreviewContent(previewStage.id)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
