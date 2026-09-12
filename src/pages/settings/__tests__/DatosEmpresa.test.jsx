// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { firestoreMock, escrituras, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('browser-image-compression', () => ({ default: vi.fn(async (f) => f) }))
const liberar = vi.fn()
vi.mock('../../../hooks/useConfirmarSalida', () => ({ useConfirmarSalida: vi.fn(() => ({ blocker: { state: 'unblocked' }, liberar })) }))
let settingsFake = {}
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: settingsFake, loading: false }) }))
import { toast } from 'sonner'
import { useConfirmarSalida } from '../../../hooks/useConfirmarSalida'
import { DatosEmpresa } from '../DatosEmpresa'

beforeEach(() => {
  resetFirebaseMock()
  settingsFake = { businessName: 'Roncamotors', giro: 'Repuestos', rut: '', validezDias: 15, logo: '' }
})

describe('Datos de la empresa', () => {
  it('carga los valores guardados y expone el estado por onChange', async () => {
    const onChange = vi.fn()
    render(<DatosEmpresa onChange={onChange} />)
    expect(screen.getByLabelText('Nombre')).toHaveValue('Roncamotors')
    expect(screen.getByLabelText(/Giro/)).toHaveValue('Repuestos')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ businessName: 'Roncamotors' }))
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled()
  })

  it('RUT inválido: marca error y no guarda', async () => {
    const user = userEvent.setup()
    render(<DatosEmpresa />)
    await user.type(screen.getByLabelText('RUT'), '12345678-0')
    expect(screen.getByText('RUT inválido')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    expect(toast.error).toHaveBeenCalledWith('El RUT no es válido')
    expect(escrituras.sets).toHaveLength(0)
  })

  it('guarda en settings/global con RUT formateado y validez numérica', async () => {
    const user = userEvent.setup()
    render(<DatosEmpresa />)
    await user.type(screen.getByLabelText('RUT'), '123456785')
    await user.tab()
    expect(screen.getByLabelText('RUT')).toHaveValue('12.345.678-5')
    await user.clear(screen.getByLabelText(/Validez/))
    await user.type(screen.getByLabelText(/Validez/), '30')
    expect(useConfirmarSalida).toHaveBeenLastCalledWith(true)   // sucio
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(escrituras.sets).toHaveLength(1))
    expect(escrituras.sets[0]).toMatchObject({ ref: 'settings/global', data: { rut: '12.345.678-5', validezDias: 30, businessName: 'Roncamotors' } })
    expect(firestoreMock.setDoc.mock.calls[0][2]).toEqual({ merge: true })
    expect(liberar).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled()
  })

  it('logo: se convierte a data URL y se puede quitar', async () => {
    const user = userEvent.setup()
    render(<DatosEmpresa />)
    const archivo = new File(['x'], 'logo.png', { type: 'image/png' })
    await user.upload(document.querySelector('input[type=file]'), archivo)
    const img = await screen.findByAltText('Logo')
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    await user.click(screen.getByRole('button', { name: 'Quitar logo' }))
    expect(screen.queryByAltText('Logo')).not.toBeInTheDocument()
  })
})
