"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface IntentStripProps {
  goal: string
  constraints?: { time?: string; level?: string }
  onConfirm?: (patch: { goal?: string; constraints?: { time?: string; level?: string } }) => void
}

export default function IntentStrip({ goal, constraints, onConfirm }: IntentStripProps) {
  const [editing, setEditing] = useState(false)
  const [draftGoal, setDraftGoal] = useState(goal)

  const showTime = constraints?.time && constraints.time.trim()
  const showLevel = constraints?.level && constraints.level.trim()

  return (
    <Card className="bg-white dark:bg-gray-950/40">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {!editing ? (
            <div className="flex items-center gap-3">
              <div className="font-medium truncate" title={goal}>{goal || '（未指定目标）'}</div>
              {showTime && <Badge variant="secondary" className="truncate" title={`时间窗口：${constraints?.time}`}>{constraints?.time}</Badge>}
              {showLevel && <Badge variant="secondary" className="truncate" title={`水平：${constraints?.level}`}>{constraints?.level}</Badge>}
            </div>
          ) : (
            <input
              className="px-2 py-1 text-sm bg-transparent border rounded w-full"
              value={draftGoal}
              onChange={(e) => setDraftGoal(e.target.value)}
              aria-label="编辑目标"
            />
          )}
        </div>
        <div className="flex-shrink-0">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>一键调整</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onConfirm?.({ goal: draftGoal }); setEditing(false) }}>确定</Button>
              <Button size="sm" variant="outline" onClick={() => { setDraftGoal(goal); setEditing(false) }}>取消</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


