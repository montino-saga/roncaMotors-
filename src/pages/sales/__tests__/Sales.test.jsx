// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { firestoreMock, escrituras, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('../../../lib/sounds', () => ({ sounds: { playScan: vi.fn(), playError: vi.fn(), playSuccess: vi.fn() } }))
vi.mock('../../../lib/printer', () => ({ printer: { printReceipt: vi.fn(), connect: vi.fn() } }))
vi.mock('../../../lib/cotizacion', () => ({ generarCotizacion: vi.fn(), compartirODescargar: vi.fn() }))
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { businessName: 'Roncamotors' } }) }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

import { toast } from 'sonner'
import { sounds } from '../../../lib/sounds'
import Sales from '../Sales'

const PRODUCTOS = [
  { id: 'd1', idProducto: 'ABC123', nombreProducto: 'Monster Blanco', marcaProducto: 'Monster', precioVentaLocal: 1500, precioOriginal: 1000, cantidadProducto: 10 },
  { id: 'd2', idProducto: '7801', nombreProducto: 'Aceite 10W40', marcaProducto: 'Motul', precioVentaLocal: 13990, precioOriginal: 9000, cantidadProducto: 1 },
  { id: 'd3', idProducto: 'AGOT', nombreProducto: 'Agotado', marcaProducto: '', precioVentaLocal: 500, precioOriginal: 100, cantidadProducto: 0 },
]

const escanear = async (user, codigo) => {
  const input = screen.getByPlaceholderText(/Escanear o buscar/i)
  await user.clear(input)
  await user.type(input, `${codigo}{Enter}`)
}
const filaDe = (nombre) => screen.getByRole('heading', { name: nombre }).closest('[class*="rounded-xl"]')
const total = () => screen.getByText('Total a Pagar').closest('div').parentElement

beforeEach(() => {
  resetFirebaseMock()
  emitirCatalogo(PRODUCTOS)
})

