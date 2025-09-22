"use client"

import { Card, CardContent } from "@/components/ui/card"

export interface TimelineItem { id: string; label: string; note?: string }

export default function CorePathTimeline({ items, onStepFocus }: { items: TimelineItem[]; onStepFocus?: (id: string) => void }) {
  const steps = items.slice(0, 5)
  return (
    <Card className="bg-white dark:bg-gray-950/40">
      <CardContent className="p-4">
        <div className="flex items-stretch gap-4 overflow-x-auto">
          {steps.map((s, idx) => (
            <button
              key={s.id}
              className="min-w-[160px] text-left px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-800"
              onClick={() => onStepFocus?.(s.id)}
            >
              <div className="text-xs text-gray-500">步骤 {idx + 1}</div>
              <div className="font-medium truncate" title={s.label}>{s.label}</div>
              {s.note && <div className="text-xs text-gray-600 dark:text-gray-300 truncate" title={s.note}>{s.note}</div>}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


