// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('../../../components/ui/ImageUpload', () => ({ ImageUpload: () => <div data-testid="image-upload" /> }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }))

import { toast } from 'sonner'
import CreateProducts from '../CreateProducts'

const montar = () => render(<MemoryRouter><CreateProducts /></MemoryRouter>)
const campo = (name) => document.querySelector(`[name="${name}"]`)

beforeEach(() => {
  resetFirebaseMock()
  emitirCatalogo([{ id: 'x', idProducto: 'DUP', nombreProducto: 'Ya existe' }])
})

describe('Crear producto', () => {
  it('el costo alimenta la fórmula fija y el precio de venta por margen (40%)', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('precioOriginal'), '1000')
    // Recuadro de fórmula: ⌈1000/0,6⌉ = 1.667 · ⌈1.667×1,19⌉ = 1.984
    expect(screen.getByText(/precioVenta = \(costo neto ÷ 0,6\) × 1,19/)).toBeInTheDocument()
    expect(screen.getByText('$1.984')).toBeInTheDocument()
    // Venta Local en modo % (40 por defecto) → 1.983,33 redondeado a $10
    expect(screen.getByText('$1.980')).toBeInTheDocument()
  })

  it('exento quita el IVA del precio calculado', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('precioOriginal'), '1000')
    await user.click(screen.getByRole('button', { name: 'Exento' }))
    expect(screen.getByText('$1.670')).toBeInTheDocument()
  })

  it('cambiar el % recalcula; cambiar a precio fijo permite escribir', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('precioOriginal'), '1000')
    await user.click(screen.getAllByRole('button', { name: '20%' })[0])
    expect(screen.getByText('$1.490')).toBeInTheDocument()   // 1000/0.8×1.19 = 1487,5 → 1490
    await user.click(screen.getAllByRole('button', { name: 'Precio fijo' })[0])
    const precio = campo('precioVentaLocal')
    await user.clear(precio)
    await user.type(precio, '2000')
    expect(screen.getByText('Ganas $681')).toBeInTheDocument()   // 2000/1.19 − 1000
  })

  it('Enter en el código (lector) salta al nombre en vez de enviar', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('idProducto'), 'ABC{Enter}')
    expect(campo('nombreProducto')).toHaveFocus()
    expect(escrituras.adds).toHaveLength(0)
  })

  it('no guarda sin precio de venta', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('nombreProducto'), 'Cosa')
    await user.click(screen.getByRole('button', { name: /Guardar producto/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falta el precio de venta local'))
    expect(escrituras.adds).toHaveLength(0)
  })

  it('código duplicado → error, no guarda', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('idProducto'), 'DUP')
    await user.type(campo('nombreProducto'), 'Cosa')
    await user.type(campo('precioOriginal'), '1000')
    await user.click(screen.getByRole('button', { name: /Guardar producto/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('El ID del producto ya existe.'))
    expect(escrituras.adds).toHaveLength(0)
  })

  it('guarda, se queda en la pantalla, limpia y vuelve el foco al código', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo('idProducto'), 'NEW1')
    await user.type(campo('nombreProducto'), 'Filtro aceite')
    await user.type(campo('marcaProducto'), 'Hiflo')
    await user.type(campo('cantidadProducto'), '5')
    await user.type(campo('precioOriginal'), '1000')
    await user.click(screen.getByRole('button', { name: /Guardar producto/ }))

    await waitFor(() => expect(escrituras.adds).toHaveLength(1))
    expect(escrituras.adds[0]).toMatchObject({
      coll: 'productos',
      data: { idProducto: 'NEW1', nombreProducto: 'Filtro aceite', marcaProducto: 'Hiflo', cantidadProducto: 5, precioOriginal: 1000, precioVentaLocal: 1980, precioProducto: 1980, afectoIva: true },
    })
    expect(navigate).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Producto creado', expect.objectContaining({ action: expect.anything() }))
    await waitFor(() => expect(campo('nombreProducto')).toHaveValue(''))
    expect(campo('idProducto')).toHaveFocus()
  })

  it('Limpiar descarta el borrador', async () => {
    const user = userEvent.setup()
    montar()
    const limpiar = screen.getByRole('button', { name: /Limpiar/ })
    expect(limpiar).toBeDisabled()
    await user.type(campo('nombreProducto'), 'Borrador')
    expect(limpiar).toBeEnabled()
    await user.click(limpiar)
    expect(campo('nombreProducto')).toHaveValue('')
  })

  it('el borrador persiste entre montajes', async () => {
    const user = userEvent.setup()
    const r = montar()
    await user.type(campo('nombreProducto'), 'Persistente')
    r.unmount()
    montar()
    expect(campo('nombreProducto')).toHaveValue('Persistente')
  })
})
