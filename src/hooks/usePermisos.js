import { useAuth } from '../context/AuthContext'
import { esDesarrollador, puedeEscribir } from '../lib/usuarios'

export const TITULO_SOLO_LECTURA = 'Tu rol es solo de lectura'

export function usePermisos() {
    const { perfil } = useAuth() ?? {}
    return { soloLectura: !puedeEscribir(perfil), esDesarrollador: esDesarrollador(perfil) }
}
