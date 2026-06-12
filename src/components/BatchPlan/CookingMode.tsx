import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import type { PrepTask, CookStep } from '../../types/recipe'
import ContainerBadge from './ContainerBadge'
import { useState } from 'react'

function CookingPrepPhase({ tasks }: { tasks: PrepTask[] }) {
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
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-yellow-900/50 text-yellow-400 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
          </svg>
        </span>
        Prep Phase
        <span className="text-sm font-normal text-gray-500">{checked.size}/{tasks.length} done</span>
      </h2>
      <div className="space-y-3">
        {tasks.map((task, i) => (
          <div
            key={i}
            onClick={() => toggle(i)}
            className={`rounded-xl border p-5 cursor-pointer transition ${
              checked.has(i)
                ? 'bg-gray-800/50 border-gray-700 opacity-50'
                : 'bg-gray-900 border-gray-700 hover:border-orange-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 w-6 h-6 mt-0.5 rounded border-2 flex items-center justify-center transition ${
                checked.has(i) ? 'bg-orange-500 border-orange-500' : 'border-gray-600'
              }`}>
                {checked.has(i) && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-lg font-medium ${
                  checked.has(i) ? 'line-through text-gray-500' : 'text-gray-100'
                }`}>
                  {task.task}
                </p>
                {task.distribute.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {task.distribute.map((d, di) => (
                      <div key={di} className="flex items-center gap-1.5">
                        <ContainerBadge label={d.container} />
                        <span className="text-sm text-gray-400">{d.amount}</span>
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

function CookingCookPhase({ steps }: { steps: CookStep[] }) {
  const completedSteps = useStore(s => s.completedSteps)
  const toggleStep = useStore(s => s.toggleStep)

  return (
    <div>
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-red-900/50 text-red-400 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        </span>
        Cooking Phase
        <span className="text-sm font-normal text-gray-500">
          {steps.filter((_, i) => completedSteps.includes(i)).length}/{steps.length} done
        </span>
      </h2>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const done = completedSteps.includes(i)
          return (
            <div key={i}>
              <div
                onClick={() => toggleStep(i)}
                className={`rounded-xl border p-5 cursor-pointer transition ${
                  done
                    ? 'bg-gray-800/50 border-gray-700 opacity-50'
                    : 'bg-gray-900 border-gray-700 hover:border-orange-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition ${
                    done ? 'bg-orange-500 text-white' : 'bg-orange-900/50 text-orange-400'
                  }`}>
                    {done ? '✓' : step.step}
                  </div>
                  <div className="flex-1">
                    <p className={`text-lg font-medium ${
                      done ? 'line-through text-gray-500' : 'text-gray-100'
                    }`}>
                      {step.task}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {step.containers.map(c => (
                        <ContainerBadge key={c} label={c} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {step.splitAfter && step.splitReason && (
                <div className="ml-11 my-3 flex items-center gap-2">
                  <div className="flex-1 h-px bg-amber-600/50" />
                  <span className="shrink-0 text-sm font-semibold text-amber-400 bg-amber-900/30 border border-amber-700/50 px-3 py-1.5 rounded-full">
                    SPLIT — {step.splitReason}
                  </span>
                  <div className="flex-1 h-px bg-amber-600/50" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CookingMode() {
  const plan = useStore(s => s.plan)
  const setCookingMode = useStore(s => s.setCookingMode)
  const completedSteps = useStore(s => s.completedSteps)
  const navigate = useNavigate()

  if (!plan) {
    navigate('/plan')
    return null
  }

  const totalCookSteps = plan.cookingPhase.length
  const doneCount = completedSteps.length
  const progress = totalCookSteps > 0 ? Math.round((doneCount / totalCookSteps) * 100) : 0

  const handleExit = () => {
    setCookingMode(false)
    navigate('/plan')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExit}
              className="text-gray-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-lg font-bold">Cooking Mode</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{progress}% complete</span>
            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
        <CookingPrepPhase tasks={plan.prepPhase} />
        <div className="border-t border-gray-800 pt-8">
          <CookingCookPhase steps={plan.cookingPhase} />
        </div>

        {progress === 100 && (
          <div className="text-center py-8">
            <p className="text-3xl font-bold text-orange-400 mb-2">All done!</p>
            <p className="text-gray-400">Your batch cooking session is complete.</p>
            <button
              onClick={handleExit}
              className="mt-4 bg-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-orange-600 transition"
            >
              View Full Plan
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
