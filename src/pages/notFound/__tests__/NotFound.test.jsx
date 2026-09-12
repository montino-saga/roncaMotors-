// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from '../NotFound'

describe('NotFound', () => {
  it('muestra la ruta y enlaces a inicio y ventas', () => {
    render(<MemoryRouter initialEntries={['/no-existe']}><NotFound /></MemoryRouter>)
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument()
    expect(screen.getByText('/no-existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ir al inicio/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /Ir a ventas/ })).toHaveAttribute('href', '/ventas')
  })
})
