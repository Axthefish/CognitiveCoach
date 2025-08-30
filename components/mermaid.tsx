"use client"

import { useEffect, useState } from "react"
import mermaid from "mermaid"

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "sans-serif",
})

interface MermaidProps {
  chart: string
}

export default function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    const renderMermaid = async () => {
      try {
        // sanitize: replace HTML line breaks and trim BOM/whitespace
        const sanitize = (src: string): string => src
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/^\uFEFF/, '')
          .trim();
        const { svg } = await mermaid.render("mermaid-graph", sanitize(chart))
        setSvg(svg)
      } catch (error) {
        console.error("Mermaid rendering failed:", error)
      }
    }
    renderMermaid()
  }, [chart])

  if (!svg) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading diagram...</p>
      </div>
    )
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />
}
