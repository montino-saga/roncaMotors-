// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const login = vi.fn()
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ login }) }))
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { businessName: 'Roncamotors', logo: '' } }) }))
import Login from '../Login'

beforeEach(() => login.mockReset())

describe('Login', () => {
  it('envía correo (sin espacios) y contraseña', async () => {
    const user = userEvent.setup()
    login.mockResolvedValue({})
    render(<Login />)
    await user.type(screen.getByPlaceholderText('Correo'), '  admin@taller.cl ')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'secreta')
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(login).toHaveBeenCalledWith('admin@taller.cl', 'secreta')
  })

  it('traduce los errores de Firebase y cae a un mensaje genérico', async () => {
    const user = userEvent.setup()
    render(<Login />)
    await user.type(screen.getByPlaceholderText('Correo'), 'a@b.c')
    await user.type(screen.getByPlaceholderText('Contraseña'), 'x')
    login.mockRejectedValueOnce({ code: 'auth/invalid-credential' })
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
    login.mockRejectedValueOnce({ code: 'auth/algo-raro' })
    await user.click(screen.getByRole('button', { name: /Entrar/ }))
    expect(await screen.findByText('No se pudo iniciar sesión.')).toBeInTheDocument()
  })
})
