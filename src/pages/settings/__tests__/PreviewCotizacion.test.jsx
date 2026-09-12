// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const generarCotizacion = vi.fn(async () => ({ doc: { output: () => 'blob:cotizacion' } }))
vi.mock('../../../lib/cotizacion', () => ({ generarCotizacion }))
let escritorio = true
vi.mock('../../../hooks/useMediaQuery', () => ({ useMediaQuery: () => escritorio }))
import { PreviewCotizacion } from '../PreviewCotizacion'

beforeEach(() => {
  escritorio = true
  generarCotizacion.mockClear()
  window.open = vi.fn()
  URL.revokeObjectURL = vi.fn()
})

describe('PreviewCotizacion', () => {
  it('genera el PDF con el formulario y lo embebe', async () => {
    render(<PreviewCotizacion settings={{ businessName: 'Taller X', rut: '1-9' }} />)
    const iframe = await screen.findByTitle('Cotización de ejemplo')
    expect(iframe.getAttribute('src')).toMatch(/^blob:cotizacion#/)
    expect(generarCotizacion).toHaveBeenCalledWith(expect.objectContaining({
      settings: { businessName: 'Taller X', rut: '1-9' },
      cart: expect.any(Array),
    }))
  })

  it('regenera al cambiar el formulario (con retardo) y abre en pestaña nueva', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PreviewCotizacion settings={{ businessName: 'A' }} />)
    await screen.findByTitle('Cotización de ejemplo')
    rerender(<PreviewCotizacion settings={{ businessName: 'B' }} />)
    await waitFor(() => expect(generarCotizacion).toHaveBeenCalledTimes(2))
    expect(generarCotizacion.mock.calls[1][0].settings.businessName).toBe('B')
    await user.click(screen.getByRole('button', { name: /Abrir PDF/ }))
    expect(window.open).toHaveBeenCalledWith('blob:cotizacion', '_blank', 'noopener')
  })

  it('móvil: sin iframe, solo el botón', async () => {
    escritorio = false
    render(<PreviewCotizacion settings={{ businessName: 'A' }} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Abrir PDF/ })).toBeEnabled())
    expect(screen.queryByTitle('Cotización de ejemplo')).not.toBeInTheDocument()
  })

  it('sin settings todavía no genera nada', () => {
    render(<PreviewCotizacion settings={null} />)
    expect(generarCotizacion).not.toHaveBeenCalled()
  })
})
