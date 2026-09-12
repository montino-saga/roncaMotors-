import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, doc, getDocs, query, where, Timestamp, limit } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { formatCLP, cn } from '../../lib/utils'
import { toast } from 'sonner'
import { Lock, Unlock, DollarSign, TrendingUp, TrendingDown, History, AlertTriangle, Trash2 } from 'lucide-react'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../context/AuthContext'

function CashClose() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState(null)
    const [cashSales, setCashSales] = useState(0)
    const [movements, setMovements] = useState([])
    
    // Forms State
    const [openingAmount, setOpeningAmount] = useState('')
    const [closingCount, setClosingCount] = useState('')
    const [showMovementModal, setShowMovementModal] = useState(false)
    const [movementType, setMovementType] = useState('expense') // 'expense' | 'income'
    const [movementAmount, setMovementAmount] = useState('')
    const [movementDescription, setMovementDescription] = useState('')
    const [processing, setProcessing] = useState(false)

    // Confirm Close Modal State
    const [showConfirmCloseModal, setShowConfirmCloseModal] = useState(false)

    // Índice (en `movements`) del movimiento a eliminar
    const [movementToDelete, setMovementToDelete] = useState(null)

    useEffect(() => {
        fetchCurrentSession()
    }, [])

    const fetchCurrentSession = async () => {
        setLoading(true)
        try {
            // 1. Find open session
            const q = query(
                collection(db, 'cash_registers'),
                where('status', '==', 'open'),
                limit(1)
            )
            const snapshot = await getDocs(q)
            
            if (!snapshot.empty) {
                const sessionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
                setSession(sessionData)
                
                // 2. Fetch Cash Sales since opening
                await calculateCashSales(sessionData.openingTime)
                
                // 3. Set movements from session doc if any (assuming stored in array, or subcollection)
                // For simplicity, let's store them in the doc itself as arrays 'expenses' and 'incomes'
                // or just one 'movements' array
                setMovements(sessionData.movements || [])
            } else {
                setSession(null)
            }
        } catch (error) {
            console.error("Error fetching session:", error)
            toast.error("Error al cargar estado de caja")
        } finally {
            setLoading(false)
        }
    }

    const calculateCashSales = async (startTime) => {
        try {
            const q = query(
                collection(db, 'sales'),
                where('fechaVenta', '>=', startTime)
            )
            const snapshot = await getDocs(q)
            let total = 0
            snapshot.forEach(doc => {
                const data = doc.data()
                if (data.tipoPago === 'efectivo') {
                    total += (data.totalVenta || 0)
                }
            })
            setCashSales(total)
        } catch (error) {
            console.error("Error calculating sales:", error)
        }
    }

    const handleOpenRegister = async () => {
        if (!openingAmount || isNaN(openingAmount)) return toast.error("Ingresa un monto válido")
        
        setProcessing(true)
        try {
            const newSession = {
                openingTime: Timestamp.now(),
                status: 'open',
                openingBalance: Number(openingAmount),
                userId: user?.uid || null,
                movements: []
            }
            
            const docRef = await addDoc(collection(db, 'cash_registers'), newSession)
            setSession({ id: docRef.id, ...newSession })
            setCashSales(0)
            setMovements([])
            setOpeningAmount('')
            toast.success("Caja abierta correctamente")
        } catch (error) {
            console.error("Error opening register:", error)
            toast.error("Error al abrir caja")
        } finally {
            setProcessing(false)
        }
    }

    const handleAddMovement = async () => {
        if (!movementAmount || !movementDescription) return
        
        const amount = Number(movementAmount)
        if (!(amount > 0)) return toast.error("Ingresa un monto válido")
        if (movementType === 'expense' && amount > expectedBalance) {
            return toast.error(`No hay saldo suficiente en caja (${formatCLP(expectedBalance)})`)
        }

        setProcessing(true)
        try {
            const newMovement = {
                type: movementType,
                amount: amount,
                description: movementDescription,
                time: Timestamp.now()
            }
            
            const updatedMovements = [...(session.movements || []), newMovement]
            const sessionRef = doc(db, 'cash_registers', session.id)
            
            await updateDoc(sessionRef, {
                movements: updatedMovements
            })
            
            setSession({ ...session, movements: updatedMovements })
            setMovements(updatedMovements)
            setShowMovementModal(false)
            setMovementAmount('')
            setMovementDescription('')
            toast.success("Movimiento registrado")
        } catch (error) {
            console.error("Error adding movement:", error)
            toast.error("Error al registrar movimiento")
        } finally {
            setProcessing(false)
        }
    }

    const executeDeleteMovement = async () => {
        if (movementToDelete == null) return
        setProcessing(true)
        try {
            const updatedMovements = movements.filter((_, i) => i !== movementToDelete)
            const sessionRef = doc(db, 'cash_registers', session.id)
            await updateDoc(sessionRef, { movements: updatedMovements })

            setSession({ ...session, movements: updatedMovements })
            setMovements(updatedMovements)
            toast.success("Movimiento eliminado")
        } catch (error) {
            console.error("Error deleting movement:", error)
            toast.error("Error al eliminar movimiento")
        } finally {
            setProcessing(false)
            setMovementToDelete(null)
        }
    }

    const initiateCloseRegister = () => {
        if (!closingCount) {
            toast.error("Ingresa el monto real contado")
            return
        }
        setShowConfirmCloseModal(true)
    }

    const executeCloseRegister = async () => {
        setProcessing(true)
        try {
            const realCount = Number(closingCount)
            const totalExpenses = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + m.amount, 0)
            const totalIncomes = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + m.amount, 0)
            
            const expectedBalance = session.openingBalance + cashSales + totalIncomes - totalExpenses
            const difference = realCount - expectedBalance

            const closingData = {
                closingTime: Timestamp.now(),
                status: 'closed',
                closingBalance: realCount,
                expectedBalance: expectedBalance,
                cashSales: cashSales,
                totalExpenses,
                totalIncomes,
                difference: difference
            }

            const sessionRef = doc(db, 'cash_registers', session.id)
            await updateDoc(sessionRef, closingData)
            
            setSession(null)
            setClosingCount('')
            setShowConfirmCloseModal(false)
            toast.success("Caja cerrada exitosamente", {
                description: `Diferencia: ${formatCLP(difference)}`
            })
        } catch (error) {
            console.error("Error closing register:", error)
            toast.error("Error al cerrar caja")
        } finally {
            setProcessing(false)
        }
    }

    // Calculations for UI
    const totalExpenses = movements.filter(m => m.type === 'expense').reduce((acc, m) => acc + m.amount, 0)
    const totalIncomes = movements.filter(m => m.type === 'income').reduce((acc, m) => acc + m.amount, 0)
    const expectedBalance = session ? (session.openingBalance + cashSales + totalIncomes - totalExpenses) : 0
    const difference = closingCount ? (Number(closingCount) - expectedBalance) : 0

    if (loading) return <Skeleton className="h-96 w-full" />

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="p-6 bg-emerald-500/10 rounded-full">
                    <Unlock className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-bold text-white">Apertura de Caja</h2>
                <p className="text-slate-400 text-center max-w-md">
                    Para comenzar a vender, debes abrir la caja ingresando el fondo inicial (sencillo).
                </p>
                <Card className="w-full max-w-md p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Fondo Inicial</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input 
                                type="number" 
                                placeholder="0" 
                                className="pl-9 text-lg"
                                value={openingAmount}
                                onChange={(e) => setOpeningAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button 
                        className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-500"
                        onClick={handleOpenRegister}
                        disabled={processing}
                    >
                        {processing ? 'Abriendo...' : 'Abrir Caja'}
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Lock className="w-6 h-6 text-emerald-400" />
                        Control de Caja
                    </h2>
                    <p className="text-slate-400 text-sm">
                        Turno iniciado: {session.openingTime.toDate().toLocaleString('es-CL')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => {
                        setMovementType('income')
                        setShowMovementModal(true)
                    }}>
                        + Ingreso
                    </Button>
                    <Button variant="secondary" className="text-red-400 border-red-500/20 hover:bg-red-500/10" onClick={() => {
                        setMovementType('expense')
                        setShowMovementModal(true)
                    }}>
                        - Gasto/Retiro
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border-l-4 border-l-blue-500">
                    <p className="text-sm text-slate-400 mb-1">Saldo Inicial</p>
                    <p className="text-2xl font-bold text-white">{formatCLP(session.openingBalance)}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-emerald-500">
                    <p className="text-sm text-slate-400 mb-1">Ventas Efectivo</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatCLP(cashSales)}</p>
                </Card>
                <Card className="p-4 border-l-4 border-l-orange-500">
                    <p className="text-sm text-slate-400 mb-1">Entradas / Salidas</p>
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-sm flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> {formatCLP(totalIncomes)}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-red-400 text-sm flex items-center"><TrendingDown className="w-3 h-3 mr-1"/> {formatCLP(totalExpenses)}</span>
                    </div>
                </Card>
                <Card className="p-4 border-l-4 border-l-white">
                    <p className="text-sm text-slate-400 mb-1">Total Esperado</p>
                    <p className="text-3xl font-bold text-white">{formatCLP(expectedBalance)}</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Movements List */}
                <Card className="p-6">
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" />
                        Movimientos
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {movements.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">No hay movimientos registrados</p>
                        ) : (
                            movements.map((mov, i) => ({ mov, i })).reverse().map(({ mov, i }) => (
                                <div key={i} className="flex justify-between items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 group">
                                    <div className="min-w-0">
                                        <p className="text-white font-medium truncate">{mov.description}</p>
                                        <p className="text-xs text-slate-400">{mov.time.toDate().toLocaleTimeString('es-CL')}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={cn(
                                            "font-bold",
                                            mov.type === 'income' ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {mov.type === 'income' ? '+' : '-'}{formatCLP(mov.amount)}
                                        </span>
                                        <button
                                            onClick={() => setMovementToDelete(i)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Eliminar movimiento"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Closing Form */}
                <Card className="p-6 border-red-500/20 bg-red-500/5">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        Cierre de Caja (Corte Z)
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                        Ingresa el dinero real contado en caja. El sistema calculará la diferencia automáticamente.
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Total Real en Efectivo</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input 
                                    type="number" 
                                    placeholder="0" 
                                    className="pl-9 h-12 text-lg bg-slate-950 border-red-500/20 focus:ring-red-500/50"
                                    value={closingCount}
                                    onChange={(e) => setClosingCount(e.target.value)}
                                />
                            </div>
                        </div>

                        {closingCount && (
                            <div className={cn(
                                "p-4 rounded-lg border",
                                difference >= 0 
                                    ? "bg-emerald-500/10 border-emerald-500/20" 
                                    : "bg-red-500/10 border-red-500/20"
                            )}>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-300">Diferencia:</span>
                                    <span className={cn(
                                        "text-lg font-bold",
                                        difference >= 0 ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {formatCLP(difference)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <Button 
                            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
                            onClick={initiateCloseRegister}
                            disabled={processing || !closingCount}
                        >
                            {processing ? 'Cerrando...' : 'Realizar Cierre de Caja'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Add Movement Modal */}
            <Modal
                isOpen={showMovementModal}
                onClose={() => setShowMovementModal(false)}
                title={movementType === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto/Retiro'}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">Monto</label>
                        <Input 
                            type="number" 
                            autoFocus
                            value={movementAmount} 
                            onChange={(e) => setMovementAmount(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">Descripción / Motivo</label>
                        <Input 
                            type="text" 
                            value={movementDescription} 
                            onChange={(e) => setMovementDescription(e.target.value)}
                            placeholder={movementType === 'income' ? 'Ej: Cambio inicial extra' : 'Ej: Pago proveedor pan'}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setShowMovementModal(false)}>Cancelar</Button>
                        <Button onClick={handleAddMovement} disabled={processing}>
                            Guardar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Movement Modal */}
            <Modal
                isOpen={movementToDelete != null}
                onClose={() => setMovementToDelete(null)}
                title="Eliminar Movimiento"
                className="max-w-md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 mb-2">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-medium text-white">¿Eliminar este movimiento?</h3>
                        {movements[movementToDelete] && (
                            <p className="text-slate-400">
                                {movements[movementToDelete].description} · {movements[movementToDelete].type === 'income' ? '+' : '-'}{formatCLP(movements[movementToDelete].amount)}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setMovementToDelete(null)} disabled={processing}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 border-none"
                            onClick={executeDeleteMovement}
                            disabled={processing}
                        >
                            {processing ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Close Modal */}
            <Modal
                isOpen={showConfirmCloseModal}
                onClose={() => setShowConfirmCloseModal(false)}
                title="Confirmar Cierre de Caja"
                className="max-w-md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 mb-2">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-medium text-white">¿Estás seguro de cerrar la caja?</h3>
                        <p className="text-slate-400">
                            Esta acción finalizará el turno actual y registrará el balance final. No se puede deshacer.
                        </p>
                        
                        <div className="bg-white/5 p-4 rounded-xl w-full border border-white/10 mt-4">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-400">Total Esperado:</span>
                                <span className="text-white font-medium">{formatCLP(expectedBalance)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-400">Total Real:</span>
                                <span className="text-white font-medium">{formatCLP(Number(closingCount))}</span>
                            </div>
                            <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                                <span className="text-slate-400">Diferencia:</span>
                                <span className={cn(
                                    "font-bold",
                                    difference >= 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {formatCLP(difference)}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowConfirmCloseModal(false)} disabled={processing}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 border-none" 
                            onClick={executeCloseRegister} 
                            disabled={processing}
                        >
                            {processing ? 'Cerrando...' : 'Confirmar Cierre'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default CashClose