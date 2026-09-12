import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'

// Un chunk viejo tras un deploy nuevo falla al importarse: no lo arregla
// reintentar el render, hay que bajar el bundle nuevo.
const esChunkViejo = (error) =>
    /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error?.message ?? '')

export class ErrorBoundary extends Component {
    state = { error: null }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        console.error('Error en la vista:', error, info.componentStack)
    }

    reintentar = () => this.setState({ error: null })

    render() {
        const { error } = this.state
        if (!error) return this.props.children

        const recargar = esChunkViejo(error)
        return (
            <div className="max-w-md mx-auto pt-12">
                <Card className="p-8 text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 mx-auto text-amber-400" />
                    <h1 className="text-2xl font-bold">
                        {recargar ? 'Hay una versión nueva' : 'Algo falló en esta vista'}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {recargar
                            ? 'Recarga la página para cargar la última versión de la app.'
                            : 'El resto de la app sigue funcionando. Puedes reintentar o volver al inicio.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        {recargar ? (
                            <Button onClick={() => window.location.reload()} className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4" /> Recargar
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => window.location.assign('/')}>Ir al inicio</Button>
                                <Button onClick={this.reintentar} className="flex items-center justify-center gap-2">
                                    <RefreshCw className="w-4 h-4" /> Reintentar
                                </Button>
                            </>
                        )}
                    </div>
                </Card>
            </div>
        )
    }
}
