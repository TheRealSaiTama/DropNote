import { useCallback, useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const readValue = useCallback(() => {
    const fallbackValue =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue

    if (typeof window === 'undefined') {
      return fallbackValue
    }

    const item = window.localStorage.getItem(key)

    if (!item) {
      return fallbackValue
    }

    try {
      return JSON.parse(item) as T
    } catch {
      return fallbackValue
    }
  }, [initialValue, key])

  const [storedValue, setStoredValue] = useState<T>(readValue)

  useEffect(() => {
    setStoredValue(readValue())
  }, [readValue])

  const setValue = useCallback(
    (value: T | ((value: T) => T)) => {
      setStoredValue((currentValue) => {
        const nextValue =
          typeof value === 'function'
            ? (value as (value: T) => T)(currentValue)
            : value

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(nextValue))
        }

        return nextValue
      })
    },
    [key],
  )

  return [storedValue, setValue] as const
}
