import { useEffect, useRef, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import imageCompression from 'browser-image-compression'
import { toast } from 'sonner'
import { Building2, Upload, X, Save, FileText, Loader2 } from 'lucide-react'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useTheme } from '../../context/ThemeContext'
import { useConfirmarSalida } from '../../hooks/useConfirmarSalida'
import { usePermisos } from '../../hooks/usePermisos'
import { ConfirmarSalida } from '../../components/ui/ConfirmarSalida'
import { formatRut, validarRut } from '../../lib/rut'
import { cn } from '../../lib/utils'

const CAMPOS_EMPRESA = ['businessName', 'giro', 'rut', 'direccion', 'telefono', 'email', 'web', 'validezDias', 'piePagina', 'logo']

const VACIO = {
    businessName: '', giro: '', rut: '', direccion: '', telefono: '', email: '', web: '',
    validezDias: 15, piePagina: '', logo: '',
}

const desdeSettings = (s) => Object.fromEntries(CAMPOS_EMPRESA.map(k => [k, s?.[k] ?? VACIO[k]]))

// El logo va como data URL dentro de settings/global, no a Storage: jsPDF lo
// pinta desde un canvas y una URL de Storage sin CORS lo contamina. A 480 px
// y JPEG 0,8 pesa 20–40 KB: cabe de sobra en el documento.
async function logoADataUrl(file) {
    const comprimido = await imageCompression(file, { maxWidthOrHeight: 480, maxSizeMB: 0.15, useWebWorker: true, initialQuality: 0.8, fileType: 'image/jpeg' })
    return await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = reject
        r.readAsDataURL(comprimido)
    })
}

const Campo = ({ label, hint, children, className }) => (
    <label className={cn('block', className)}>
        <span className="block text-sm text-slate-300 mb-1.5">{label}{hint && <span className="text-slate-500"> — {hint}</span>}</span>
        {children}
    </label>
)

