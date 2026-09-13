// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CurrencyInput } from '../CurrencyInput'

describe('CurrencyInput', () => {
  it('muestra formateado y entrega solo dígitos', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CurrencyInput name="monto" value="" onChange={onChange} placeholder="$0" />)
    // No controlado en el test: cada tecla llega sola; letras y puntos salen como ''.
    await user.type(screen.getByPlaceholderText('$0'), '1a5.0')
    expect(onChange.mock.calls.map(c => c[0].target.value)).toEqual(['1', '', '5', '', '0'])
    expect(onChange.mock.calls[0][0].target.name).toBe('monto')
  })
  it('valor controlado se pinta como CLP', () => {
    render(<CurrencyInput name="m" value="45990" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('$45.990')
  })
})
