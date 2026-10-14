import { useCallback, useEffect, useState } from 'react'

/* Fetch on mount and on demand. Keeps the previous rows while reloading (no layout jump). */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setLoading(true)
    return fn()
      .then((d) => { setData(d); setError(null); return d })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, deps)
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load, setData }
}
