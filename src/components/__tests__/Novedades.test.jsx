// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Novedades } from '../Novedades'
import { useNovedades } from '../../hooks/useNovedades'
import { RELEASES, VERSION_ACTUAL } from '../../lib/releases'

beforeEach(() => localStorage.clear())

describe('useNovedades', () => {
  it('primera vez: tutorial abierto y versión pendiente', () => {
    const { result } = renderHook(() => useNovedades())
    expect(result.current.modo).toBe('tutorial')
    expect(result.current.pendiente).toBe(true)
  })

  it('cerrar el tutorial lo marca visto y lee la versión', () => {
    const { result } = renderHook(() => useNovedades())
    act(() => result.current.cerrar())
    expect(result.current.modo).toBeNull()
    expect(result.current.pendiente).toBe(false)
    expect(localStorage.getItem('roncamotors_tutorial_visto')).toBe('1')
    expect(localStorage.getItem('roncamotors_version_vista')).toBe(VERSION_ACTUAL)
  })

  it('segunda entrada: sin tutorial; versión vieja deja pendiente hasta abrir la lista', () => {
    localStorage.setItem('roncamotors_tutorial_visto', '1')
    localStorage.setItem('roncamotors_version_vista', '0.1')
    const { result } = renderHook(() => useNovedades())
    expect(result.current.modo).toBeNull()
    expect(result.current.pendiente).toBe(true)
    act(() => result.current.abrirLista())
    expect(result.current.modo).toBe('lista')
    expect(result.current.pendiente).toBe(false)
    expect(result.current.versionVista).toBe('0.1')
  })
})

describe('Novedades', () => {
  it('todas las versiones; solo la nueva desplegada; las demás se abren al toque', async () => {
    const user = userEvent.setup()
    render(<Novedades abierto versionVista={RELEASES[1].version} onCerrar={() => {}} onRepetirTutorial={() => {}} />)
    for (const r of RELEASES) expect(screen.getByText(`Versión ${r.version}`)).toBeInTheDocument()
    expect(screen.getAllByText('Nueva')).toHaveLength(1)
    expect(screen.getByText(RELEASES[0].cambios[0].titulo)).toBeInTheDocument()
    expect(screen.queryByText(RELEASES[1].cambios[0].titulo)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: new RegExp(`Versión ${RELEASES[1].version}`) }))
    expect(screen.getByText(RELEASES[1].cambios[0].titulo)).toBeInTheDocument()
  })

  it('Repetir recorrido avisa', async () => {
    const user = userEvent.setup()
    let repetir = false
    render(<Novedades abierto versionVista={null} onCerrar={() => {}} onRepetirTutorial={() => { repetir = true }} />)
    await user.click(screen.getByRole('button', { name: /Repetir recorrido/ }))
    expect(repetir).toBe(true)
  })

  it('cerrado no renderiza nada', () => {
    render(<Novedades abierto={false} versionVista={null} onCerrar={() => {}} onRepetirTutorial={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
