import { useState } from 'react'
import { LayoutDashboard, Lock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'

const errores = {
    'auth/invalid-email': 'Correo inválido.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
}

function Login() {
    const { login, recuperar } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [aviso, setAviso] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setAviso('')
        setLoading(true)
        try {
            await login(email.trim(), password)
        } catch (err) {
            setError(errores[err.code] || 'No se pudo iniciar sesión.')
        } finally {
            setLoading(false)
        }
    }

    const handleRecuperar = async () => {
        const correo = email.trim()
        setError('')
        setAviso('')
        if (!correo) {
            setError('Escribe tu correo para recuperar la contraseña.')
            return
        }
        setLoading(true)
        try {
            await recuperar(correo)
            setAviso(`Te enviamos un correo a ${correo} para restablecer la contraseña.`)
        } catch (err) {
            setError(errores[err.code] || 'No se pudo enviar el correo de recuperación.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>

            <form
                onSubmit={handleSubmit}
                className="relative z-10 w-full max-w-sm bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6"
            >
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-primary rounded-xl">
                        <LayoutDashboard className="w-7 h-7 text-on-accent" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Iniciar sesión</h1>
                    <p className="text-sm text-slate-400">Acceso al panel de administración</p>
                </div>

                <div className="space-y-4">
                    <Input
                        type="email"
                        placeholder="Correo"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                    />
                    <Input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-400 text-center">{error}</p>
                )}
                {aviso && (
                    <p className="text-sm text-emerald-400 text-center">{aviso}</p>
                )}

                <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    {loading ? 'Entrando…' : 'Entrar'}
                </Button>

                <button
                    type="button"
                    onClick={handleRecuperar}
                    disabled={loading}
                    className="w-full text-sm text-slate-400 hover:text-white underline-offset-4 hover:underline disabled:opacity-50"
                >
                    ¿Olvidaste tu contraseña?
                </button>
            </form>
        </div>
    )
}

export default Login
