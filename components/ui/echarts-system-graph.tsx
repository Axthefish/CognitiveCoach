"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as echarts from "echarts"
import "echarts-gl"
import { useCognitiveCoachStore } from "@/lib/store"

type Node = { id: string; title: string }

export interface EchartsSystemGraphProps {
  chart: string
  nodes?: Node[]
  onNodeClick?: (nodeId: string) => void
  nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }>
}

// Very small parser to extract nodes/edges from a Mermaid-like graph
// Accepts lines like: A[Title] --> B, A --- B, A -.-> B
function parseMermaidLike(source: string): { nodes: Array<{ id: string; name: string }>; edges: Array<{ source: string; target: string }>; } {
  const nodeLabel = new Map<string, string>()
  const edges: Array<{ source: string; target: string }> = []
  const lines = source.split("\n").map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.startsWith("%%")) continue
    const m = line.match(/^(\w+)(?:\s*\[[^\]]*\])?\s*[-.]{2,}>?\s*(\w+)/)
    if (m) {
      const a = m[1]
      const b = m[2]
      edges.push({ source: a, target: b })
      if (!nodeLabel.has(a)) nodeLabel.set(a, a)
      if (!nodeLabel.has(b)) nodeLabel.set(b, b)
    }
    const n = line.match(/^(\w+)\s*\[(.+?)\]/)
    if (n) {
      nodeLabel.set(n[1], n[2])
    }
  }
  const nodes = Array.from(nodeLabel.entries()).map(([id, name]) => ({ id, name }))
  return { nodes, edges }
}

export function EchartsSystemGraph({ chart, nodes = [], onNodeClick, nodeAnalogies = [] }: EchartsSystemGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])
  const setSelectedNodeId = useCognitiveCoachStore(s => s.setSelectedNodeId)
  const [ready, setReady] = useState(false)

  const parsed = useMemo(() => parseMermaidLike(chart), [chart])
  const nameMap = useMemo(() => {
    const map = new Map<string, string>()
    parsed.nodes.forEach(n => map.set(n.id, n.name))
    nodes.forEach(n => { if (n.id && n.title) map.set(n.id, n.title) })
    return map
  }, [parsed.nodes, nodes])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const inst = echarts.init(el, undefined, { renderer: "canvas" })
    instanceRef.current = inst
    setReady(true)

    const handle = () => inst.resize()
    window.addEventListener("resize", handle)
    return () => {
      window.removeEventListener("resize", handle)
      inst.dispose()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !instanceRef.current) return
    const inst = instanceRef.current

    const graphNodes = parsed.nodes.map(n => ({ id: n.id, name: nameMap.get(n.id) || n.name, value: 1, symbolSize: 46 }))
    const graphEdges = parsed.edges.map(e => ({ source: e.source, target: e.target }))

    const option: echarts.EChartsCoreOption = {
      animation: !prefersReducedMotion,
      animationDuration: prefersReducedMotion ? 0 : 320,
      animationEasing: "cubicOut",
      // keep label/lines as vector, heavy shadows disabled for perf
      backgroundColor: "transparent",
      tooltip: {
        confine: true,
        trigger: "item",
        formatter: (p: any) => {
          if (p.dataType === "node") {
            const id = (p.data && p.data.id) || p.name
            const analogy = nodeAnalogies.find(a => a.nodeId === id)
            return `<div style="max-width:240px"><div style="font-weight:600;margin-bottom:4px">${p.name}</div>${analogy ? `<div style="opacity:.8">类比：${analogy.analogy}</div>` : ""}</div>`
          }
          if (p.dataType === "edge") {
            return `${p.data.source} → ${p.data.target}`
          }
          return p.name
        }
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          edgeSymbol: ["circle", "arrow"],
          edgeSymbolSize: [2, 8],
          lineStyle: {
            color: "rgba(120, 144, 156, .45)",
            width: 1.2,
            curveness: 0.12
          },
          label: {
            show: true,
            position: "inside",
            color: "#1f2937",
            fontSize: 12,
            formatter: (p: any) => p.data.name
          },
          emphasis: {
            scale: true,
            label: { show: true, fontWeight: "600" },
            lineStyle: { width: 2 }
          },
          force: {
            repulsion: 420,
            gravity: 0.08,
            edgeLength: [80, 160]
          },
          data: graphNodes,
          links: graphEdges,
          // Motion polish
          animationDurationUpdate: prefersReducedMotion ? 0 : 380,
          animationEasingUpdate: "quarticOut",
          // accessibility hints
          silent: false,
          selectedMode: false
        }
      ]
    }

    inst.setOption(option, true)

    const clickHandler = (p: any) => {
      if (p.dataType === "node") {
        const id = p.data.id
        try { setSelectedNodeId(id) } catch {}
        onNodeClick?.(id)
      }
    }
    inst.on("click", clickHandler)

    return () => {
      inst.off("click", clickHandler)
    }
  }, [ready, parsed, nameMap, nodeAnalogies, prefersReducedMotion, onNodeClick, setSelectedNodeId])

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "420px" }}
      aria-label="系统关系图（可拖拽/缩放）"
    />
  )
}

export default EchartsSystemGraph


