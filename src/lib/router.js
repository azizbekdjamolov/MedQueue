import { useCallback, useEffect, useState } from 'react'

/**
 * Minimal path-based router. No dependency needed for two pages:
 * path state mirrors window.location.pathname and updates on
 * pushState/replaceState/popstate.
 */
export function useRouter() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to, state) => {
    window.history.pushState(state ?? null, '', to)
    setPath(window.location.pathname)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  return { path, navigate }
}