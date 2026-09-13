// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { firestoreMock, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
let cbAuth
const signIn = vi.fn(), signOutMock = vi.fn()
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_a, cb) => { cbAuth = cb; return () => {} }),
  signInWithEmailAndPassword: (...a) => signIn(...a),
  signOut: (...a) => signOutMock(...a),
}))
vi.mock('../../db/firebase', () => ({ db: {}, auth: { app: 'auth' } }))
vi.mock('../../lib/marca', () => ({ NOMBRE_NEGOCIO: 'Roncamotors', LOGO_LOCAL: 'logo.jpeg' }))
import { AuthProvider, useAuth } from '../AuthContext'
import { ThemeProvider, useTheme } from '../ThemeContext'
import { AppearanceProvider, useAppearance } from '../AppearanceContext'

beforeEach(resetFirebaseMock)

describe('AuthContext', () => {
  it('loading hasta que Firebase responde; login/logout delegan', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    expect(result.current.loading).toBe(true)
    act(() => cbAuth({ uid: 'u1' }))
    expect(result.current.user).toEqual({ uid: 'u1' })
    expect(result.current.loading).toBe(false)
    result.current.login('a@b.c', 'x')
    expect(signIn).toHaveBeenCalledWith({ app: 'auth' }, 'a@b.c', 'x')
    result.current.logout()
    expect(signOutMock).toHaveBeenCalled()
  })
})

describe('ThemeContext', () => {
  it('sin doc en Firestore: marca local; con doc: mezcla sin borrar lo local vacío', () => {
    let cb
    firestoreMock.onSnapshot.mockImplementation((_r, fn) => { cb = fn; return () => {} })
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.loading).toBe(true)
    act(() => cb({ exists: () => false }))
    expect(result.current.settings.businessName).toBe('Roncamotors')
    expect(result.current.loading).toBe(false)
    act(() => cb({ exists: () => true, data: () => ({ businessName: '', logo: '', rut: '1-9', primaryColor: '#ff0000' }) }))
    expect(result.current.settings).toMatchObject({ businessName: 'Roncamotors', logo: 'logo.jpeg', rut: '1-9', validezDias: 15 })
    expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#ff0000')
  })
})

describe('AppearanceContext', () => {
  const Consumidor = () => {
    const { mode, resolved, setMode } = useAppearance()
    return <>
      <p>{mode}/{resolved}</p>
      <button onClick={() => setMode('light')}>claro</button>
      <button onClick={() => setMode('system')}>sistema</button>
    </>
  }
  it('system sigue prefers-color-scheme; elegir tema lo persiste y aplica data-theme', async () => {
    window.matchMedia = vi.fn((q) => ({ matches: q.includes('dark'), addEventListener() {}, removeEventListener() {} }))
    document.startViewTransition = undefined
    const user = userEvent.setup()
    render(<AppearanceProvider><Consumidor /></AppearanceProvider>)
    expect(screen.getByText('system/dark')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
    await user.click(screen.getByText('claro'))
    expect(screen.getByText('light/light')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(JSON.parse(localStorage.getItem('roncamotors_theme'))).toBe('light')
    await user.click(screen.getByText('sistema'))
    expect(screen.getByText('system/dark')).toBeInTheDocument()
  })
})