export function DatosEmpresa({ onChange, className }) {
    const { soloLectura } = usePermisos()
    const { settings, loading } = useTheme()
    const [form, setForm] = useState(() => desdeSettings(settings))
    const [guardado, setGuardado] = useState(() => desdeSettings(settings))
    const [guardando, setGuardando] = useState(false)
    const [subiendoLogo, setSubiendoLogo] = useState(false)
    const fileRef = useRef(null)

    useEffect(() => { onChange?.(form) }, [form, onChange])

    const sucio = JSON.stringify(form) !== JSON.stringify(guardado)
    const sucioRef = useRef(sucio)
    useEffect(() => { sucioRef.current = sucio })

    // Primera carga real desde Firestore (o cambio desde otro dispositivo)
    // pisa el formulario solo si el usuario no ha tocado nada.
    useEffect(() => {
        if (loading) return
        const remoto = desdeSettings(settings)
        setGuardado(remoto)
        if (!sucioRef.current) setForm(remoto)
    }, [settings, loading])
    const { blocker, liberar } = useConfirmarSalida(sucio)
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
    const rutInvalido = form.rut.trim() !== '' && !validarRut(form.rut)

    const elegirLogo = async (file) => {
        if (!file?.type.startsWith('image/')) return toast.error('Selecciona una imagen')
        setSubiendoLogo(true)
        try {
            setForm(f => ({ ...f, logo: '' }))
            const dataUrl = await logoADataUrl(file)
            setForm(f => ({ ...f, logo: dataUrl }))
        } catch (error) {
            console.error('Logo:', error)
            toast.error('No se pudo procesar el logo')
        } finally {
            setSubiendoLogo(false)
        }
    }

    const guardar = async (e) => {
        e.preventDefault()
        if (rutInvalido) return toast.error('El RUT no es válido')
        setGuardando(true)
        try {
            const datos = {
                ...form,
                rut: form.rut.trim() ? formatRut(form.rut) : '',
                validezDias: Math.max(1, Number(form.validezDias) || 15),
            }
            await setDoc(doc(db, 'settings', 'global'), datos, { merge: true })
            setGuardado(datos)
            setForm(datos)
            liberar()
            toast.success('Datos de la empresa guardados')
        } catch (error) {
            console.error('Guardar empresa:', error)
            toast.error('No se pudieron guardar los datos')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <>
        <ConfirmarSalida blocker={blocker} />
        <Card className={cn('p-0 bg-slate-900/50 border-white/10 flex flex-col overflow-hidden', className)}>
            <form onSubmit={guardar} className="flex flex-col min-h-0 flex-1">
            <fieldset disabled={soloLectura} className="contents">
                <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
                    <div className="p-2 rounded-lg bg-primary/15 text-primary">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white leading-tight">Datos de la empresa</h2>
                        <p className="text-xs text-slate-400">Cabecera de las cotizaciones y menú.</p>
                    </div>
                </div>

                {/* Solo los campos scrollean; cabecera y Guardar quedan fijos. */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
                    {/* Logo */}
                    <div className="space-y-2">
                        <span className="block text-sm text-slate-300">Logo</span>
                        <div
                            className={cn(
                                'relative w-32 h-32 rounded-xl border border-dashed border-white/20 bg-white/5 overflow-hidden',
                                'grid place-items-center text-slate-500'
                            )}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); elegirLogo(e.dataTransfer.files?.[0]) }}
                        >
                            {subiendoLogo ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : form.logo ? (
                                <>
                                    <img src={form.logo} alt="Logo" className="w-full h-full object-contain bg-white" />
                                    <button
                                        type="button"
                                        aria-label="Quitar logo"
                                        onClick={() => setForm(f => ({ ...f, logo: '' }))}
                                        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-950/70 text-white hover:bg-red-500 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            ) : (
                                <Upload className="w-6 h-6" />
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegirLogo(e.target.files?.[0])} />
                        <Button type="button" variant="secondary" className="w-32 text-sm py-1.5" onClick={() => fileRef.current?.click()} disabled={subiendoLogo}>
                            {form.logo ? 'Cambiar' : 'Subir'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Campo label="Nombre" className="sm:col-span-2">
                            <Input value={form.businessName} onChange={set('businessName')} placeholder="Roncamotors" required />
                        </Campo>
                        <Campo label="Giro" hint="bajo el nombre">
                            <Input value={form.giro} onChange={set('giro')} placeholder="Repuestos y accesorios" />
                        </Campo>
                        <Campo label="RUT">
                            <Input
                                value={form.rut}
                                onChange={set('rut')}
                                onBlur={() => setForm(f => ({ ...f, rut: f.rut.trim() ? formatRut(f.rut) : '' }))}
                                placeholder="76.123.456-7"
                                aria-invalid={rutInvalido}
                                className={cn(rutInvalido && 'border-red-500/60 focus:ring-red-500/40')}
                            />
                            {rutInvalido && <span className="block text-xs text-red-400 mt-1">RUT inválido</span>}
                        </Campo>
                        <Campo label="Dirección" className="sm:col-span-2">
                            <Input value={form.direccion} onChange={set('direccion')} placeholder="Av. Ejemplo 1234, Santiago" />
                        </Campo>
                        <Campo label="Teléfono">
                            <Input value={form.telefono} onChange={set('telefono')} placeholder="+56 9 1234 5678" type="tel" />
                        </Campo>
                        <Campo label="Correo">
                            <Input value={form.email} onChange={set('email')} placeholder="ventas@empresa.cl" type="email" />
                        </Campo>
                        <Campo label="Sitio web" className="sm:col-span-2">
                            <Input value={form.web} onChange={set('web')} placeholder="www.empresa.cl" />
                        </Campo>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-4">
                    <div className="flex items-center gap-2 text-slate-300">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">Cotizaciones</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4">
                        <Campo label="Validez" hint="días">
                            <Input type="number" min="1" max="365" value={form.validezDias} onChange={set('validezDias')} />
                        </Campo>
                        <Campo label="Nota al pie" hint="condiciones, forma de pago…">
                            <textarea
                                value={form.piePagina}
                                onChange={set('piePagina')}
                                rows={2}
                                placeholder="Los precios pueden variar sin previo aviso una vez vencida la cotización. Sujeto a disponibilidad de stock."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all resize-y text-sm"
                            />
                        </Campo>
                    </div>
                </div>

                </div>

                <div className="flex justify-end items-center gap-3 p-3 border-t border-white/10 shrink-0">
                    {sucio && <span className="text-xs text-amber-400">Cambios sin guardar</span>}
                    <Button type="submit" disabled={guardando || subiendoLogo || !sucio} className="flex items-center gap-2">
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                    </Button>
                </div>
            </fieldset>
            </form>
        </Card>
        </>
    )
}
