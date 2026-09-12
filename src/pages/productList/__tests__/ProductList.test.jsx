// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

import { toast } from 'sonner'
import ProductList from '../ProductList'

const PRODUCTO = { id: 'd1', idProducto: 'ABC123', nombreProducto: 'Monster Blanco', marcaProducto: 'Monster', precioVentaLocal: 1500, precioOriginal: 1000, cantidadProducto: 10 }

beforeEach(() => {
  resetFirebaseMock()
  emitirCatalogo([PRODUCTO])
})

describe('Inventario', () => {
  it('eliminar borra sin confirmar y "Deshacer" restaura el documento', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ProductList /></MemoryRouter>)
    await user.click(await screen.findByTitle('Eliminar'))
    await waitFor(() => expect(escrituras.deletes).toContain('productos/d1'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const [, opts] = toast.mock.calls.find(([msg]) => msg === 'Producto eliminado')
    opts.action.onClick()
    await waitFor(() => expect(escrituras.sets).toContainEqual({ ref: 'productos/d1', data: expect.objectContaining({ nombreProducto: 'Monster Blanco' }) }))
  })
})
