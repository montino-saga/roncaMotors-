// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../ErrorBoundary'

function Bomba({ mensaje }) {
  throw new Error(mensaje)
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renderiza los hijos cuando no hay error', () => {
    render(<ErrorBoundary><p>contenido</p></ErrorBoundary>)
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })

  it('error genérico: fallback con Reintentar e Ir al inicio', async () => {
    const user = userEvent.setup()
    let explota = true
    function Vista() { return explota ? <Bomba mensaje="boom" /> : <p>recuperado</p> }
    render(<ErrorBoundary><Vista /></ErrorBoundary>)
    expect(screen.getByText('Algo falló en esta vista')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ir al inicio/ })).toBeInTheDocument()
    explota = false
    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(screen.getByText('recuperado')).toBeInTheDocument()
  })

  it('chunk viejo tras deploy: pide recargar', () => {
    render(<ErrorBoundary><Bomba mensaje="Failed to fetch dynamically imported module: /assets/x.js" /></ErrorBoundary>)
    expect(screen.getByText('Hay una versión nueva')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recargar/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument()
  })
})
