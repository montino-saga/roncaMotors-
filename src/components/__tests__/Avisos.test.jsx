// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Avisos } from '../Avisos'

const aviso = { id: 'caja-abierta', titulo: 'Caja sin cerrar', detalle: 'Abierta desde ayer.', accion: { label: 'Ir a caja', href: '/' } }
const Ruta = () => <span data-testid="ruta">{useLocation().pathname}</span>

const montar = (avisos, ruta = '/ventas', onCerrar = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Avisos abierto avisos={avisos} onCerrar={onCerrar} />
      <Routes><Route path="*" element={<Ruta />} /></Routes>
    </MemoryRouter>
  )
  return onCerrar
}

describe('Avisos', () => {
  it('sin avisos: estado vacío', () => {
    montar([])
    expect(screen.getByText('Sin avisos pendientes')).toBeInTheDocument()
  })

  it('con aviso: lo lista y el botón cierra y navega', async () => {
    const user = userEvent.setup()
    const onCerrar = montar([aviso])
    expect(screen.getByText('Caja sin cerrar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir a caja' }))
    expect(onCerrar).toHaveBeenCalled()
    expect(screen.getByTestId('ruta')).toHaveTextContent('/')
  })

  it('ya en la vista destino: sin botón', () => {
    montar([aviso], '/')
    expect(screen.queryByRole('button', { name: 'Ir a caja' })).toBeNull()
  })
})
