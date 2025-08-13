"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lightbulb } from "lucide-react"
import Mermaid from "@/components/mermaid"
import { useCognitiveCoachStore } from "@/lib/store"

interface S2SystemDynamicsViewProps {
  onProceed: () => void
}

export default function S2SystemDynamicsView({ onProceed }: S2SystemDynamicsViewProps) {
  const { userContext } = useCognitiveCoachStore();
  const dynamics = userContext.systemDynamics;
  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S2: System Dynamics & Metaphor</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Let&apos;s visualize how the components of the system interact and establish a core metaphor to guide your
        understanding.
      </p>
      
      {dynamics ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-950/50 h-full">
              <CardHeader>
                <CardTitle>System Map</CardTitle>
              </CardHeader>
              <CardContent>
                <Mermaid chart={dynamics.mermaidChart} />
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
