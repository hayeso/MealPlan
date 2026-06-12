import { useState } from 'react'
import type { PrepDayPlan, PrepDayTask } from '../../types/recipe'
import ContainerBadge from './ContainerBadge'

interface Props {
  plan: PrepDayPlan
}

function StoragePill({ days }: { days: number }) {
  const color =
    days <= 1
      ? 'bg-red-100 text-red-700 border-red-200'
      : days <= 2
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-green-100 text-green-700 border-green-200'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Max {days} day{days !== 1 ? 's' : ''}
    </span>
  )
}

const CATEGORY_LABELS: Record<PrepDayTask['category'], string> = {
  vegetable_prep: 'Veg Prep',
  meat_prep: 'Meat Prep',
  marinating: 'Marinating',
  measuring: 'Measure & Portion',
  full_cook: 'Full Cook (reheat on cook day)',
}

const CATEGORY_COLORS: Record<PrepDayTask['category'], string> = {
  vegetable_prep: 'bg-green-50 text-green-700',
  meat_prep: 'bg-red-50 text-red-700',
  marinating: 'bg-purple-50 text-purple-700',
  measuring: 'bg-gray-50 text-gray-600',
  full_cook: 'bg-orange-50 text-orange-700',
}

export default function PrepDayView({ plan }: Props) {
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
    <div className="space-y-6">
      {/* Safety disclaimer — always visible */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800 mb-0.5">Food Safety Notice</p>
          <p className="text-sm text-amber-700">{plan.safetyDisclaimer}</p>
        </div>
      </div>

      {/* Recommended timing */}
      <div className="flex items-center gap-2">
        <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1.5 rounded-full border border-blue-200">
          Do this {plan.recommendedDaysInAdvance} day{plan.recommendedDaysInAdvance !== 1 ? 's' : ''} before your cook day
        </span>
        <span className="text-sm text-gray-500">
          {checked.size}/{plan.tasks.length} tasks done
        </span>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {plan.tasks.map((task, i) => (
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
                checked.has(i) ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
              }`}>
                {checked.has(i) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <p className={`text-sm font-medium ${
                    checked.has(i) ? 'line-through text-gray-400' : 'text-gray-800'
                  }`}>
                    {task.task}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${CATEGORY_COLORS[task.category]}`}>
                    {CATEGORY_LABELS[task.category]}
                  </span>
                  <StoragePill days={task.maxStorageDays} />
                  <span className="text-xs text-gray-400">{task.storage}</span>
                </div>

                {task.safetyNote && (
                  <div className="flex items-start gap-1.5 mb-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                    <svg className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs text-red-700 font-medium">{task.safetyNote}</p>
                  </div>
                )}

                {task.distribute.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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

      {/* Not recommended section */}
      {plan.notRecommended.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Not suitable for advance prep
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {plan.notRecommended.map((item, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.item}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
