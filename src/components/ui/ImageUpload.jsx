import { useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../db/firebase'
import imageCompression from 'browser-image-compression'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'

export function ImageUpload({ onImageUploaded, currentImage, className }) {
    const [preview, setPreview] = useState(currentImage || '')
    const [uploading, setUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleDrag = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }, [])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])
        }
    }, [])

    const handleChange = (e) => {
        e.preventDefault()
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0])
        }
    }

    const handleFile = async (file) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona un archivo de imagen válido')
            return
        }

        try {
            setUploading(true)
            setProgress(10)

            // Opciones de compresión
            const options = {
                maxSizeMB: 1, // Máximo 1MB
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: 0.8
            }

            // Comprimir imagen
            const compressedFile = await imageCompression(file, options)
            setProgress(40)

            // Crear referencia en Storage
            const fileName = `productos/${Date.now()}-${file.name}`
            const storageRef = ref(storage, fileName)

            // Subir archivo
            const snapshot = await uploadBytes(storageRef, compressedFile)
            setProgress(80)

            // Obtener URL
            const downloadURL = await getDownloadURL(snapshot.ref)
            setProgress(100)

            setPreview(downloadURL)
            if (onImageUploaded) {
                onImageUploaded(downloadURL)
            }
            toast.success('Imagen subida correctamente')
        } catch (error) {
            console.error('Error al subir imagen:', error)
            toast.error('Error al subir la imagen')
        } finally {
            setUploading(false)
            setProgress(0)
        }
    }

    const removeImage = (e) => {
        e.preventDefault()
        e.stopPropagation() // Prevent triggering the file input
        setPreview('')
        if (onImageUploaded) {
            onImageUploaded('')
        }
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out flex flex-col items-center justify-center text-center cursor-pointer group overflow-hidden",
                    dragActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/5",
                    preview ? "border-none p-0" : ""
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('image-upload').click()}
            >
                <input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleChange}
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                        <div className="space-y-2 w-full max-w-xs">
                            <p className="text-sm text-slate-400">Optimizando y subiendo...</p>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ) : preview ? (
                    <div className="relative w-full aspect-video group">
                        <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white font-medium">Click o arrastra para cambiar</p>
                        </div>
                        <button
                            onClick={removeImage}
                            className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors z-10"
                            type="button"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="py-8 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-200">
                            <Upload className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-white">
                                Arrastra tu imagen aquí
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                o haz click para seleccionar
                            </p>
                        </div>
                        <p className="text-xs text-slate-500">
                            PNG, JPG, WEBP hasta 5MB
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
