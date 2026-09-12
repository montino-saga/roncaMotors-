// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Modal } from '../Modal'

function Demo({ onClose = () => {} }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  // onClose inline: identidad nueva en cada render, como en las pantallas reales.
  return (
    <Modal isOpen onClose={() => onClose()} title="Demo">
      <input aria-label="A" value={a} onChange={(e) => setA(e.target.value)} autoFocus />
      <input aria-label="B" value={b} onChange={(e) => setB(e.target.value)} />
    </Modal>
  )
}

describe('Modal', () => {
  it('escribir en el segundo campo no devuelve el foco al primero', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    const b = screen.getByLabelText('B')
    await user.click(b)
    await user.type(b, '123456')
    expect(b).toHaveValue('123456')
    expect(b).toHaveFocus()
  })

  it('Escape cierra; con dismissible=false no', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    const bloqueado = vi.fn()
    render(<Modal isOpen onClose={bloqueado} title="Bloqueado" dismissible={false}><p>x</p></Modal>)
    await user.keyboard('{Escape}')
    expect(bloqueado).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cerrar', { selector: 'button:disabled' })).toBeDisabled()
  })

  it('Tab queda atrapado dentro del diálogo', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    await user.click(screen.getByLabelText('B'))
    await user.tab()
    // Tras el último focusable vuelve al primero (el botón Cerrar).
    expect(screen.getByLabelText('Cerrar')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByLabelText('B')).toHaveFocus()
  })

  it('cerrado no renderiza nada', async () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Nada"><p>x</p></Modal>)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
