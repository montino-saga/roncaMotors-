import { Link, useLocation } from 'react-router-dom'
import { Compass, ShoppingCart } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

function NotFound() {
    const { pathname } = useLocation()
    return (
        <div className="max-w-md mx-auto pt-12">
            <Card className="p-8 text-center space-y-4">
                <Compass className="w-12 h-12 mx-auto text-slate-400" />
                <h1 className="text-2xl font-bold">Página no encontrada</h1>
                <p className="text-slate-400 text-sm">
                    No existe <code className="text-slate-300">{pathname}</code>
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Link to="/">
                        <Button variant="secondary" className="w-full">Ir al inicio</Button>
                    </Link>
                    <Link to="/ventas">
                        <Button className="w-full flex items-center justify-center gap-2">
                            <ShoppingCart className="w-4 h-4" /> Ir a ventas
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    )
}

export default NotFound
