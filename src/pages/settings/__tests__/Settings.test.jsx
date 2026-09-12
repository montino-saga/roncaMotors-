// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setMode = vi.fn()
vi.mock('../../../context/AppearanceContext', () => ({ useAppearance: () => ({ mode: 'system', resolved: 'dark', setMode }) }))
vi.mock('../DatosEmpresa', () => ({ DatosEmpresa: ({ onChange }) => <button onClick={() => onChange({ businessName: 'X' })}>form</button> }))
vi.mock('../PreviewCotizacion', () => ({ PreviewCotizacion: ({ settings }) => <p>preview:{settings?.businessName ?? 'nada'}</p> }))
import Settings from '../Settings'

describe('Configuración', () => {
  it('tema: tres opciones, la activa marcada, cambia con click', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    expect(screen.getByRole('radio', { name: /Sistema/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: /Claro/ }))
    expect(setMode).toHaveBeenCalledWith('light')
  })

  it('el formulario alimenta el preview', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    expect(screen.getByText('preview:nada')).toBeInTheDocument()
    await user.click(screen.getByText('form'))
    expect(screen.getByText('preview:X')).toBeInTheDocument()
  })
})
