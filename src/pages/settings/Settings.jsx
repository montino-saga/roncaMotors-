import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from '../../components/ui/Card'
import { useAppearance } from '../../context/AppearanceContext'
import { cn } from '../../lib/utils'
import { SPRING_SNAPPY } from '../../lib/motion'

const OPCIONES = [
    { id: 'light', label: 'Claro', desc: 'Fondo claro, texto oscuro', icon: Sun },
    { id: 'dark', label: 'Oscuro', desc: 'Fondo oscuro, texto claro', icon: Moon },
    { id: 'system', label: 'Sistema', desc: 'Sigue la preferencia del dispositivo', icon: Monitor },
]

function Settings() {
    const { mode, resolved, setMode } = useAppearance()

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Configuración</h1>
                <p className="text-sm text-slate-400 mt-1">Preferencias de este dispositivo</p>
            </div>

            <Card className="p-6 bg-slate-900/50 border-white/10 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/15 text-primary">
                        <Palette className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Apariencia</h2>
                        <p className="text-sm text-slate-400">
                            Tema activo: <span className="text-slate-200 font-medium">{resolved === 'dark' ? 'Oscuro' : 'Claro'}</span>
                            {mode === 'system' && ' (según el sistema)'}
                        </p>
                    </div>
                </div>

                <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {OPCIONES.map(({ id, label, desc, icon: Icon }) => {
                        const activo = mode === id
                        return (
                            <motion.button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={activo}
                                whileTap={{ scale: 0.97 }}
                                transition={SPRING_SNAPPY}
                                onClick={() => setMode(id)}
                                className={cn(
                                    'relative flex flex-col items-start gap-3 p-4 rounded-xl border text-left',
                                    'outline-none focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors',
                                    activo
                                        ? 'bg-primary/10 border-primary/50'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                )}
                            >
                                {activo && (
                                    <span className="absolute top-3 right-3 grid place-items-center w-5 h-5 rounded-full bg-primary text-on-accent">
                                        <Check className="w-3 h-3" strokeWidth={3} />
                                    </span>
                                )}
                                <Icon className={cn('w-6 h-6', activo ? 'text-primary' : 'text-slate-400')} />
                                <div>
                                    <p className="font-medium text-white">{label}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                                </div>
                            </motion.button>
                        )
                    })}
                </div>
            </Card>
        </div>
    )
}

export default Settings
