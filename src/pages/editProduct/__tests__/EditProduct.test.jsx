// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { firestoreMock, escrituras, resetFirebaseMock, emitirCatalogo } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../components/ui/ImageUpload', () => ({ ImageUpload: () => <div>imagen</div> }))
import { toast } from 'sonner'
import EditProduct from '../EditProduct'

const PRODUCTO = { nombreProducto: 'Cadena 428', marcaProducto: 'DID', categoriaProducto: 'transmisión', precioVentaLocal: 45990, precioVentaWeb: 42000, precioOriginal: 30000, cantidadProducto: 4, idProducto: 'KIT-428', imagenProducto: '' }

const montar = () => {
  const router = createMemoryRouter([
    { path: '/editar/:id', element: <EditProduct /> },
    { path: '/productos', element: <p>lista de productos</p> },
  ], { initialEntries: ['/editar/doc1'] })
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  resetFirebaseMock()
  firestoreMock.getDoc.mockResolvedValue({ exists: () => true, id: 'doc1', data: () => PRODUCTO })
})

describe('Editar producto', () => {
  it('carga el producto y guarda con números y afectoIva', async () => {
    const user = userEvent.setup()
    montar()
    const nombre = await screen.findByPlaceholderText('Ej. iPhone 15 Pro')
    expect(nombre).toHaveValue('Cadena 428')
    await user.clear(nombre)
    await user.type(nombre, 'Cadena 428 reforzada')
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(1))
    expect(escrituras.updates[0]).toMatchObject({
      ref: 'productos/doc1',
      data: { nombreProducto: 'Cadena 428 reforzada', precioVentaLocal: 45990, precioProducto: 45990, cantidadProducto: 4, afectoIva: true },
    })
    expect(toast.success).toHaveBeenCalled()
    expect(await screen.findByText('lista de productos')).toBeInTheDocument()   // tras guardar no pregunta
  })

  it('con cambios sin guardar, Volver pregunta antes de salir', async () => {
    const user = userEvent.setup()
    montar()
    const nombre = await screen.findByPlaceholderText('Ej. iPhone 15 Pro')
    await user.type(nombre, ' X')
    await user.click(screen.getAllByRole('button')[0])   // flecha Volver
    expect(await screen.findByText('Cambios sin guardar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByPlaceholderText('Ej. iPhone 15 Pro')).toHaveValue('Cadena 428 X')
  })

  it('sin cambios, Volver sale directo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByPlaceholderText('Ej. iPhone 15 Pro')
    await user.click(screen.getAllByRole('button')[0])
    expect(await screen.findByText('lista de productos')).toBeInTheDocument()
  })

  it('producto inexistente: avisa y vuelve a la lista', async () => {
    firestoreMock.getDoc.mockResolvedValue({ exists: () => false })
    montar()
    expect(await screen.findByText('lista de productos')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('Producto no encontrado')
  })

  it('no deja cambiar el código a uno que ya usa otro producto', async () => {
    emitirCatalogo([{ id: 'otro', idProducto: 'FIL-1', nombreProducto: 'Filtro' }])
    const user = userEvent.setup()
    montar()
    const codigo = await screen.findByDisplayValue('KIT-428')
    await user.clear(codigo)
    await user.type(codigo, 'FIL-1')
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ese código ya lo usa otro producto', expect.anything()))
    expect(escrituras.updates).toHaveLength(0)
  })

  it('precio web en 0 no bloquea el guardado (es opcional, como al crear)', async () => {
    emitirCatalogo([])
    firestoreMock.getDoc.mockResolvedValue({ exists: () => true, id: 'doc1', data: () => ({ ...PRODUCTO, precioVentaWeb: 0 }) })
    const user = userEvent.setup()
    montar()
    await screen.findByDisplayValue('KIT-428')
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(1))
    expect(escrituras.updates[0].data.precioVentaWeb).toBe(0)
  })
})
