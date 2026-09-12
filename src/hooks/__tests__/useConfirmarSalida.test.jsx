// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, Link, useNavigate } from 'react-router-dom'
import { useConfirmarSalida } from '../useConfirmarSalida'
import { ConfirmarSalida } from '../../components/ui/ConfirmarSalida'

function Formulario({ sucio }) {
  const { blocker, liberar } = useConfirmarSalida(sucio)
  const navigate = useNavigate()
  return (
    <>
      <ConfirmarSalida blocker={blocker} />
      <p>formulario</p>
      <Link to="/otra">salir</Link>
      <button onClick={() => { liberar(); navigate('/otra') }}>guardar</button>
    </>
  )
}

const montar = (sucio) => {
  const router = createMemoryRouter([
    { path: '/', element: <Formulario sucio={sucio} /> },
    { path: '/otra', element: <p>otra vista</p> },
  ])
  render(<RouterProvider router={router} />)
}

describe('useConfirmarSalida', () => {
  it('limpio: navega sin preguntar', async () => {
    const user = userEvent.setup()
    montar(false)
    await user.click(screen.getByRole('link', { name: 'salir' }))
    expect(await screen.findByText('otra vista')).toBeInTheDocument()
  })

  it('sucio: pregunta; "Seguir editando" se queda', async () => {
    const user = userEvent.setup()
    montar(true)
    await user.click(screen.getByRole('link', { name: 'salir' }))
    expect(await screen.findByText('Cambios sin guardar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(screen.getByText('formulario')).toBeInTheDocument()
    expect(screen.queryByText('otra vista')).not.toBeInTheDocument()
  })

  it('sucio: "Salir sin guardar" navega', async () => {
    const user = userEvent.setup()
    montar(true)
    await user.click(screen.getByRole('link', { name: 'salir' }))
    await user.click(await screen.findByRole('button', { name: 'Salir sin guardar' }))
    expect(await screen.findByText('otra vista')).toBeInTheDocument()
  })

  it('liberar() salta el guard tras guardar', async () => {
    const user = userEvent.setup()
    montar(true)
    await user.click(screen.getByRole('button', { name: 'guardar' }))
    expect(await screen.findByText('otra vista')).toBeInTheDocument()
    expect(screen.queryByText('Cambios sin guardar')).not.toBeInTheDocument()
  })
})
