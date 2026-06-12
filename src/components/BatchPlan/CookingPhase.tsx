import type { CookStep } from '../../types/recipe'
import { useStore } from '../../store/useStore'
import ContainerBadge from './ContainerBadge'

interface Props {
  steps: CookStep[]
  compact?: boolean
}

export default function CookingPhase({ steps, compact = false }: Props) {
  const completedSteps = useStore(s => s.completedSteps)
  const toggleStep = useStore(s => s.toggleStep)

  return (
    <div>
      <h2 className={`font-bold text-gray-900 flex items-center gap-2 ${compact ? 'text-xl mb-3' : 'text-lg mb-4'}`}>
        <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        </span>
        Cooking Phase
        <span className="text-sm font-normal text-gray-400">
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
                className={`rounded-xl border p-4 cursor-pointer transition ${
                  done
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : 'bg-white border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition ${
                    done
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {done ? '✓' : step.step}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${compact ? 'text-lg' : 'text-sm'} ${
                      done ? 'line-through text-gray-400' : 'text-gray-800'
                    }`}>
                      {step.task}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {step.containers.map(c => (
                        <ContainerBadge key={c} label={c} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {step.splitAfter && step.splitReason && (
                <div className="ml-10 my-2 flex items-center gap-2">
                  <div className="flex-1 h-px bg-amber-300" />
                  <span className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                    SPLIT — {step.splitReason}
                  </span>
                  <div className="flex-1 h-px bg-amber-300" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
