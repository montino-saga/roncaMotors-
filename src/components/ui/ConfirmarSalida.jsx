import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmarSalida({ blocker }) {
    const abierto = blocker.state === 'blocked'
    return (
        <Modal isOpen={abierto} onClose={() => blocker.reset()} title="Cambios sin guardar">
            <p className="text-slate-400 text-sm mb-6">
                Si sales ahora perderás los cambios de este formulario.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button variant="secondary" onClick={() => blocker.reset()}>Seguir editando</Button>
                <Button variant="danger" onClick={() => blocker.proceed()}>Salir sin guardar</Button>
            </div>
        </Modal>
    )
}
