// Pasos del recorrido guiado. `target` es un selector [data-tour]; si no
// aparece a tiempo se ilumina la vista completa. `menu` abre el drawer en móvil.

export const PASOS_TOUR = [
    {
        target: '[data-tour="marca"]', menu: true, lado: 'right',
        titulo: 'Bienvenido a Roncamotors',
        texto: 'Un recorrido de un minuto por cada vista. Usa las flechas del teclado o los botones para avanzar; Esc para salir.',
    },
    {
        ruta: '/', target: '[data-tour="nav/"]', menu: true, lado: 'right',
        titulo: 'Cierre de Caja',
        texto: 'Aquí empieza el día: abre la caja con el fondo inicial, anota ingresos o retiros y ciérrala contando el efectivo. La app te dice si cuadra.',
    },
    {
        ruta: '/ventas', target: '[data-tour="nav/ventas"]', menu: true, lado: 'right',
        titulo: 'Punto de Venta',
        texto: 'Donde se cobra. Cada venta descuenta stock automáticamente.',
    },
    {
        ruta: '/ventas', target: '[data-tour="pos-buscar"]', lado: 'bottom',
        titulo: 'Escanea o escribe',
        texto: 'Pasa el lector de código de barras o escribe el nombre del producto: se agrega al carrito al instante.',
    },
    {
        ruta: '/ventas', target: '[data-tour="pos-cobrar"]', lado: 'top',
        titulo: 'Cobrar',
        texto: 'Elige efectivo, tarjeta o fiado, aplica descuento si corresponde y finaliza. También puedes generar una cotización en PDF.',
    },
    {
        ruta: '/clientes', target: '[data-tour="nav/clientes"]', menu: true, lado: 'right',
        titulo: 'Clientes',
        texto: 'Ficha de cada cliente con lo que debe, sus abonos y el historial de fiados.',
    },
    {
        ruta: '/pedidos', target: '[data-tour="nav/pedidos"]', menu: true, lado: 'right',
        titulo: 'Pedidos Local',
        texto: 'Encargos de clientes en el mostrador: qué pidió, cuánto abonó y cuánto le falta pagar.',
    },
    {
        ruta: '/pedidos-web', target: '[data-tour="nav/pedidos-web"]', menu: true, lado: 'right',
        titulo: 'Pedidos Web',
        texto: 'Los pedidos que llegan desde la página: prepáralos y márcalos entregados.',
    },
    {
        ruta: '/gastos', target: '[data-tour="nav/gastos"]', menu: true, lado: 'right',
        titulo: 'Gastos',
        texto: 'Arriendo, luz, sueldos… todo lo que sale del local cada mes. Se descuenta de la ganancia en Análisis.',
    },
    {
        ruta: '/productos', target: '[data-tour="nav/productos"]', menu: true, lado: 'right',
        titulo: 'Productos',
        texto: 'Tu inventario: stock, costo, precio e IVA. Filtra por agotados o con poco stock y edita al toque.',
    },
    {
        ruta: '/crear', target: '[data-tour="nav/crear"]', menu: true, lado: 'right',
        titulo: 'Crear Producto',
        texto: 'Alta con foto y código de barras. El precio de venta se calcula solo con un porcentaje sobre el costo.',
    },
    {
        ruta: '/dashboard', target: '[data-tour="nav/dashboard"]', menu: true, lado: 'right',
        titulo: 'Dashboard',
        texto: 'Ventas de hoy, la semana y el mes de un vistazo, con los productos más vendidos.',
    },
    {
        ruta: '/analisis', target: '[data-tour="nav/analisis"]', menu: true, lado: 'right',
        titulo: 'Análisis',
        texto: 'Ganancia real descontando costos y gastos, rotación de productos y capital inmovilizado.',
    },
    {
        ruta: '/historial', target: '[data-tour="nav/historial"]', menu: true, lado: 'right',
        titulo: 'Historial',
        texto: 'Todas las ventas con su detalle, descuento y forma de pago. Desde aquí se anula una venta.',
    },
    {
        ruta: '/configuracion', target: '[data-tour="nav/configuracion"]', menu: true, lado: 'right',
        titulo: 'Configuración',
        texto: 'Nombre, logo, datos de la empresa para las cotizaciones y tema claro u oscuro.',
    },
    {
        target: '[data-tour="buscar"]', menu: true, lado: 'right',
        titulo: 'Buscar en todo (Ctrl+K)',
        texto: 'Desde cualquier vista: escribe una sección o un producto y salta directo.',
    },
    {
        target: '[data-tour="novedades"]', menu: true, lado: 'right',
        titulo: 'Novedades',
        texto: 'Cada actualización queda explicada aquí. Un punto avisa cuando hay algo nuevo, y puedes repetir este recorrido cuando quieras.',
    },
]
