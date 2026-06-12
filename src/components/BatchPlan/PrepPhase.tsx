import { useState } from 'react'
import type { PrepTask } from '../../types/recipe'
import ContainerBadge from './ContainerBadge'

interface Props {
  tasks: PrepTask[]
  compact?: boolean
}

export default function PrepPhase({ tasks, compact = false }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div>
      <h2 className={`font-bold text-gray-900 flex items-center gap-2 ${compact ? 'text-xl mb-3' : 'text-lg mb-4'}`}>
        <span className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
          </svg>
        </span>
        Prep Phase
        <span className="text-sm font-normal text-gray-400">
          {checked.size}/{tasks.length} done
        </span>
      </h2>

      <div className="space-y-3">
        {tasks.map((task, i) => (
          <div
            key={i}
            onClick={() => toggle(i)}
            className={`rounded-xl border p-4 cursor-pointer transition ${
              checked.has(i)
                ? 'bg-gray-50 border-gray-200 opacity-60'
                : 'bg-white border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition ${
                checked.has(i)
                  ? 'bg-orange-500 border-orange-500'
                  : 'border-gray-300'
              }`}>
                {checked.has(i) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${compact ? 'text-lg' : 'text-sm'} ${
                  checked.has(i) ? 'line-through text-gray-400' : 'text-gray-800'
                }`}>
                  {task.task}
                </p>
                {task.distribute.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.distribute.map((d, di) => (
                      <div key={di} className="flex items-center gap-1.5">
                        <ContainerBadge label={d.container} />
                        <span className="text-xs text-gray-500">{d.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
