import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { cn } from '../lib/utils'
import { formatRut, validarRut } from '../lib/rut'
import { formatPatente, validarPatente } from '../lib/patente'

/** Edición de los datos de contacto del cliente. */
export function ClienteForm({ isOpen, onClose, cliente, onGuardar, guardando }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar cliente">
            {/* Se monta al abrir: parte siempre con los datos guardados. */}
            {isOpen && (
                <Formulario cliente={cliente} onClose={onClose} onGuardar={onGuardar} guardando={guardando} />
            )}
        </Modal>
    )
}

function Formulario({ cliente, onClose, onGuardar, guardando }) {
    const [name, setName] = useState(cliente.name ?? '')
    const [phone, setPhone] = useState(cliente.phone ?? '')
    const [rut, setRut] = useState(cliente.rut ?? '')
    const [patente, setPatente] = useState(cliente.patente ?? '')
    const [email, setEmail] = useState(cliente.email ?? '')
    const [tocado, setTocado] = useState({})

    const rutInvalido = rut.trim() !== '' && !validarRut(rut)
    const patenteInvalida = patente.trim() !== '' && !validarPatente(patente)

    const enviar = (e) => {
        e.preventDefault()
        if (rutInvalido || patenteInvalida) {
            setTocado({ rut: true, patente: true })
            return
        }
        onGuardar({
            name: name.trim(),
            phone: phone.trim(),
            rut: formatRut(rut),
            patente: formatPatente(patente),
            email: email.trim(),
        })
    }

    return (
        <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300" htmlFor="cliente-nombre">Nombre Completo</label>
                <Input id="cliente-nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300" htmlFor="cliente-telefono">Teléfono</label>
                <Input
                    id="cliente-telefono"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+ ]/g, ''))}
                    placeholder="Ej: +56 9 1234 5678"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300" htmlFor="cliente-rut">RUT</label>
                    <Input
                        id="cliente-rut"
                        value={rut}
                        onChange={(e) => setRut(e.target.value.replace(/[^0-9kK.-]/g, ''))}
                        onBlur={() => {
                            setRut(formatRut(rut))
                            setTocado((prev) => ({ ...prev, rut: true }))
                        }}
                        placeholder="12.345.678-9"
                        className={cn("font-mono", tocado.rut && rutInvalido && "border-red-500/60 focus:ring-red-500/40")}
                        aria-invalid={tocado.rut && rutInvalido}
                    />
                    {tocado.rut && rutInvalido && <p className="text-xs text-red-400">RUT inválido</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300" htmlFor="cliente-patente">Patente</label>
                    <Input
                        id="cliente-patente"
                        value={patente}
                        onChange={(e) => setPatente(e.target.value.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase())}
                        onBlur={() => {
                            setPatente(formatPatente(patente))
                            setTocado((prev) => ({ ...prev, patente: true }))
                        }}
                        placeholder="ABCD-12"
                        className={cn("font-mono uppercase", tocado.patente && patenteInvalida && "border-red-500/60 focus:ring-red-500/40")}
                        aria-invalid={tocado.patente && patenteInvalida}
                    />
                    {tocado.patente && patenteInvalida && <p className="text-xs text-red-400">Patente inválida</p>}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300" htmlFor="cliente-correo">Correo</label>
                <Input
                    id="cliente-correo"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@correo.cl"
                />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={guardando || !name.trim()}>
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            </div>
        </form>
    )
}
