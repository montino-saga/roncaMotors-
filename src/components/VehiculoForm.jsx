import { useState } from 'react'
// import { toast } from 'sonner'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
// import { Download, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { CAMPOS_VEHICULO, VEHICULO_VACIO } from '../lib/vehiculo'
// Consulta por patente desactivada (ver functions/index.js):
// import { consultarPatente, mensajeErrorPatente } from '../lib/vehiculo'
// import { validarPatente } from '../lib/patente'

/** Alta y edición a mano de los datos del vehículo de un cliente. */
export function VehiculoForm({ isOpen, onClose, patente, vehiculo, onGuardar, guardando }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={vehiculo ? 'Editar vehículo' : 'Datos del vehículo'}>
            {/* Se monta al abrir: así el formulario parte siempre con los datos guardados. */}
            {isOpen && (
                <Formulario
                    patente={patente}
                    vehiculo={vehiculo}
                    onClose={onClose}
                    onGuardar={onGuardar}
                    guardando={guardando}
                />
            )}
        </Modal>
    )
}

function Formulario({ patente, vehiculo, onClose, onGuardar, guardando }) {
    const [datos, setDatos] = useState({ ...VEHICULO_VACIO, ...vehiculo })
    // const [consultando, setConsultando] = useState(false)

    const cambiar = (clave) => (e) => setDatos((prev) => ({ ...prev, [clave]: e.target.value }))

    // // Trae marca/modelo/año/tipo/motor de la patente; el resto se completa a mano.
    // const traerDatos = async () => {
    //     setConsultando(true)
    //     try {
    //         const datos = await consultarPatente(patente)
    //         setDatos((prev) => ({
    //             ...prev,
    //             ...Object.fromEntries(
    //                 CAMPOS_VEHICULO
    //                     .filter(({ clave }) => datos[clave] != null && datos[clave] !== '')
    //                     .map(({ clave }) => [clave, String(datos[clave])]),
    //             ),
    //         }))
    //         toast.success(datos.desdeCache ? 'Datos recuperados' : 'Datos traídos de la patente')
    //     } catch (error) {
    //         console.error('Error consultando patente:', error)
    //         toast.error(mensajeErrorPatente(error))
    //     } finally {
    //         setConsultando(false)
    //     }
    // }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                onGuardar(datos)
            }}
            className="space-y-4"
        >
            {patente && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/50 border border-white/10 px-3 py-2">
                    <p className="text-sm text-slate-400 min-w-0">
                        Patente <span className="font-mono text-white">{patente}</span>
                    </p>
                    {/* "Traer datos" desactivado junto con consultarPatente:
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={traerDatos}
                        disabled={consultando || !validarPatente(patente)}
                        className="h-9 px-3 text-sm inline-flex items-center gap-1.5 shrink-0"
                    >
                        {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {consultando ? 'Consultando…' : 'Traer datos'}
                    </Button>
                    */}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAMPOS_VEHICULO.map(({ clave, etiqueta, tipo, mono, placeholder }) => (
                    <div key={clave} className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300" htmlFor={`vehiculo-${clave}`}>
                            {etiqueta}
                        </label>
                        <Input
                            id={`vehiculo-${clave}`}
                            inputMode={tipo === 'number' ? 'numeric' : undefined}
                            value={datos[clave]}
                            onChange={
                                tipo === 'number'
                                    ? (e) => setDatos((prev) => ({ ...prev, [clave]: e.target.value.replace(/\D/g, '') }))
                                    : cambiar(clave)
                            }
                            placeholder={placeholder}
                            className={cn(mono && 'font-mono')}
                        />
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                </Button>
            </div>
        </form>
    )
}
