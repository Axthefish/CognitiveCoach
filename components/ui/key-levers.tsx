"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export interface KeyLever {
  id: string
  title: string
  impact: string
  nextAction: string
}

export default function KeyLevers({ items, onTry }: { items: KeyLever[]; onTry?: (id: string) => void }) {
  const top2 = items.slice(0, 2)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {top2.map(item => (
        <Card key={item.id} className="bg-white dark:bg-gray-950/40">
          <CardContent className="p-4 space-y-2">
            <div className="font-medium truncate" title={item.title}>{item.title}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 truncate" title={item.impact}>{item.impact}</div>
            <div className="text-sm">此刻你最该做的事：<span className="font-medium">{item.nextAction}</span></div>
            <Button size="sm" onClick={() => onTry?.(item.id)}>立即尝试</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}


