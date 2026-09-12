import { useState } from 'react'
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from '../../components/ui/Card'
import { useAppearance } from '../../context/AppearanceContext'
import { cn } from '../../lib/utils'
import { SPRING_SNAPPY } from '../../lib/motion'
import { DatosEmpresa } from './DatosEmpresa'
import { PreviewCotizacion } from './PreviewCotizacion'

const OPCIONES = [
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'dark', label: 'Oscuro', icon: Moon },
    { id: 'system', label: 'Sistema', icon: Monitor },
]

function Settings() {
    const { mode, resolved, setMode } = useAppearance()
    // El formulario vive en DatosEmpresa; aquí solo llega su estado para el preview.
    const [empresa, setEmpresa] = useState(null)

    return (
        <div className="flex flex-col gap-4 lg:h-[calc(100dvh-2rem)] lg:min-h-0">
            <div className="shrink-0">
                <h1 className="text-2xl font-bold text-white">Configuración</h1>
                <p className="text-sm text-slate-400">Empresa y preferencias</p>
            </div>

            {/* Bento lg: 12 col. Izquierda (5) apariencia + formulario con scroll
                interno; derecha (7) el PDF a toda altura. Sin scroll de página. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 lg:min-h-0">
                <div className="lg:col-span-5 flex flex-col gap-4 lg:min-h-0">
                    <Card className="p-4 bg-slate-900/50 border-white/10 shrink-0 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0">
                                <Palette className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-semibold text-white leading-tight">Apariencia</h2>
                                <p className="text-xs text-slate-400 truncate">
                                    {resolved === 'dark' ? 'Oscuro' : 'Claro'}{mode === 'system' && ' · según el sistema'}
                                </p>
                            </div>
                        </div>
                        <div role="radiogroup" aria-label="Tema" className="flex gap-1.5 ml-auto">
                            {OPCIONES.map(({ id, label, icon: Icon }) => {
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
                                            'relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm',
                                            'outline-none focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors',
                                            activo ? 'bg-primary/10 border-primary/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                        )}
                                    >
                                        <Icon className={cn('w-4 h-4', activo && 'text-primary')} />
                                        {label}
                                        {activo && <Check className="w-3 h-3 text-primary" strokeWidth={3} />}
                                    </motion.button>
                                )
                            })}
                        </div>
                    </Card>

                    <DatosEmpresa onChange={setEmpresa} className="flex-1 lg:min-h-0" />
                </div>

                <PreviewCotizacion settings={empresa} className="lg:col-span-7 lg:min-h-0" />
            </div>
        </div>
    )
}

export default Settings
