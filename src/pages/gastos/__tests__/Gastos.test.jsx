// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
let perfil
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, perfil }) }))
import { toast } from 'sonner'
import Gastos from '../Gastos'

const hoy = new Date()
const enMes = (dia, meses = 0) => new Date(hoy.getFullYear(), hoy.getMonth() + meses, dia, 12)
const gasto = (id, fecha, monto, categoria, descripcion = '') => ({ id, fecha: { toDate: () => fecha }, monto, categoria, descripcion })

beforeEach(() => {
  resetFirebaseMock()
  perfil = undefined
  coleccionesFake.gastos = [
    gasto('g1', enMes(1), 30000, 'publicidad', 'Instagram ads'),
    gasto('g2', enMes(1), 12000, 'arreglos', 'Vidrio vitrina'),
    gasto('g3', enMes(1, -1), 20000, 'arriendo', 'Arriendo local'),   // mes anterior
  ]
})

describe('Gastos', () => {
  it('KPIs del mes y comparación con el anterior', async () => {
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    expect(await screen.findByText('Instagram ads')).toBeInTheDocument()
    expect(screen.queryByText('Arriendo local')).not.toBeInTheDocument()
    const kpi = (label) => screen.getByText(label).parentElement
    expect(kpi('Total del mes')).toHaveTextContent('$42.000')
    expect(kpi('Total del mes')).toHaveTextContent('+110% vs mes anterior')
    expect(kpi('Gastos')).toHaveTextContent('2')
    expect(kpi('Mayor gasto')).toHaveTextContent('Publicidad')
  })

  it('registra un gasto con fecha, categoría, monto y descripción', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    await user.click(screen.getByRole('radio', { name: 'Servicios' }))
    await user.type(screen.getByPlaceholderText('$0'), '45000')
    await user.type(screen.getByPlaceholderText(/Campaña Instagram/), 'Internet fibra')
    await user.click(screen.getByRole('button', { name: /Registrar gasto/ }))
    await waitFor(() => expect(escrituras.adds).toHaveLength(1))
    expect(escrituras.adds[0]).toMatchObject({ coll: 'gastos', data: { monto: 45000, categoria: 'servicios', descripcion: 'Internet fibra', userId: 'u1' } })
    expect(escrituras.adds[0].data.fecha.toDate().getDate()).toBe(hoy.getDate())
    expect(toast.success).toHaveBeenCalledWith('Gasto registrado', expect.anything())
    expect(screen.getByPlaceholderText('$0')).toHaveValue('')   // formulario limpio
  })

  it('monto inválido no guarda', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    await user.type(screen.getByPlaceholderText('$0'), '0')
    await user.click(screen.getByRole('button', { name: /Registrar gasto/ }))
    expect(toast.error).toHaveBeenCalledWith('Ingresa un monto válido')
    expect(escrituras.adds).toHaveLength(0)
  })

  it('editar carga el formulario y actualiza el doc', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    const fila = (await screen.findByText('Vidrio vitrina')).closest('tr')
    await user.click(within(fila).getByRole('button', { name: 'Editar' }))
    expect(screen.getByText('Editar gasto')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('$0')).toHaveValue('$12.000')
    await user.clear(screen.getByPlaceholderText('$0'))
    await user.type(screen.getByPlaceholderText('$0'), '15000')
    await user.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(1))
    expect(escrituras.updates[0]).toMatchObject({ ref: 'gastos/g2', data: { monto: 15000, categoria: 'arreglos' } })
    expect(screen.getByText('Nuevo gasto')).toBeInTheDocument()
  })

  it('eliminar: sale de la lista al instante; Deshacer lo devuelve sin borrar', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    const fila = (await screen.findByText('Instagram ads')).closest('tr')
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    expect(screen.queryByText('Instagram ads')).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith('Gasto eliminado', expect.objectContaining({ action: expect.anything() }))
    const opciones = toast.mock.calls[0][1]
    opciones.action.onClick()
    expect(await screen.findByText('Instagram ads')).toBeInTheDocument()
    opciones.onAutoClose()
    expect(escrituras.deletes).toHaveLength(0)
  })

  it('eliminar: al cerrarse el toast borra en Firestore', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    const fila = (await screen.findByText('Instagram ads')).closest('tr')
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    toast.mock.calls[0][1].onAutoClose()
    await waitFor(() => expect(escrituras.deletes).toEqual(['gastos/g1']))
  })

  it('filtra por categoría (desglose) y por texto', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    await user.click(screen.getByRole('button', { name: /Arreglos.*\$12\.000/ }))
    expect(screen.queryByText('Instagram ads')).not.toBeInTheDocument()
    expect(screen.getByText('Vidrio vitrina')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Arreglos$/ }))   // chip del filtro → quitar
    await user.type(screen.getByPlaceholderText('Buscar en el mes…'), 'insta')
    expect(screen.getByText('Instagram ads')).toBeInTheDocument()
    expect(screen.queryByText('Vidrio vitrina')).not.toBeInTheDocument()
  })

  it('navega al mes anterior y no permite ir al futuro', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(await screen.findByText('Arriendo local')).toBeInTheDocument()
    expect(screen.queryByText('Instagram ads')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled()
  })
})

describe('Gastos: lector', () => {
  it('ve los gastos pero el formulario queda deshabilitado y sin editar/eliminar', async () => {
    perfil = { rol: 'lector' }
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    expect(await screen.findByText('Instagram ads')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar gasto/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })
})
