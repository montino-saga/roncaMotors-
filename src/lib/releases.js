// Historial de versiones que ve el cliente. La primera entrada es la versión
// actual: al desplegar, añadir una nueva arriba y la app avisa sola.
// tipo: 'nuevo' | 'mejora' | 'arreglo'
// tour (opcional): pasos de un mini-recorrido que explica el parche en pantalla.

export const RELEASES = [
    {
        version: '1.5',
        fecha: '2026-09-23',
        titulo: 'Vehículo del cliente y edición de ficha',
        cambios: [
            { tipo: 'nuevo', titulo: 'Patente del cliente', detalle: 'Al crear un cliente puedes anotar la patente de su vehículo. La app la valida y la deja con formato (ABCD-12). Después puedes buscar a un cliente escribiendo su patente en el buscador.' },
            { tipo: 'nuevo', titulo: 'Datos del vehículo', detalle: 'Dentro de la ficha del cliente hay una tarjeta "Vehículo". Toca "Agregar datos" y completa marca, modelo, año, tipo, color, kilometraje, VIN y más. Quedan guardados junto al cliente.' },
            { tipo: 'nuevo', titulo: 'Traer datos por patente', detalle: 'En esa misma tarjeta, el botón "Traer datos" busca la patente y rellena solo marca, modelo, año y motor. El resto lo completas a mano. Si vuelves a consultar la misma patente, no gasta una nueva búsqueda.' },
            { tipo: 'nuevo', titulo: 'Editar cliente', detalle: 'La ficha ahora tiene un lápiz junto al nombre para corregir teléfono, RUT, patente o correo sin tener que crear el cliente de nuevo.' },
        ],
        tour: [
            { ruta: '/clientes', target: '[data-tour="clientes-nuevo"]', lado: 'bottom',
              titulo: 'Patente al crear', texto: 'Al dar de alta un cliente, ahora puedes anotar la patente de su vehículo. La app la valida y le da formato sola.' },
            { ruta: '/clientes', target: '[data-tour="clientes-buscar"]', lado: 'bottom',
              titulo: 'Buscar por patente', texto: 'Escribe una patente aquí y encuentras a su dueño al instante, además de por nombre, RUT o correo.' },
            { ruta: '/clientes', target: '[data-tour="clientes-lista"]', lado: 'top',
              titulo: 'Vehículo y edición', texto: 'Entra a un cliente: dentro tienes la tarjeta del vehículo (marca, modelo, año, VIN…) y un lápiz junto al nombre para editar sus datos.' },
        ],
    },
    {
        version: '1.4',
        fecha: '2026-09-12',
        titulo: 'Tutorial, novedades y app instalable',
        cambios: [
            { tipo: 'nuevo', titulo: 'Recorrido guiado', detalle: 'La primera vez que entras, la app te lleva vista por vista señalando cada cosa en pantalla. Repítelo cuando quieras desde "Novedades", abajo en el menú.' },
            { tipo: 'nuevo', titulo: 'Historial de versiones', detalle: 'Cada actualización queda explicada aquí. Un punto en "Novedades" avisa cuando hay una versión que aún no has leído.' },
            { tipo: 'nuevo', titulo: 'Instalar como app', detalle: 'Desde el navegador puedes instalar Roncamotors en el escritorio o el celular. Abre a pantalla completa y carga más rápido.' },
            { tipo: 'mejora', titulo: 'Aviso de actualización', detalle: 'Cuando hay una versión nueva, aparece un aviso para actualizar. Nunca se recarga sola en medio de una venta.' },
            { tipo: 'mejora', titulo: 'Título de la pestaña', detalle: 'La pestaña del navegador muestra en qué vista estás: "Punto de Venta · Roncamotors".' },
            { tipo: 'nuevo', titulo: 'Gastos del local', detalle: 'Nueva vista para anotar arriendo, luz, sueldos y otros gastos del mes. Se descuentan en el análisis de ganancia.' },
            { tipo: 'mejora', titulo: 'Tablas más compactas', detalle: 'Filas y KPIs ocupan menos espacio: cabe más información en pantalla sin hacer scroll.' },
        ],
    },
    {
        version: '1.3',
        fecha: '2026-09-12',
        titulo: 'Análisis, datos de empresa y búsqueda rápida',
        cambios: [
            { tipo: 'nuevo', titulo: 'Vista Análisis', detalle: 'Ganancia real del mes, productos que más rotan, capital inmovilizado y comparación con el mes anterior.' },
            { tipo: 'nuevo', titulo: 'Datos de la empresa', detalle: 'En Configuración puedes cargar RUT, dirección, teléfono y logo. Salen en las cotizaciones en PDF y puedes previsualizarlas antes de enviarlas.' },
            { tipo: 'nuevo', titulo: 'Buscador global (Ctrl+K)', detalle: 'Escribe el nombre de una vista o un producto desde cualquier pantalla y salta directo.' },
            { tipo: 'nuevo', titulo: 'Descuento por porcentaje', detalle: 'En el Punto de Venta puedes aplicar un % de descuento; queda registrado en el historial.' },
            { tipo: 'nuevo', titulo: 'Buscar por nombre en caja', detalle: 'Además del código de barras, la caja encuentra productos escribiendo el nombre.' },
            { tipo: 'nuevo', titulo: 'Deudas de clientes', detalle: 'Cada cliente tiene su ficha con lo que debe, abonos y el historial de fiados.' },
            { tipo: 'mejora', titulo: 'Uso en celular', detalle: 'Menú lateral deslizable, botones más grandes y la acción principal de cada vista a un toque.' },
            { tipo: 'mejora', titulo: 'Sin conexión', detalle: 'Si se corta internet, un aviso lo indica y la app sigue mostrando lo que ya tenía cargado.' },
            { tipo: 'mejora', titulo: 'Alerta de caja', detalle: 'Si terminó el día y la caja no se cerró, la app lo recuerda al entrar.' },
            { tipo: 'arreglo', titulo: 'Filtros de stock y fiados', detalle: 'Los filtros por stock en Productos y los fiados en el historial y el dashboard vuelven a contar bien.' },
        ],
    },
    {
        version: '1.2',
        fecha: '2026-08-22',
        titulo: 'Cotizaciones, IVA e inventario inteligente',
        cambios: [
            { tipo: 'nuevo', titulo: 'Cotización en PDF', detalle: 'Genera una cotización con logo, desglose de IVA y totales lista para enviar al cliente.' },
            { tipo: 'nuevo', titulo: 'IVA por producto', detalle: 'Cada producto indica si lleva IVA. El precio de venta se calcula por porcentaje sobre el costo.' },
            { tipo: 'nuevo', titulo: 'Inventario con indicadores', detalle: 'Capital invertido, margen, rotación y alertas de productos agotados o con poco stock.' },
            { tipo: 'mejora', titulo: 'Escaneo fluido en caja', detalle: 'El lector de código de barras agrega productos sin pausas, con botón para deshacer el último.' },
            { tipo: 'mejora', titulo: 'Acceso con usuario', detalle: 'La app pide iniciar sesión y los datos quedan protegidos por cuenta.' },
        ],
    },
    {
        version: '1.1',
        fecha: '2026-02-13',
        titulo: 'Fiados y clientes',
        cambios: [
            { tipo: 'nuevo', titulo: 'Ventas al fiado', detalle: 'Registra ventas a crédito asociadas a un cliente y llévalas en el historial.' },
            { tipo: 'nuevo', titulo: 'Clientes', detalle: 'Lista de clientes con RUT, teléfono y correo para asociar fiados y cotizaciones.' },
            { tipo: 'mejora', titulo: 'Diseño renovado', detalle: 'Nueva paleta oscura, tarjetas y navegación más clara.' },
        ],
    },
    {
        version: '1.0',
        fecha: '2026-01-18',
        titulo: 'Primera versión',
        cambios: [
            { tipo: 'nuevo', titulo: 'Punto de Venta', detalle: 'Escanea o busca productos, arma el carrito y cobra.' },
            { tipo: 'nuevo', titulo: 'Productos', detalle: 'Crea, edita y elimina productos con foto, código, costo y precio.' },
            { tipo: 'nuevo', titulo: 'Historial y Dashboard', detalle: 'Todas las ventas registradas y un resumen de ingresos por día y mes.' },
        ],
    },
]

export const VERSION_ACTUAL = RELEASES[0].version

export const ETIQUETA_TIPO = {
    nuevo: 'Nuevo',
    mejora: 'Mejora',
    arreglo: 'Arreglo',
}
