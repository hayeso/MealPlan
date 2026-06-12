import { useMemo, useState } from 'react'
import type { ShoppingItem } from '../../types/recipe'

interface Props {
  items: ShoppingItem[]
}

const CATEGORY_ORDER = [
  'Produce',
  'Meat & Fish',
  'Dairy & Eggs',
  'Tins & Jars',
  'Pantry',
  'Spices & Seasonings',
  'Other',
]

export default function ShoppingList({ items }: Props) {
  const [copied, setCopied] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    for (const item of items) {
      const cat = item.category || 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return CATEGORY_ORDER
      .filter(cat => map.has(cat))
      .map(cat => ({ category: cat, items: map.get(cat)! }))
  }, [items])

  const handleCopy = async () => {
    const text = grouped
      .map(g => `${g.category}\n${g.items.map(i => `  ${i.totalAmount} ${i.ingredient}`).join('\n')}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </span>
          Shopping List
        </h2>
        <button
          onClick={handleCopy}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? 'Copied!' : 'Copy list'}
        </button>
      </div>

      <div className="space-y-5">
        {grouped.map(g => (
          <div key={g.category}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {g.category}
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {g.items.map((item, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-gray-800">
                      {item.totalAmount}
                    </span>
                    <span className="text-sm text-gray-600">{item.ingredient}</span>
                  </div>
                  <span className="text-xs text-gray-400 truncate max-w-[200px]">
                    {item.usedIn.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
