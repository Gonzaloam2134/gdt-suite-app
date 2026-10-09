import { describe, it, expect } from 'vitest'
import { validarComprobante, construirRutaComprobante, debeComprimirse, TAMANO_MAXIMO_BYTES } from '../lib/domain/comprobantes'

describe('validarComprobante', () => {
  it('sin archivo → error', () => {
    expect(validarComprobante(null)).toEqual({ ok: false, error: 'No se seleccionó ningún archivo' })
  })

  it('jpg dentro del límite → ok', () => {
    expect(validarComprobante({ type: 'image/jpeg', size: 1024 })).toEqual({ ok: true })
  })

  it('pdf dentro del límite → ok', () => {
    expect(validarComprobante({ type: 'application/pdf', size: 1024 })).toEqual({ ok: true })
  })

  it('tipo no admitido (video) → error', () => {
    const r = validarComprobante({ type: 'video/mp4', size: 1024 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/formato/i)
  })

  it('más grande que el límite → error', () => {
    const r = validarComprobante({ type: 'image/png', size: TAMANO_MAXIMO_BYTES + 1 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/8MB/)
  })

  it('exactamente en el límite → ok (el límite es inclusive)', () => {
    expect(validarComprobante({ type: 'image/png', size: TAMANO_MAXIMO_BYTES })).toEqual({ ok: true })
  })
})

describe('construirRutaComprobante', () => {
  it('arranca con el local_id como primer segmento (lo lee storage.foldername en las policies)', () => {
    const ruta = construirRutaComprobante('local-abc', 'tx-123', 'image/jpeg')
    expect(ruta.split('/')[0]).toBe('local-abc')
  })

  it('incluye el transaccion_id y la extensión correcta según el mime type', () => {
    const ruta = construirRutaComprobante('local-abc', 'tx-123', 'application/pdf')
    expect(ruta).toContain('tx-123')
    expect(ruta.endsWith('.pdf')).toBe(true)
  })

  it('mime type desconocido → extensión .bin en vez de romper', () => {
    const ruta = construirRutaComprobante('local-abc', 'tx-123', 'application/octet-stream')
    expect(ruta.endsWith('.bin')).toBe(true)
  })
})

describe('debeComprimirse', () => {
  it('jpg, png y webp se comprimen', () => {
    expect(debeComprimirse('image/jpeg')).toBe(true)
    expect(debeComprimirse('image/png')).toBe(true)
    expect(debeComprimirse('image/webp')).toBe(true)
  })

  it('pdf no se toca (ya suele venir liviano)', () => {
    expect(debeComprimirse('application/pdf')).toBe(false)
  })

  it('heic no se toca (canvas no lo decodifica de forma confiable)', () => {
    expect(debeComprimirse('image/heic')).toBe(false)
  })
})
