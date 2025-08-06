import type { State } from "@/lib/types"
import { CheckCircle, Circle, CircleDot } from "lucide-react"

interface FsmNavigatorProps {
  states: State[]
  currentState: State["id"]
  completedStates: State["id"][]
}

export default function FsmNavigator({ states, currentState, completedStates }: FsmNavigatorProps) {
  return (
    <nav>
      <ol className="space-y-2">
        {states.map((state, index) => {
          const isCompleted = completedStates.includes(state.id)
          const isActive = currentState === state.id

          return (
            <li key={state.id} className="flex items-start">
              <div className="flex flex-col items-center mr-4">
                {isCompleted ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : isActive ? (
                  <CircleDot className="w-6 h-6 text-blue-600 animate-pulse" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-400 dark:text-gray-600" />
                )}
                {index < states.length - 1 && (
                  <div className={`w-px h-10 mt-2 ${isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"}`} />
                )}
              </div>
              <div className="pt-0.5">
                <p
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : isCompleted
                        ? "text-gray-500 dark:text-gray-400"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {state.id}
                </p>
                <h3
                  className={`text-base ${
                    isActive
                      ? "font-bold text-gray-900 dark:text-white"
                      : isCompleted
                        ? "font-medium text-gray-600 dark:text-gray-300 line-through"
                        : "font-medium text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {state.name}
                </h3>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