describe('Punto de venta', () => {
  it('escanea por código exacto sin pedir nada al servidor', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'abc123')
    expect(await screen.findByRole('heading', { name: 'Monster Blanco' })).toBeInTheDocument()
    expect(firestoreMock.getDocs).not.toHaveBeenCalled()
    expect(sounds.playScan).toHaveBeenCalled()
    expect(within(total()).getByText('$1.500')).toBeInTheDocument()
  })

  it('código inexistente → error, carrito vacío', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'NOEXISTE')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Producto no encontrado', expect.anything()))
    expect(screen.queryByRole('heading', { name: /Monster/ })).not.toBeInTheDocument()
  })

  it('busca por nombre, navega con teclado y agrega con Enter', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    const input = screen.getByPlaceholderText(/Escanear o buscar/i)
    await user.type(input, 'mo')
    const lista = await screen.findByRole('listbox')
    const opciones = within(lista).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual([expect.stringContaining('Monster Blanco'), expect.stringContaining('Aceite 10W40')])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(await screen.findByRole('heading', { name: 'Aceite 10W40' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('agrega una sugerencia con click', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await user.type(screen.getByPlaceholderText(/Escanear o buscar/i), 'aceite')
    await user.click(await screen.findByRole('option'))
    expect(await screen.findByRole('heading', { name: 'Aceite 10W40' })).toBeInTheDocument()
  })

  it('la lista no aparece si el término coincide exacto con un código', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await user.type(screen.getByPlaceholderText(/Escanear o buscar/i), 'ABC123')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('± cantidad, tope de stock y quitar', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await escanear(user, 'ABC123')
    const fila = filaDe('Monster Blanco')
    expect(within(fila).getByText('2')).toBeInTheDocument()
    await user.click(within(fila).getByLabelText('Quitar una unidad'))
    expect(within(fila).getByText('1')).toBeInTheDocument()
    expect(within(fila).getByLabelText('Quitar una unidad')).toBeDisabled()

    // Stock 1: la segunda unidad abre el modal de stock insuficiente.
    await escanear(user, '7801')
    await escanear(user, '7801')
    expect(await screen.findByRole('dialog', { name: 'Stock insuficiente' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('Cerrar'))

    await user.click(within(fila).getByLabelText('Quitar Monster Blanco'))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Monster Blanco' })).not.toBeInTheDocument())
  })

  it('producto agotado abre el modal "sin stock"', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'AGOT')
    expect(await screen.findByRole('dialog', { name: 'Producto sin stock' })).toBeInTheDocument()
    expect(sounds.playError).toHaveBeenCalled()
  })

  it('descuento por producto: precio final y quitar', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await user.click(screen.getByLabelText('Descuento para Monster Blanco'))
    const dlg = await screen.findByRole('dialog', { name: 'Descuento' })
    await user.click(within(dlg).getByRole('button', { name: 'Precio final c/u' }))
    await user.type(within(dlg).getByPlaceholderText('$1.500'), '1000')
    expect(within(dlg).getByText('$1.000 c/u')).toBeInTheDocument()
    expect(within(dlg).getByText(/33%/)).toBeInTheDocument()
    await user.click(within(dlg).getByRole('button', { name: 'Aplicar' }))

    const fila = filaDe('Monster Blanco')
    expect(within(fila).getAllByText('$1.000')).toHaveLength(2)   // c/u y subtotal
    expect(within(fila).getByText('$1.500')).toHaveClass('line-through')
    expect(within(total()).getByText('$1.000')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Descuento para Monster Blanco'))
    await user.click(await screen.findByRole('button', { name: 'Quitar descuento' }))
    expect(within(total()).getByText('$1.500')).toBeInTheDocument()
  })

  it('descuento por producto en %: valores inválidos deshabilitan Aplicar', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await user.click(screen.getByLabelText('Descuento para Monster Blanco'))
    const dlg = await screen.findByRole('dialog', { name: 'Descuento' })
    const aplicar = within(dlg).getByRole('button', { name: 'Aplicar' })
    expect(aplicar).toBeDisabled()
    await user.type(within(dlg).getByPlaceholderText('10'), '150')
    expect(aplicar).toBeDisabled()
    await user.click(within(dlg).getByRole('button', { name: '20%' }))
    expect(within(dlg).getByText('$1.200 c/u')).toBeInTheDocument()
    expect(aplicar).toBeEnabled()
  })

  it('descuento al total (total final) y se recorta al vaciar', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    const btn = screen.getByRole('button', { name: /descuento al total/i })
    expect(btn).toBeDisabled()
    await escanear(user, 'ABC123')
    await escanear(user, '7801')            // 1.500 + 13.990 = 15.490
    await user.click(btn)
    const dlg = await screen.findByRole('dialog', { name: 'Descuento al total' })
    await user.click(within(dlg).getByRole('button', { name: 'Total final' }))
    await user.type(within(dlg).getByPlaceholderText('$15.490'), '15000')
    await user.click(within(dlg).getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByRole('button', { name: /Descuento aplicado: −\$490/ })).toBeInTheDocument()
    expect(within(total()).getByText('$15.000')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Quitar Aceite 10W40'))
    // Subtotal 1.500 > 490: el descuento se mantiene.
    expect(within(total()).getByText('$1.010')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Quitar Monster Blanco'))
    expect(screen.getByRole('button', { name: /Aplicar descuento al total/ })).toBeDisabled()
    expect(JSON.parse(localStorage.getItem('roncamotors_pos_discount'))).toBe(0)
  })

  it('venta en efectivo: guarda totales con descuentos y descuenta stock con increment', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await escanear(user, 'ABC123')
    await user.click(screen.getByLabelText('Descuento para Monster Blanco'))
    let dlg = await screen.findByRole('dialog', { name: 'Descuento' })
    await user.click(within(dlg).getByRole('button', { name: '20%' }))
    await user.click(within(dlg).getByRole('button', { name: 'Aplicar' }))
    await user.click(screen.getByRole('button', { name: /descuento al total/i }))
    dlg = await screen.findByRole('dialog', { name: 'Descuento al total' })
    await user.click(within(dlg).getByRole('button', { name: 'Total final' }))
    await user.type(within(dlg).getByPlaceholderText('$2.400'), '2000')
    await user.click(within(dlg).getByRole('button', { name: 'Aplicar' }))

    await user.click(screen.getByRole('button', { name: 'Finalizar Venta' }))
    await waitFor(() => expect(escrituras.sets).toHaveLength(1))
    const venta = escrituras.sets[0].data
    expect(venta).toMatchObject({ tipoPago: 'efectivo', subtotal: 2400, descuentoTotal: 400, totalVenta: 2000 })
    expect(venta.totalGanancia).toBe((1200 - 1000) * 2 - 400)
    expect(venta.productos[0]).toMatchObject({ idProducto: 'ABC123', cantidad: 2, precioVentaLocal: 1200, precioLista: 1500, descuento: 300 })
    expect(escrituras.updates).toContainEqual({ ref: 'productos/d1', data: { cantidadProducto: { __increment: -2 } } })
    expect(sounds.playSuccess).toHaveBeenCalled()
    // Carrito vacío y descuento a cero.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Monster Blanco' })).not.toBeInTheDocument())
  })

  it('pago con tarjeta y selector de método', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await user.click(screen.getByRole('button', { name: /Tarjeta/ }))
    expect(screen.getByRole('button', { name: /Tarjeta/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Finalizar Venta' }))
    await waitFor(() => expect(escrituras.sets[0].data.tipoPago).toBe('tarjeta'))
  })

  it('fiado abre el buscador de clientes', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await user.click(screen.getByRole('button', { name: /Fiado/ }))
    await user.click(screen.getByRole('button', { name: 'Seleccionar Cliente' }))
    expect(await screen.findByPlaceholderText('Buscar cliente...')).toBeInTheDocument()
    expect(escrituras.sets).toHaveLength(0)
  })

  it('vaciar carrito con deshacer', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await escanear(user, 'ABC123')
    await user.click(screen.getByRole('button', { name: 'Limpiar' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Monster Blanco' })).not.toBeInTheDocument())
    expect(toast).toHaveBeenCalledWith('Carrito vaciado', expect.objectContaining({ action: expect.anything() }))
  })

  it('el carrito sobrevive a recargar (localStorage)', async () => {
    const user = userEvent.setup()
    const r = render(<Sales />)
    await escanear(user, 'ABC123')
    r.unmount()
    render(<Sales />)
    expect(screen.getByRole('heading', { name: 'Monster Blanco' })).toBeInTheDocument()
  })
})
