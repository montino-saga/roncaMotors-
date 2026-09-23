/** Datos del vehículo del cliente: se traen de Boostr por patente y/o se cargan a mano. */

import { httpsCallable } from 'firebase/functions'
import { functions } from '../db/firebase'

const MENSAJES = {
    'functions/not-found': 'Sin datos para esa patente.',
    'functions/invalid-argument': 'Patente inválida.',
    'functions/unauthenticated': 'Sesión expirada, vuelve a entrar.',
    'functions/resource-exhausted': 'Se acabaron las consultas disponibles.',
    'functions/unavailable': 'El servicio de patentes no responde.',
    'functions/failed-precondition': 'Falta configurar la API key del servicio.',
}

export const mensajeErrorPatente = (error) =>
    MENSAJES[error?.code] ?? error?.message ?? 'No se pudo consultar la patente.'

/** Consulta Boostr vía Cloud Function; devuelve solo los campos del vehículo (sin dueño). */
export async function consultarPatente(patente) {
    const llamar = httpsCallable(functions, 'consultarPatente')
    const { data } = await llamar({ patente })
    return data
}

export const CAMPOS_VEHICULO = [
    { clave: 'marca', etiqueta: 'Marca', placeholder: 'Toyota' },
    { clave: 'modelo', etiqueta: 'Modelo', placeholder: 'Yaris Sedán' },
    { clave: 'anio', etiqueta: 'Año', tipo: 'number', placeholder: '2019' },
    { clave: 'tipo', etiqueta: 'Tipo', placeholder: 'Automóvil' },
    { clave: 'color', etiqueta: 'Color', placeholder: 'Gris' },
    { clave: 'combustible', etiqueta: 'Combustible', placeholder: 'Gasolina' },
    { clave: 'transmision', etiqueta: 'Transmisión', placeholder: 'Manual' },
    { clave: 'kilometraje', etiqueta: 'Kilometraje', tipo: 'number', placeholder: '84500' },
    { clave: 'vin', etiqueta: 'VIN / Chasis', mono: true, placeholder: 'MR2BT9F31K1234567' },
    { clave: 'motor', etiqueta: 'N° motor', mono: true, placeholder: '2NRK123456' },
]

export const VEHICULO_VACIO = Object.fromEntries(CAMPOS_VEHICULO.map(({ clave }) => [clave, '']))

/** Solo los campos con valor; devuelve null si no se llenó ninguno. */
export const limpiarVehiculo = (datos) => {
    const lleno = Object.fromEntries(
        CAMPOS_VEHICULO
            .map(({ clave }) => [clave, String(datos?.[clave] ?? '').trim()])
            .filter(([, valor]) => valor !== ''),
    )
    return Object.keys(lleno).length ? lleno : null
}

export const formatKilometraje = (km) =>
    km === '' || km == null ? '' : `${Number(km).toLocaleString('es-CL')} km`

export const valorVehiculo = (vehiculo, clave) =>
    clave === 'kilometraje' ? formatKilometraje(vehiculo[clave]) : vehiculo[clave]

export const resumenVehiculo = (v) =>
    [v?.marca, v?.modelo, v?.anio].filter(Boolean).join(' ') || 'Vehículo sin datos'
