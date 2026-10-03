import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword } from 'firebase/auth'
import { KeyRound, LayoutDashboard } from 'lucide-react'
import { auth } from '../../db/firebase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const MIN = 6

const errores = {
    'auth/expired-action-code': 'El enlace venció. Pide que te reenvíen la invitación o usa "¿Olvidaste tu contraseña?".',
    'auth/invalid-action-code': 'El enlace no es válido o ya se usó. Pide uno nuevo.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada.',
    'auth/user-not-found': 'La cuenta ya no existe.',
    'auth/weak-password': `La contraseña debe tener al menos ${MIN} caracteres.`,
}

/**
 * Destino del enlace de invitación / restablecimiento (/accion?mode=resetPassword&oobCode=…).
 * Reemplaza la página de Firebase para que, al guardar la contraseña, la
 * persona quede con sesión iniciada dentro del panel.
 */
function CrearContrasena() {
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const modo = params.get('mode')
    const codigo = params.get('oobCode')
    const [email, setEmail] = useState(null)
    const [error, setError] = useState('')
    const [password, setPassword] = useState('')
    const [repetir, setRepetir] = useState('')
    const [guardando, setGuardando] = useState(false)

    useEffect(() => {
        if (modo !== 'resetPassword' || !codigo) return
        verifyPasswordResetCode(auth, codigo)
            .then(setEmail)
            .catch((e) => setError(errores[e.code] || 'No se pudo validar el enlace.'))
    }, [modo, codigo])

    const guardar = async (e) => {
        e.preventDefault()
        setError('')
        if (password.length < MIN) return setError(errores['auth/weak-password'])
        if (password !== repetir) return setError('Las contraseñas no coinciden.')
        setGuardando(true)
        try {
            await confirmPasswordReset(auth, codigo, password)
            // Si había otra sesión abierta en este navegador, se reemplaza por la del invitado.
            await signInWithEmailAndPassword(auth, email, password)
            navigate('/', { replace: true })
        } catch (err) {
            setError(errores[err.code] || 'No se pudo guardar la contraseña.')
            setGuardando(false)
        }
    }

    const invalido = modo !== 'resetPassword' || !codigo

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>

            <form
                onSubmit={guardar}
                className="relative z-10 w-full max-w-sm bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6"
            >
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="p-3 bg-primary rounded-xl">
                        <LayoutDashboard className="w-7 h-7 text-on-accent" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Crea tu contraseña</h1>
                    <p className="text-sm text-slate-400">
                        {email ? <>Para <span className="text-white">{email}</span></> : 'Acceso al panel de administración'}
                    </p>
                </div>

                {invalido ? (
                    <p className="text-sm text-red-400 text-center">Enlace incompleto. Ábrelo directo desde el correo.</p>
                ) : !email && !error ? (
                    <p className="text-sm text-slate-400 text-center">Validando enlace…</p>
                ) : email && (
                    <div className="space-y-4">
                        <Input
                            type="password"
                            placeholder={`Nueva contraseña (mín. ${MIN})`}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            minLength={MIN}
                            required
                            autoFocus
                        />
                        <Input
                            type="password"
                            placeholder="Repite la contraseña"
                            value={repetir}
                            onChange={(e) => setRepetir(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                    </div>
                )}

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                {email ? (
                    <Button type="submit" disabled={guardando} className="w-full flex items-center justify-center gap-2">
                        <KeyRound className="w-4 h-4" />
                        {guardando ? 'Guardando…' : 'Guardar y entrar'}
                    </Button>
                ) : (error || invalido) && (
                    <Button type="button" variant="secondary" onClick={() => navigate('/', { replace: true })} className="w-full">
                        Ir al inicio de sesión
                    </Button>
                )}
            </form>
        </div>
    )
}

export default CrearContrasena
