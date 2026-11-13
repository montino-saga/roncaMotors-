// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
let perfil
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, perfil }) }))
import { toast } from 'sonner'
import { invalidarClientes } from '../../../lib/clientes'
import Pedidos from '../Pedidos'

const ts = (d) => ({ toDate: () => d })
const pedido = (id, nombreCliente, estado, total, abonado, extra = {}) => ({
  id, clienteId: `c-${id}`, nombreCliente, estado, total, abonado, descripcion: '', abonos: [], creadoEn: ts(new Date()),
  productos: [{ idProducto: 'A1', nombreProducto: 'Filtro aceite', cantidad: 1, precio: total }], ...extra,
})

beforeEach(() => {
  resetFirebaseMock()
  invalidarClientes()
  perfil = undefined
  coleccionesFake.clients = [
    { id: 'c1', name: 'Juan Pérez', phone: '+56911112222', currentDebt: 0 },
    { id: 'c2', name: 'María Soto', patente: 'ABCD-12', currentDebt: 15000 },
  ]
  coleccionesFake.pedidos = [
    pedido('p1', 'Juan Pérez', 'pendiente', 30000, 10000, { descripcion: 'Kit embrague Hilux' }),
    pedido('p2', 'María Soto', 'entregado', 12000, 12000),
  ]
  emitirCatalogo([{ id: 'd1', idProducto: 'MON1', nombreProducto: 'Monster Blanco', precioVentaLocal: 2500 }])
})

const montar = () => render(<MemoryRouter><Pedidos /></MemoryRouter>)

