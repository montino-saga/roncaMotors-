// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const login = vi.fn()
const recuperar = vi.fn()
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ login, recuperar }) }))
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { businessName: 'Roncamotors', logo: '' } }) }))
import Login from '../Login'

beforeEach(() => { login.mockReset(); recuperar.mockReset() })

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

  it('recuperar contraseña: exige correo y confirma envío', async () => {
    const user = userEvent.setup()
    recuperar.mockResolvedValue()
    render(<Login />)
    await user.click(screen.getByRole('button', { name: /Olvidaste tu contraseña/ }))
    expect(await screen.findByText('Escribe tu correo para recuperar la contraseña.')).toBeInTheDocument()
    expect(recuperar).not.toHaveBeenCalled()
    await user.type(screen.getByPlaceholderText('Correo'), ' admin@taller.cl ')
    await user.click(screen.getByRole('button', { name: /Olvidaste tu contraseña/ }))
    expect(recuperar).toHaveBeenCalledWith('admin@taller.cl')
    expect(await screen.findByText(/Te enviamos un correo a admin@taller.cl/)).toBeInTheDocument()
  })
})
