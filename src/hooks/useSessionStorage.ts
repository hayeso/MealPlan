import { useCallback, useEffect, useState } from 'react'

export function useSessionStorageSet(key: string | null, initial: Set<string> = new Set()) {
  const [value, setValue] = useState<Set<string>>(() => {
    if (!key) return initial
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) return new Set(JSON.parse(raw) as string[])
    } catch {
      /* ignore */
    }
    return initial
  })

  useEffect(() => {
    if (!key) return
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) setValue(new Set(JSON.parse(raw) as string[]))
      else setValue(initial)
    } catch {
      setValue(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const persist = useCallback(
    (next: Set<string>) => {
      setValue(next)
      if (key) {
        try {
          sessionStorage.setItem(key, JSON.stringify([...next]))
        } catch {
          /* ignore */
        }
      }
    },
    [key],
  )

  const toggle = useCallback(
    (item: string) => {
      persist(
        (() => {
          const next = new Set(value)
          next.has(item) ? next.delete(item) : next.add(item)
          return next
        })(),
      )
    },
    [value, persist],
  )

  const reset = useCallback(() => persist(new Set()), [persist])

  return { value, setValue: persist, toggle, reset }
}

export function useSessionStorageNumbers(key: string | null) {
  const [value, setValue] = useState<Set<number>>(() => {
    if (!key) return new Set()
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) return new Set(JSON.parse(raw) as number[])
    } catch {
      /* ignore */
    }
    return new Set()
  })

  useEffect(() => {
    if (!key) return
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) setValue(new Set(JSON.parse(raw) as number[]))
      else setValue(new Set())
    } catch {
      setValue(new Set())
    }
  }, [key])

  const persist = useCallback(
    (next: Set<number>) => {
      setValue(next)
      if (key) {
        try {
          sessionStorage.setItem(key, JSON.stringify([...next]))
        } catch {
          /* ignore */
        }
      }
    },
    [key],
  )

  const toggle = useCallback(
    (item: number) => {
      persist(
        (() => {
          const next = new Set(value)
          next.has(item) ? next.delete(item) : next.add(item)
          return next
        })(),
      )
    },
    [value, persist],
  )

  return { value, toggle, setValue: persist }
}
