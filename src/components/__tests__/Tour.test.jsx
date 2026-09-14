// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Tour } from '../Tour'

const pasos = [
  { target: '[data-tour="a"]', menu: true, lado: 'right', titulo: 'Uno', texto: 'primero' },
  { ruta: '/b', target: '[data-tour="b"]', lado: 'bottom', titulo: 'Dos', texto: 'segundo' },
  { ruta: '/b', target: '[data-tour="no-existe"]', lado: 'top', titulo: 'Tres', texto: 'tercero' },
]

const Pantalla = () => {
  const { pathname } = useLocation()
  return (
    <div>
      <button data-tour="a">A</button>
      {pathname === '/b' && <button data-tour="b">B</button>}
      <main data-tour="vista">vista {pathname}</main>
    </div>
  )
}

const montar = (props) => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes><Route path="*" element={<><Pantalla /><Tour pasos={pasos} {...props} /></>} /></Routes>
  </MemoryRouter>
)

describe('Tour', () => {
  it('recorre pasos, navega a la ruta del paso y avisa al Layout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onFin = vi.fn(), onPaso = vi.fn()
    montar({ onFin, onPaso })
    expect(await screen.findByRole('dialog', { name: 'Uno' })).toBeInTheDocument()
    expect(onPaso).toHaveBeenCalledWith(expect.objectContaining({ menu: true }))
    await user.click(await screen.findByRole('button', { name: /Siguiente/ }))
    expect(await screen.findByRole('dialog', { name: 'Dos' })).toBeInTheDocument()
    expect(await screen.findByText('vista /b')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Siguiente/ }))
    expect(await screen.findByRole('dialog', { name: 'Tres' })).toBeInTheDocument()
    // Sin el elemento: cae en la vista completa y sigue mostrando el paso.
    vi.advanceTimersByTime(3000)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(onFin).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('Escape sale', async () => {
    const user = userEvent.setup()
    const onFin = vi.fn()
    montar({ onFin })
    await screen.findByRole('dialog', { name: 'Uno' })
    await user.keyboard('{Escape}')
    expect(onFin).toHaveBeenCalled()
  })
})