describe('Pedidos del local', () => {
  it('muestra pendientes con lo que debe y KPIs; "Todos" incluye los entregados', async () => {
    const user = userEvent.setup()
    montar()
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Debe $20.000')).toBeInTheDocument()
    expect(screen.queryByText('María Soto')).not.toBeInTheDocument()
    expect(screen.getByText('Por cobrar').parentElement).toHaveTextContent('$20.000')
    await user.click(screen.getByRole('radio', { name: 'Todos' }))
    expect(screen.getByText('María Soto')).toBeInTheDocument()
    expect(screen.getByText('Pagado')).toBeInTheDocument()
  })

  it('crea un pedido con cliente, descripción, productos y abono', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('Juan Pérez')
    await user.click(screen.getByRole('button', { name: /Nuevo pedido/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo pedido' })

    await user.type(within(dialogo).getByPlaceholderText(/Buscar por nombre/), 'abcd')
    await user.click(within(dialogo).getByRole('button', { name: /María Soto/ }))
    expect(within(dialogo).getByText(/fiado \$15\.000/)).toBeInTheDocument()

    await user.type(within(dialogo).getByPlaceholderText(/Kit de embrague/), 'Encargo para el lunes')
    await user.type(within(dialogo).getByPlaceholderText('Buscar en el catálogo…'), 'monster')
    await user.click(within(dialogo).getByRole('button', { name: /Monster Blanco/ }))
    await user.click(within(dialogo).getByRole('button', { name: 'Más' }))
    await user.type(within(dialogo).getByPlaceholderText('Ítem fuera del catálogo'), 'Espejo lateral')
    await user.type(within(dialogo).getAllByPlaceholderText('$0')[0], '20000')
    await user.click(within(dialogo).getByRole('button', { name: 'Agregar ítem' }))
    expect(within(dialogo).getAllByTestId('item-pedido')).toHaveLength(2)

    await user.type(within(dialogo).getByPlaceholderText(/sin abono/), '5000')
    await user.click(within(dialogo).getByRole('radio', { name: 'Transferencia' }))
    expect(within(dialogo).getByTestId('debe-pedido')).toHaveTextContent('$20.000')   // 2×2.500 + 20.000 − 5.000

    await user.click(within(dialogo).getByRole('button', { name: /Crear pedido/ }))
    await waitFor(() => expect(escrituras.adds).toHaveLength(1))
    const { coll, data } = escrituras.adds[0]
    expect(coll).toBe('pedidos')
    expect(data).toMatchObject({
      clienteId: 'c2', nombreCliente: 'María Soto', descripcion: 'Encargo para el lunes',
      total: 25000, abonado: 5000, estado: 'pendiente', userId: 'u1',
      productos: [
        { idProducto: 'MON1', nombreProducto: 'Monster Blanco', cantidad: 2, precio: 2500 },
        { idProducto: null, nombreProducto: 'Espejo lateral', cantidad: 1, precio: 20000 },
      ],
    })
    expect(data.abonos).toEqual([expect.objectContaining({ monto: 5000, metodo: 'transferencia' })])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuevo pedido' })).not.toBeInTheDocument())
  })

  it('no crea sin cliente ni con abono mayor al total', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('Juan Pérez')
    await user.click(screen.getByRole('button', { name: /Nuevo pedido/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo pedido' })
    await user.click(within(dialogo).getByRole('button', { name: /Crear pedido/ }))
    expect(toast.error).toHaveBeenCalledWith('Selecciona el cliente del pedido')

    await user.click(within(dialogo).getByRole('button', { name: /Juan Pérez/ }))
    await user.type(within(dialogo).getByPlaceholderText('Buscar en el catálogo…'), 'monster')
    await user.click(within(dialogo).getByRole('button', { name: /Monster Blanco/ }))
    await user.type(within(dialogo).getByPlaceholderText(/sin abono/), '9000')
    await user.click(within(dialogo).getByRole('button', { name: /Crear pedido/ }))
    expect(toast.error).toHaveBeenCalledWith('El abono supera el total del pedido')
    expect(escrituras.adds).toHaveLength(0)
  })

  it('detalle: registra un abono y marca entregado', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: /Juan Pérez/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Pedido de Juan Pérez' })
    expect(within(dialogo).getByText('Kit embrague Hilux')).toBeInTheDocument()

    await user.type(within(dialogo).getByLabelText('Monto del abono'), '25000')
    await user.click(within(dialogo).getByRole('button', { name: /Abonar/ }))
    expect(toast.error).toHaveBeenCalledWith('El abono supera lo que se debe')

    await user.clear(within(dialogo).getByLabelText('Monto del abono'))
    await user.type(within(dialogo).getByLabelText('Monto del abono'), '8000')
    await user.click(within(dialogo).getByRole('button', { name: /Abonar/ }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(1))
    expect(escrituras.updates[0].ref).toBe('pedidos/p1')
    expect(escrituras.updates[0].data.abonado).toBe(18000)
    expect(escrituras.updates[0].data.abonos).toEqual([expect.objectContaining({ monto: 8000, metodo: 'efectivo' })])

    await user.click(within(dialogo).getByRole('button', { name: /Marcar entregado/ }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(2))
    expect(escrituras.updates[1]).toMatchObject({ ref: 'pedidos/p1', data: { estado: 'entregado' } })
  })

  it('eliminar pide confirmación', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: /Juan Pérez/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Pedido de Juan Pérez' })
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar pedido' }))
    expect(escrituras.deletes).toHaveLength(0)
    await user.click(within(dialogo).getByRole('button', { name: /Sí, eliminar/ }))
    await waitFor(() => expect(escrituras.deletes).toEqual(['pedidos/p1']))
  })

  it('lector: ve pedidos y detalle, sin crear, abonar ni cambiar estado', async () => {
    perfil = { rol: 'lector' }
    const user = userEvent.setup()
    montar()
    expect(screen.getByRole('button', { name: /Nuevo pedido/ })).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: /Juan Pérez/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Pedido de Juan Pérez' })
    expect(within(dialogo).queryByLabelText('Monto del abono')).not.toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: /Marcar entregado/ })).not.toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar pedido' })).not.toBeInTheDocument()
  })
})
