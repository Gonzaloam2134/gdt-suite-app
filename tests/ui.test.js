import { describe, it, expect } from 'vitest'
import { claseBoton, claseBadge, claseDot } from '../lib/ui/estilos'

describe('claseBoton', () => {
  it('primary por defecto', () => {
    expect(claseBoton()).toContain('bg-primary-500')
  })
  it('success', () => {
    expect(claseBoton({ variant: 'success' })).toContain('bg-success-500')
  })
  it('danger', () => {
    expect(claseBoton({ variant: 'danger' })).toContain('bg-danger-500')
  })
  it('secondary y ghost no usan los tokens semánticos (son neutros)', () => {
    expect(claseBoton({ variant: 'secondary' })).toContain('bg-gray-100')
    expect(claseBoton({ variant: 'ghost' })).toContain('bg-transparent')
  })
  it('variant desconocida cae a primary, no rompe', () => {
    expect(claseBoton({ variant: 'inexistente' })).toContain('bg-primary-500')
  })
  it('tamaño sm vs md', () => {
    expect(claseBoton({ size: 'sm' })).toContain('text-xs')
    expect(claseBoton({ size: 'md' })).toContain('text-sm')
  })
  it('siempre incluye el estado disabled', () => {
    expect(claseBoton()).toContain('disabled:opacity-50')
  })
})

describe('claseBadge', () => {
  it('neutral por defecto', () => {
    expect(claseBadge()).toContain('bg-gray-100')
  })
  it('success/warning/danger usan sus tokens', () => {
    expect(claseBadge({ tone: 'success' })).toContain('bg-success-50')
    expect(claseBadge({ tone: 'warning' })).toContain('bg-warning-50')
    expect(claseBadge({ tone: 'danger' })).toContain('bg-danger-50')
  })
  it('tono desconocido cae a neutral, no rompe', () => {
    expect(claseBadge({ tone: 'inexistente' })).toContain('bg-gray-100')
  })
})

describe('claseDot', () => {
  it('cada tono tiene su color de punto', () => {
    expect(claseDot('success')).toContain('bg-success-500')
    expect(claseDot('warning')).toContain('bg-warning-500')
    expect(claseDot('danger')).toContain('bg-danger-500')
    expect(claseDot('neutral')).toContain('bg-gray-400')
  })
  it('sin tono cae a neutral', () => {
    expect(claseDot()).toContain('bg-gray-400')
  })
})
