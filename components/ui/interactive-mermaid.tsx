"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import mermaid from "mermaid"
import { Button } from "@/components/ui/button"
import { useCognitiveCoachStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, Eye, EyeOff, HelpCircle, Zap } from "lucide-react"
import { reportError } from "@/lib/app-errors"

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "sans-serif",
})

interface Node {
  id: string;
  title: string;
}

interface InteractiveMermaidProps {
  chart: string;
  nodes?: Node[];
  onNodeClick?: (nodeId: string) => void;
  onWhatIfSimulation?: (removedNodeId: string) => void;
  nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }>;
}

interface NodeDetail {
  id: string;
  title: string;
  description: string;
  connections: string[];
  importance: 'high' | 'medium' | 'low';
}

export function InteractiveMermaid({ 
  chart, 
  nodes = [], 
  onNodeClick,
  onWhatIfSimulation,
  nodeAnalogies = []
}: InteractiveMermaidProps) {
  const setSelectedNodeId = useCognitiveCoachStore(state => state.setSelectedNodeId)
  const [svg, setSvg] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [nodeDetails, setNodeDetails] = useState<Record<string, NodeDetail>>({})
  const [whatIfMode, setWhatIfMode] = useState(false)
  const [removedNodes, setRemovedNodes] = useState<string[]>([])
  const [showNodeList, setShowNodeList] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastGoodSvgRef = useRef<string | null>(null)
  const [renderWarning, setRenderWarning] = useState<string | null>(null)
  const [density, setDensity] = useState<number>(70) // 0-100, higher = more edges

  // Generate mock node details based on available nodes
  const generateNodeDetails = useCallback((nodes: Node[]): Record<string, NodeDetail> => {
    const details: Record<string, NodeDetail> = {}
    
    nodes.forEach((node, index) => {
      details[node.id] = {
        id: node.id,
        title: node.title,
        description: `${node.title}是学习路径中的关键节点，包含重要的概念和技能。掌握这一部分对于整体目标的实现至关重要。`,
        connections: nodes.filter((_, i) => i !== index).slice(0, 2).map(n => n.title),
        importance: index < 2 ? 'high' : index < 4 ? 'medium' : 'low'
      }
    })
    
    return details
  }, [])

  // Initialize node details
  useEffect(() => {
    if (nodes.length > 0) {
      setNodeDetails(generateNodeDetails(nodes))
    }
  }, [nodes, generateNodeDetails])

  // Render Mermaid chart
  useEffect(() => {
    const renderMermaid = async () => {
      let processedChart = '';
      try {
        // Sanitize incoming chart text to avoid common breakages (e.g., stray <br/>)
        const sanitize = (src: string): string => {
          const s = src.replace(/<br\s*\/?>/gi, '\n');
          // Ensure graph direction prefix is correct
          if (!/^\s*graph\s+TD/.test(s)) {
            const idx = s.indexOf('graph ');
            if (idx >= 0) {
              // leave as is if another direction is used; mermaid will still render
            }
          }
          return s;
        };

        processedChart = sanitize(chart)
        
        // Apply what-if simulation by modifying the chart
        if (whatIfMode && removedNodes.length > 0) {
          const removedSet = new Set(removedNodes)
          processedChart = chart
            .split('\n')
            .map(line => {
              for (const id of removedSet) {
                if (id && line.includes(id)) {
                  return `%% REMOVED(${id}): ${line}`
                }
              }
              return line
            })
            .join('\n')
        }

        // Apply density filter: comment out a portion of edges based on density
        // Heuristic: treat lines that look like `A-->B` or `A---B` as edges
        if (density < 100) {
          const edgeRegex = /\b[-.]{2,}>?\b/;
          let keepEvery = 1;
          if (density >= 80) keepEvery = 1; else if (density >= 60) keepEvery = 2; else if (density >= 40) keepEvery = 3; else if (density >= 20) keepEvery = 4; else keepEvery = 5;
          let edgeCount = 0;
          const lines = processedChart.split('\n');
          processedChart = lines.map(line => {
            if (edgeRegex.test(line)) {
              edgeCount++;
              return (edgeCount % keepEvery === 0) ? line : `%% DENSITY_HIDDEN: ${line}`
            }
            return line;
          }).join('\n');
        }
        
        const { svg } = await mermaid.render("interactive-mermaid-graph", processedChart)
        setSvg(svg)
        lastGoodSvgRef.current = svg
        setRenderWarning(null)
      } catch (error) {
        // 使用统一的错误报告系统
        reportError(error instanceof Error ? error : new Error(String(error)), {
          context: 'MermaidRendering',
          chart: processedChart?.substring(0, 200)
        });
        // Fallback to last good SVG to avoid blank
        if (lastGoodSvgRef.current) {
          setSvg(lastGoodSvgRef.current)
          setRenderWarning('图表渲染遇到问题，已显示上一次可用的版本。')
        } else {
          setSvg(null)
        }
      }
    }
    renderMermaid()
  }, [chart, whatIfMode, removedNodes, density])

  // Add click handlers to SVG elements
  useEffect(() => {
    if (!svg || !containerRef.current) return

    const container = containerRef.current
    const svgElement = container.querySelector('svg')
    
    if (!svgElement) return

    // Add click handlers to nodes
    const nodeElements = svgElement.querySelectorAll('.node')
    const removedSet = new Set(removedNodes)
    nodeElements.forEach((nodeElement) => {
      const nodeId = nodeElement.id || nodeElement.getAttribute('data-id')
      if (nodeId && nodeElement instanceof HTMLElement) {
        nodeElement.style.cursor = 'pointer'
        nodeElement.addEventListener('click', () => {
          setSelectedNode(nodeId)
          onNodeClick?.(nodeId)
          try { setSelectedNodeId(nodeId) } catch {}
        })
        
        // Add hover effects
        nodeElement.addEventListener('mouseenter', () => {
          nodeElement.style.opacity = removedSet.has(nodeId) ? '0.5' : '0.8'
        })
        nodeElement.addEventListener('mouseleave', () => {
          nodeElement.style.opacity = removedSet.has(nodeId) ? '0.5' : '1'
        })

        // Visual mark for removed nodes in what-if mode
        if (whatIfMode && removedSet.has(nodeId)) {
          nodeElement.style.opacity = '0.5'
          nodeElement.style.filter = 'grayscale(0.6)'
        } else {
          nodeElement.style.filter = ''
        }

        // Focus dimming: if a node is selected, dim all others except the selected and its direct connections
        if (selectedNode) {
          const isSelected = selectedNode === nodeId
          if (!isSelected) {
            nodeElement.style.opacity = Math.min(parseFloat(nodeElement.style.opacity || '1'), 0.35).toString()
          }
        }
      }
    })

    // Cleanup function
    return () => {
      nodeElements.forEach((nodeElement) => {
        nodeElement.replaceWith(nodeElement.cloneNode(true))
      })
    }
  }, [svg, onNodeClick, whatIfMode, removedNodes, selectedNode, setSelectedNodeId])

  const handleWhatIfSimulation = (nodeId: string) => {
    setWhatIfMode(true)
    setRemovedNodes(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId])
    onWhatIfSimulation?.(nodeId)
  }

  const resetSimulation = () => {
    setWhatIfMode(false)
    setRemovedNodes([])
  }

  const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const getImportanceIcon = (importance: 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'high': return '🔥'
      case 'medium': return '⚡'
      case 'low': return '✨'
    }
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-500">正在渲染交互式图表...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Button 
            variant={whatIfMode ? "default" : "outline"} 
            size="sm"
            onClick={() => setWhatIfMode(!whatIfMode)}
            aria-pressed={whatIfMode}
          >
            <Zap className="w-4 h-4 mr-1" />
            {whatIfMode ? '开启模拟' : '开启模拟'}
          </Button>
          {whatIfMode && (
            <Button variant="outline" size="sm" onClick={resetSimulation} aria-disabled={!whatIfMode}>
              重置模拟
            </Button>
          )}
          <Button 
            variant={showNodeList ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowNodeList(!showNodeList)}
            aria-pressed={showNodeList}
          >
            {showNodeList ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            节点列表
          </Button>
        </div>
        {/* Density slider */}
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>细节</span>
          <input
            type="range"
            min={10}
            max={100}
            step={10}
            value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
            className="w-32"
            aria-label="edge density"
          />
          <span>{density}%</span>
        </div>

        {whatIfMode && (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            <HelpCircle className="w-3 h-3 mr-1" />
            点击节点进行移除模拟
          </Badge>
        )}
      </div>

      {/* What-If Alert */}
      {whatIfMode && removedNodes.length > 0 && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">
                模拟场景：已标记移除节点 {removedNodes.map(id => `"${id}"`).join('、')}
              </span>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              观察系统结构的变化，了解该节点的重要性
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Mermaid Chart */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300 mb-2">
                <span className="font-medium">图例:</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>促进</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>抑制</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>依赖/顺序</span>
                {whatIfMode && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>模拟移除</span>}
              </div>
              <div 
                ref={containerRef}
                className="overflow-auto max-h-96"
                dangerouslySetInnerHTML={{ __html: svg }} 
              />
            </CardContent>
          </Card>
        </div>

        {/* Node List and Details */}
        {showNodeList && (
          <div className="lg:col-span-1 space-y-4">
            {/* Node List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">节点概览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nodes.map((node) => {
                  const detail = nodeDetails[node.id]
                  const isSelected = selectedNode === node.id
                  const isRemoved = whatIfMode && removedNodes.includes(node.id)
                  
                  return (
                    <div
                      key={node.id}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                          : isRemoved
                          ? 'bg-red-50 border-red-200 opacity-50 dark:bg-red-900/20 dark:border-red-800'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-800 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => {
                        if (whatIfMode) {
                          handleWhatIfSimulation(node.id)
                        } else {
                          setSelectedNode(node.id)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{node.title}</span>
                        {detail && (
                          <span className="text-xs">
                            {getImportanceIcon(detail.importance)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {isRemoved ? '已移除' : node.id}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Node Details */}
            {selectedNode && nodeDetails[selectedNode] && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">节点详情</CardTitle>
                    <Badge 
                      className={getImportanceColor(nodeDetails[selectedNode].importance)}
                    >
                      {nodeDetails[selectedNode].importance}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">{nodeDetails[selectedNode].title}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {nodeDetails[selectedNode].description}
                    </p>
                  </div>
                  {/* Examples section */}
                  <div>
                    <h4 className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">示例与练习:</h4>
                    <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <li>• 用一句话阐明该概念与总体目标的关系</li>
                      <li>• 找一个真实项目中出现该概念的场景</li>
                      <li>• 设计一个 20 分钟的小练习去检验理解</li>
                    </ul>
                  </div>
                  
                  {nodeDetails[selectedNode].connections.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">相关连接:</h4>
                      <div className="space-y-1">
                        {nodeDetails[selectedNode].connections.map((connection, index) => (
                          <div key={index} className="text-xs text-gray-500 flex items-center">
                            <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                            {connection}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {nodeAnalogies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">日常类比:</h4>
                      {nodeAnalogies.filter(a => a.nodeId === selectedNode).slice(0,1).map((a, idx) => (
                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div>像什么：{a.analogy}</div>
                          {a.example && <div>在哪见过：{a.example}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {whatIfMode && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleWhatIfSimulation(selectedNode)}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      模拟移除此节点
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Help Card */}
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">交互提示:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• 点击图中节点查看详情</li>
                      <li>• 启用What-If模式模拟节点移除</li>
                      <li>• 观察节点重要性等级</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      {/* Render warning for fallback, if any */}
      {renderWarning && (
        <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
          {renderWarning}
        </div>
      )}
    </div>
  )
}
