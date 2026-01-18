import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { Save, ArrowLeft } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '../../components/ui/Skeleton'

function EditProduct() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [producto, setProducto] = useState({
        nombreProducto: '',
        marcaProducto: '',
        categoriaProducto: '',
        precioVentaLocal: '',
        precioVentaWeb: '',
        precioOriginal: '',
        cantidadProducto: '',
        imagenProducto: '',
        idProducto: ''
    })

    useEffect(() => {
        const obtenerProducto = async () => {
            try {
                const docRef = doc(db, 'productos', id)
                const docSnap = await getDoc(docRef)

                if (docSnap.exists()) {
                    const data = docSnap.data()
                    setProducto({
                        ...data,
                        id: docSnap.id,
                        precioVentaLocal: data.precioVentaLocal ?? data.precioProducto ?? '',
                        precioVentaWeb: data.precioVentaWeb ?? ''
                    })
                } else {
                    toast.error('Producto no encontrado')
                    navigate('/')
                }
            } catch (error) {
                console.error("Error al obtener producto:", error)
                toast.error('Error al cargar el producto')
            } finally {
                setLoading(false)
            }
        }

        obtenerProducto()
    }, [id, navigate])

    const handleChange = (e) => {
        setProducto({
            ...producto,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const docRef = doc(db, 'productos', id)
            await updateDoc(docRef, {
                ...producto,
                precioVentaLocal: Number(producto.precioVentaLocal),
                precioVentaWeb: Number(producto.precioVentaWeb),
                precioOriginal: Number(producto.precioOriginal),
                cantidadProducto: Number(producto.cantidadProducto),
                precioProducto: Number(producto.precioVentaLocal)
            })
            toast.success('Producto actualizado con éxito')
            navigate('/')
        } catch (error) {
            console.error("Error al actualizar producto:", error)
            toast.error('Error al actualizar producto')
        }
    }

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Card className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-xl" />
                            ))}
                        </div>
                        <div className="lg:col-span-1">
                            <Skeleton className="h-64 w-full rounded-xl" />
                        </div>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8 flex items-center gap-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-white" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Editar Producto</h2>
                    <p className="text-slate-400">Modifica los detalles del producto.</p>
                </div>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Form Fields */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Basic Info Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Información Básica</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Nombre del Producto</label>
                                        <Input
                                            name="nombreProducto"
                                            placeholder="Ej. iPhone 15 Pro"
                                            value={producto.nombreProducto}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">Marca</label>
                                            <Input
                                                name="marcaProducto"
                                                placeholder="Ej. Apple"
                                                value={producto.marcaProducto}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">Categoría</label>
                                            <Input
                                                name="categoriaProducto"
                                                placeholder="Ej. Electrónica"
                                                value={producto.categoriaProducto}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Precios</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-emerald-400">Precio Local</label>
                                        <CurrencyInput
                                            name="precioVentaLocal"
                                            placeholder="$0"
                                            value={producto.precioVentaLocal}
                                            onChange={handleChange}
                                            required
                                            className="border-emerald-500/20 focus:border-emerald-500/50"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-sky-400">Precio Web</label>
                                        <CurrencyInput
                                            name="precioVentaWeb"
                                            placeholder="$0"
                                            value={producto.precioVentaWeb}
                                            onChange={handleChange}
                                            required
                                            className="border-sky-500/20 focus:border-sky-500/50"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Precio Original</label>
                                        <CurrencyInput
                                            name="precioOriginal"
                                            placeholder="$0"
                                            value={producto.precioOriginal}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Inventario</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Stock Disponible</label>
                                        <Input
                                            name="cantidadProducto"
                                            type="number"
                                            placeholder="0"
                                            value={producto.cantidadProducto}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">ID Personalizado (Opcional)</label>
                                        <Input
                                            name="idProducto"
                                            placeholder="Identificador único"
                                            value={producto.idProducto}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Image Upload */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Imagen del Producto</label>
                                    <ImageUpload
                                        onImageUploaded={(url) => setProducto(prev => ({ ...prev, imagenProducto: url }))}
                                        currentImage={producto.imagenProducto}
                                        className="h-full"
                                    />
                                </div>

                                <Button type="submit" className="w-full flex items-center justify-center gap-2 mt-6">
                                    <Save className="w-5 h-5" />
                                    Guardar Cambios
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </Card>
        </div>
    )
}

export default EditProduct
