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
import { olvidarGastosFijos } from '../../../lib/gastosFijos'
import { claveMes } from '../../../lib/gastos'

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
  coleccionesFake.gastosRecurrentes = []
  olvidarGastosFijos()
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

  it('"Mes actual" solo aparece fuera del mes en curso y vuelve a él', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    expect(screen.queryByRole('button', { name: /Mes actual/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: /Mes actual/ }))
    expect(await screen.findByText('Instagram ads')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mes actual/ })).not.toBeInTheDocument()
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

describe('Gastos fijos', () => {
  const plantilla = (id, extra = {}) => ({ id, nombre: 'Internet fibra', monto: 45000, dia: 5, categoria: 'servicios', activo: true, ultimoMes: claveMes(hoy), ...extra })

  it('el check "Gasto fijo" crea la plantilla y el gasto enlazado en un batch', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    await user.click(screen.getByRole('radio', { name: 'Servicios' }))
    await user.type(screen.getByPlaceholderText('$0'), '45000')
    await user.type(screen.getByPlaceholderText(/Campaña Instagram/), 'Internet fibra')
    await user.click(screen.getByRole('radio', { name: /^Fijo/ }))
    await user.click(screen.getByRole('button', { name: /Registrar gasto/ }))
    await waitFor(() => expect(escrituras.sets).toHaveLength(2))
    const [p, g] = escrituras.sets
    expect(p.ref).toMatch(/^gastosRecurrentes\//)
    expect(p.data).toMatchObject({ nombre: 'Internet fibra', monto: 45000, categoria: 'servicios', dia: hoy.getDate(), activo: true, ultimoMes: claveMes(hoy), userId: 'u1' })
    expect(g.ref).toMatch(/^gastos\//)
    expect(g.data).toMatchObject({ monto: 45000, categoria: 'servicios', descripcion: 'Internet fibra', recurrenteId: p.ref.split('/')[1] })
    expect(escrituras.adds).toHaveLength(0)
    expect(screen.getByRole('radio', { name: /^Variable/ })).toHaveAttribute('aria-checked', 'true')   // formulario limpio
  })

  it('un gasto fijo por pagar se marca pagado desde la lista', async () => {
    coleccionesFake.gastosRecurrentes = [plantilla('r1')]
    coleccionesFake.gastos.push({ ...gasto('g9', enMes(5), 45000, 'servicios', 'Internet fibra'), recurrenteId: 'r1', pagado: false })
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    const fila = (await screen.findByText('Internet fibra')).closest('tr')
    expect(within(fila).getByText('Por pagar')).toBeInTheDocument()
    expect(screen.getByText('Gastos').parentElement).toHaveTextContent('1 por pagar')
    await user.click(within(fila).getByRole('button', { name: 'Marcar pagado' }))
    await waitFor(() => expect(escrituras.updates).toEqual([{ ref: 'gastos/g9', data: { pagado: true } }]))
    expect(within(fila).queryByText('Por pagar')).not.toBeInTheDocument()
  })

  it('editar un gasto fijo muestra el check marcado; desmarcarlo desactiva la plantilla', async () => {
    coleccionesFake.gastosRecurrentes = [plantilla('r1')]
    coleccionesFake.gastos.push({ ...gasto('g9', enMes(5), 45000, 'servicios', 'Internet fibra'), recurrenteId: 'r1' })
    const user = userEvent.setup()
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    const fila = (await screen.findByText('Internet fibra')).closest('tr')
    await user.click(within(fila).getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('radio', { name: /^Fijo/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: /^Variable/ }))
    await user.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(2))
    expect(escrituras.updates).toContainEqual({ ref: 'gastosRecurrentes/r1', data: { activo: false } })
    expect(escrituras.updates.find(u => u.ref === 'gastos/g9').data).toMatchObject({ monto: 45000 })
  })

  it('al entrar registra los fijos del mes que faltan', async () => {
    const mesPasado = claveMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))
    coleccionesFake.gastosRecurrentes = [plantilla('r1', { ultimoMes: mesPasado })]
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    await screen.findByText('Instagram ads')
    expect(escrituras.sets).toHaveLength(1)
    expect(escrituras.sets[0].data).toMatchObject({ recurrenteId: 'r1', monto: 45000, pagado: false })
    expect(escrituras.updates).toEqual([{ ref: 'gastosRecurrentes/r1', data: { ultimoMes: claveMes(hoy) } }])
  })

  it('si gastosRecurrentes falla (rules sin desplegar) la lista de gastos carga igual', async () => {
    const original = firestoreMock.getDocs.getMockImplementation()
    firestoreMock.getDocs.mockImplementation(async (q) => {
      if (q?.path === 'gastosRecurrentes') throw new Error('permission-denied')
      return original(q)
    })
    try {
      render(<MemoryRouter><Gastos /></MemoryRouter>)
      expect(await screen.findByText('Instagram ads')).toBeInTheDocument()
      expect(toast.error).not.toHaveBeenCalled()
    } finally {
      firestoreMock.getDocs.mockImplementation(original)
    }
  })

  it('lector: no genera fijos ni ve el botón de marcar pagado', async () => {
    perfil = { rol: 'lector' }
    const mesPasado = claveMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))
    coleccionesFake.gastosRecurrentes = [plantilla('r1', { ultimoMes: mesPasado })]
    coleccionesFake.gastos.push({ ...gasto('g9', enMes(5), 45000, 'servicios', 'Internet fibra'), recurrenteId: 'r1', pagado: false })
    render(<MemoryRouter><Gastos /></MemoryRouter>)
    const fila = (await screen.findByText('Internet fibra')).closest('tr')
    expect(within(fila).getByText('Por pagar')).toBeInTheDocument()
    expect(within(fila).queryByRole('button', { name: 'Marcar pagado' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Fijo/ })).toBeDisabled()
    expect(escrituras.sets).toHaveLength(0)
  })
})
