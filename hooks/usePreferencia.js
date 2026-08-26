import { useState, useEffect, useCallback } from 'react'

/**
 * Preferencia de interfaz recordada en el navegador (qué secciones dejó
 * colapsadas, por ejemplo). No son datos del negocio: si se pierden, no pasa nada.
 */
export function usePreferencia(clave, valorInicial) {
  const [valor, setValor] = useState(valorInicial)

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(`pref:${clave}`)
      if (guardado !== null) setValor(JSON.parse(guardado))
    } catch { /* preferencia corrupta o storage bloqueado: seguimos con el default */ }
  }, [clave])

  const guardar = useCallback((nuevo) => {
    setValor(prev => {
      const resultado = typeof nuevo === 'function' ? nuevo(prev) : nuevo
      try { localStorage.setItem(`pref:${clave}`, JSON.stringify(resultado)) } catch { /* sin storage, no persiste */ }
      return resultado
    })
  }, [clave])

  return [valor, guardar]
}
