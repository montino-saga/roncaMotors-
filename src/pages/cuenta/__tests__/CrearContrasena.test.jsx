// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

const verificar = vi.fn(), confirmar = vi.fn(), entrar = vi.fn()
vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: (...a) => verificar(...a),
  confirmPasswordReset: (...a) => confirmar(...a),
  signInWithEmailAndPassword: (...a) => entrar(...a),
}))
vi.mock('../../../db/firebase', () => ({ auth: { id: 'auth' } }))
import CrearContrasena from '../CrearContrasena'

const Ruta = () => <p>ruta: {useLocation().pathname}</p>
const montar = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/accion" element={<CrearContrasena />} />
      <Route path="*" element={<Ruta />} />
    </Routes>
  </MemoryRouter>
)

beforeEach(() => { verificar.mockReset(); confirmar.mockReset(); entrar.mockReset() })

describe('CrearContrasena', () => {
  it('valida el enlace, guarda la contraseña e inicia sesión directo en el panel', async () => {
    verificar.mockResolvedValue('nuevo@gmail.com')
    confirmar.mockResolvedValue()
    entrar.mockResolvedValue()
    const user = userEvent.setup()
    montar('/accion?mode=resetPassword&oobCode=abc')
    expect(await screen.findByText('nuevo@gmail.com')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/Nueva contraseña/), 'secreta1')
    await user.type(screen.getByPlaceholderText('Repite la contraseña'), 'secreta1')
    await user.click(screen.getByRole('button', { name: /Guardar y entrar/ }))
    await waitFor(() => expect(screen.getByText('ruta: /')).toBeInTheDocument())
    expect(confirmar).toHaveBeenCalledWith({ id: 'auth' }, 'abc', 'secreta1')
    expect(entrar).toHaveBeenCalledWith({ id: 'auth' }, 'nuevo@gmail.com', 'secreta1')
  })

  it('no guarda si las contraseñas no coinciden', async () => {
    verificar.mockResolvedValue('nuevo@gmail.com')
    const user = userEvent.setup()
    montar('/accion?mode=resetPassword&oobCode=abc')
    await user.type(await screen.findByPlaceholderText(/Nueva contraseña/), 'secreta1')
    await user.type(screen.getByPlaceholderText('Repite la contraseña'), 'otra1234')
    await user.click(screen.getByRole('button', { name: /Guardar y entrar/ }))
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(confirmar).not.toHaveBeenCalled()
  })

  it('enlace vencido: explica y ofrece volver al login', async () => {
    verificar.mockRejectedValue({ code: 'auth/expired-action-code' })
    montar('/accion?mode=resetPassword&oobCode=viejo')
    expect(await screen.findByText(/El enlace venció/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ir al inicio de sesión' })).toBeInTheDocument()
  })
})
