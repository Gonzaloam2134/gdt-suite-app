import { useEffect } from 'react'

export function useClickOutside(ref, onOutside, activo = true) {
  useEffect(() => {
    if (!activo) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside, activo])
}
