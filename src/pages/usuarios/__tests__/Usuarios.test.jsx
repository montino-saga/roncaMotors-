// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }))
import Usuarios from '../Usuarios'
import { registrarAcceso } from '../../../lib/usuarios'

beforeEach(() => {
  resetFirebaseMock()
  coleccionesFake.usuarios = [
    { id: 'u1', email: 'yo@taller.cl', rol: 'desarrollador' },
    { id: 'u2', email: 'caja@taller.cl', nombre: 'Caja', rol: 'lector' },
    { id: 'u3', email: 'viejo@taller.cl' },   // sin rol: cae en el inicial
  ]
})

describe('Usuarios', () => {
  it('lista cuentas con su rol y conteo por rol', async () => {
    render(<MemoryRouter><Usuarios /></MemoryRouter>)
    expect(await screen.findByText('Caja')).toBeInTheDocument()
    expect(screen.getByText('(tú)')).toBeInTheDocument()
    expect(screen.getByLabelText('Rol de viejo@taller.cl')).toHaveValue('admin')
    expect(screen.getByText('Lector', { selector: 'p' }).parentElement).toHaveTextContent('1')
  })

  it('cambiar el rol escribe en usuarios/{uid}', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Usuarios /></MemoryRouter>)
    await user.selectOptions(await screen.findByLabelText('Rol de caja@taller.cl'), 'admin')
    await waitFor(() => expect(escrituras.updates).toContainEqual({ ref: 'usuarios/u2', data: { rol: 'admin' } }))
  })
})

describe('registrarAcceso', () => {
  it('primer acceso crea el doc con rol inicial', async () => {
    await registrarAcceso({ uid: 'n1', email: 'nuevo@taller.cl' })
    expect(escrituras.sets[0]).toMatchObject({ ref: 'usuarios/n1', data: { email: 'nuevo@taller.cl', rol: 'admin' } })
  })

  it('accesos siguientes no tocan el rol', async () => {
    firestoreMock.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ rol: 'lector' }) })
    await registrarAcceso({ uid: 'n1', email: 'nuevo@taller.cl' })
    expect(escrituras.updates[0].data).not.toHaveProperty('rol')
  })
})
