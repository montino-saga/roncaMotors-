# Schema de la base de datos — Roncamotors

Base: **Cloud Firestore**, modo documento/colección. Proyectos (`.firebaserc`): `roncamotors-58fd3` (default, producción), `base-de-prueba-cee39` (prueba), `local-js-d7712` (viejo). La app toma el proyecto de `VITE_FIREBASE_PROJECT_ID`.
Este schema fue extraído del código fuente (todas las lecturas/escrituras en `src/` y `functions/`), ya que Firestore no tiene esquema fijo.

Última actualización: 2026-11-13

## Diagrama general

```
productos/{id}                  ← catálogo e inventario
clients/{id}                    ← clientes (fiado, RUT, patente, vehículo)
  └─ movements/{id}             ← historial de compras/abonos del cliente
sales/{id}                      ← ventas del POS (incluye fiados y abonos)
salesWeb/{id}                   ← pedidos de la landing pública
pedidos/{id}                    ← pedidos/encargos del local (cliente, productos, abonos)
cash_registers/{id}             ← sesiones de caja (apertura/cierre)
gastos/{id}                     ← gastos del local
gastosRecurrentes/{id}          ← plantillas de gastos fijos (se registran solos cada mes)
usuarios/{uid}                  ← perfil y rol de cada cuenta de Auth
vehiculos/{patente}             ← caché de consultas de patente (DESACTIVADA, sin escrituras)
settings/global                 ← configuración y datos de la empresa (doc único)

Storage: productos/{timestamp}-{nombreArchivo}   ← imágenes de productos
```

---

## Colección `productos`

Catálogo e inventario. Escriben: CreateProducts, EditProduct, ProductList (restaurar tras borrar con Deshacer); el stock lo descuentan/restauran Sales, SalesHistory y ClientDetails con `increment()`.

| Campo | Tipo | Descripción |
|---|---|---|
| `idProducto` | string | Código propio / código de barras. **Único a nivel de app** (se valida antes de crear; se usa para buscar con `where('idProducto','==',...)`) |
| `nombreProducto` | string | Nombre del producto |
| `marcaProducto` | string | Marca |
| `categoriaProducto` | string | Categoría |
| `precioVentaLocal` | number | Precio de venta en el local (CLP) |
| `precioVentaWeb` | number | Precio de venta web (CLP) |
| `precioOriginal` | number | Costo de compra (se usa para calcular ganancia) |
| `precioProducto` | number | **Legacy**: siempre se guarda igual a `precioVentaLocal` (compatibilidad con código antiguo) |
| `cantidadProducto` | number | Stock actual. Se descuenta al vender y se restaura al devolver/eliminar ventas |
| `imagenProducto` | string | URL de descarga de la imagen en Storage (puede ser `''`) |
| `afectoIva` | boolean | `true` (por defecto) si `precioVentaLocal`/`precioVentaWeb` incluyen IVA 19%; `false` si el producto está exento. Los precios guardados son SIEMPRE el monto final que paga el cliente; el neto se deriva dividiendo entre 1,19. Productos anteriores a este campo se tratan como afectos |

> Nota: el ID del documento es autogenerado por Firestore; `idProducto` es el identificador de negocio y las demás pantallas buscan por ese campo.

---

## Colección `sales`

Ventas del punto de venta. Crea: Sales (venta normal y fiado) y ClientDetails (abonos). Editan/eliminan: SalesHistory y ClientDetails.

| Campo | Tipo | Descripción |
|---|---|---|
| `fechaVenta` | Timestamp | Fecha/hora de la venta |
| `idUsuario` | string | UID del vendedor. **Hardcodeado** en el código (`rSgG4AQYn5OU5hvLGfuLTCpnCWS2`); en abonos no se incluye |
| `productos` | array\<map> | Ítems vendidos (ver estructura abajo) |
| `tipoPago` | string | `'efectivo'` \| `'tarjeta'` \| `'fiado'` |
| `subtotal` | number | Suma de ítems a precio cobrado, antes del descuento al total. No existe en abonos ni en ventas antiguas |
| `descuentoTotal` | number | Descuento al total de la venta, en CLP (no %). `0` si no hubo. No existe en abonos ni en ventas antiguas |
| `totalVenta` | number | Total cobrado (CLP) = `subtotal − descuentoTotal` |
| `totalGanancia` | number | Ganancia total (venta − costo, ya descontado el descuento); `0` en abonos |
| `idCliente` | string? | Solo en fiados y abonos: ID del doc en `clients` |
| `nombreCliente` | string? | Solo en fiados y abonos: nombre denormalizado del cliente |
| `isFiado` | boolean? | `true` en ventas fiadas. Al cambiar el método de pago desde el historial se reescribe (`false` si deja de ser fiado) |
| `isAbono` | boolean? | `true` solo cuando el registro es un abono de deuda |

Estructura de cada ítem en `productos[]`:

| Campo | Tipo | Descripción |
|---|---|---|
| `idProducto` | string | Código de negocio del producto (`'ABONO'` en abonos) |
| `docProducto` | string? | ID del documento en `productos`. Solo ventas nuevas (no existe en antiguas ni en abonos). Devolver/eliminar restaura stock por este id; sin él, por `idProducto` (con códigos repetidos podía ir a otro producto) |
| `nombreProducto` | string | Nombre (denormalizado al momento de la venta) |
| `marcaProducto` | string | Marca (`''` si no tiene) |
| `categoriaProducto` | string | Categoría (`''` si no tiene) |
| `precioVentaLocal` | number | Precio unitario **cobrado** (con descuento por ítem si lo hubo) |
| `precioLista` | number | Precio unitario de lista antes del descuento por ítem. No existe en abonos ni en ventas antiguas |
| `descuento` | number | Descuento unitario en CLP = `precioLista − precioVentaLocal`. No existe en abonos ni en ventas antiguas |
| `precioVentaWeb` | number | Precio web al momento de la venta |
| `precioProducto` | number | Legacy, igual a `precioVentaLocal` |
| `precioOriginal` | number | Costo unitario al momento de la venta |
| `cantidadProducto` | number | Stock que tenía el producto al venderse |
| `cantidad` | number | Unidades vendidas de este ítem |
| `esAbono` | boolean? | `true` solo en el ítem sintético de un abono |

> Los precios y nombres se **denormalizan** (se copian a la venta), así el historial no cambia si después editas el producto.
> Al devolver un producto (desde el historial o la ficha del cliente) se recalculan `productos`, `subtotal`, `descuentoTotal` (**proporcional** al nuevo subtotal, `descuentoProporcional` en `src/lib/descuentos.js`), `totalVenta` y `totalGanancia`. Si no quedan productos, la venta se elimina.
> El POS no deja cobrar sin una sesión `cash_registers` abierta (`useCajaAbierta`): una venta en efectivo con la caja cerrada no entraba en ningún cierre.

---

## Colección `clients`

Clientes. Crea: Clients. Editan datos: ClientDetails (ClienteForm y VehiculoForm). Actualizan deuda: Sales, ClientDetails, SalesHistory.

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre del cliente |
| `phone` | string | Teléfono (puede ser `''`) |
| `email` | string | Email (puede ser `''`). No existe en clientes antiguos |
| `rut` | string | RUT formateado (`12.345.678-9`) o `''`. Se valida antes de guardar. No existe en clientes antiguos |
| `patente` | string | Patente formateada con guion (`ABCD-12`, `AB-1234`) o `''`. Se valida antes de guardar. No existe en clientes antiguos |
| `vehiculo` | map \| null? | Datos del vehículo, solo los campos con valor; `null` si se borraron todos (ver abajo) |
| `currentDebt` | number | Deuda actual (CLP). Sube con compras fiadas, baja con abonos/devoluciones. Un abono no puede superarla (validado en la ficha). Negativo = saldo a favor (solo por devoluciones o datos antiguos); los totales de deuda suman solo positivos |
| `createdAt` | Timestamp | Fecha de creación |
| `lastUpdated` | Timestamp? | Última modificación de la deuda (no existe hasta el primer movimiento) |

Campos de `vehiculo` (todos **string**, incluso `anio` y `kilometraje`; hoy se rellenan solo a mano; `consultarPatente` está desactivada):

`marca`, `modelo`, `anio`, `tipo`, `color`, `combustible`, `transmision`, `kilometraje`, `vin`, `motor`

### Subcolección `clients/{id}/movements`

Historial de movimientos del cliente. Cada movimiento fiado/abono queda **enlazado** a su venta en `sales` vía `saleId`.

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | string | `'purchase'` (compra fiada) \| `'payment'` (abono) |
| `amount` | number | Monto del movimiento (CLP) |
| `date` | Timestamp | Fecha del movimiento |
| `saleId` | string | ID del documento espejo en `sales` |
| `products` | array\<map>? | Solo en `purchase`: `{ idProducto, docProducto?, nombreProducto, cantidad, precio }` (`precio` = precio unitario cobrado). Una devolución parcial reescribe `products`, `amount` y `descuentoTotal` (antes quedaban iguales) |
| `descuentoTotal` | number? | Solo en `purchase`: descuento al total de la venta en CLP |
| `paymentMethod` | string? | Solo en `payment`: `'efectivo'` \| `'tarjeta'` |
| `note` | string? | Solo en `payment`: nota, ej. `"Abono (efectivo)"` |

> Al eliminar un cliente se borran sus `movements` cargados en pantalla, pero Firestore **no borra subcolecciones automáticamente** — pueden quedar movimientos huérfanos si eran muchos. Las ventas del cliente borrado siguen existiendo; el historial lo tolera.

---

## Colección `salesWeb`

Pedidos creados por la **landing pública** (usuarios sin cuenta). El panel solo los lee (WebOrders). La estructura exacta la define la landing; el panel espera:

| Campo | Tipo | Descripción |
|---|---|---|
| `fechaVenta` | Timestamp | Fecha del pedido |
| `estado` | string | `'pendiente'` (por defecto) \| `'completado'`. Las reglas solo permiten crear como `'pendiente'` |
| `tipoPago` | string | Método de pago elegido, ej. `'efectivo'` |
| `totalVenta` | number | Total del pedido |
| `cliente` | map? | `{ nombre: string, email: string, telefono?: string }` |
| `productos` | array\<map> | Ítems: `{ nombreProducto, cantidad, precioVentaLocal o precioProducto, ... }` (1–100 ítems según reglas) |

---

## Colección `pedidos`

Pedidos del local: encargos que un cliente hace en el mostrador (repuestos por traer, trabajos), con abono y saldo. Crea: Pedidos → NuevoPedido. Abonar, entregar, cancelar, reabrir y eliminar: DetallePedido. Se escucha con `onSnapshot` ordenado por `creadoEn desc`. **No mueve** stock, caja, ventas ni la deuda de fiado del cliente (`clients.currentDebt`): es un registro aparte.

| Campo | Tipo | Descripción |
|---|---|---|
| `clienteId` | string | ID del doc en `clients` |
| `nombreCliente` | string | Nombre denormalizado al crear |
| `descripcion` | string | Texto libre, máx. 300 caracteres (puede ser `''`) |
| `productos` | array\<map> | `{ idProducto: string \| null, nombreProducto, cantidad, precio }`. `idProducto: null` = ítem fuera del catálogo. `precio` = unitario acordado (parte en `precioVentaLocal`, editable) |
| `total` | number | Suma de `cantidad × precio` (CLP) |
| `abonado` | number | Suma de `abonos[].monto`. Saldo (lo que debe) = `total − abonado`, se calcula, no se guarda |
| `abonos` | array\<map> | `{ monto: number, metodo: 'efectivo' \| 'tarjeta' \| 'transferencia', fecha: Timestamp }`. Se reescribe el array completo al abonar |
| `estado` | string | `'pendiente'` → `'entregado'` \| `'cancelado'` (se puede volver a `'pendiente'`) |
| `creadoEn` | Timestamp | Fecha del pedido |
| `entregadoEn` | Timestamp? | Al marcar entregado |
| `userId` | string \| null | UID de quien lo creó |

> Un abono no puede superar el saldo (validado en la UI). KPIs de la vista: solo pedidos `pendiente`.

---

## Colección `cash_registers`

Sesiones de caja (una abierta a la vez: se busca `where('status','==','open')`). Crea/actualiza: CashClose.

Campos al **abrir**:

| Campo | Tipo | Descripción |
|---|---|---|
| `openingTime` | Timestamp | Apertura de la sesión |
| `status` | string | `'open'` → `'closed'` |
| `openingBalance` | number | Efectivo inicial en caja |
| `userId` | string \| null | UID de quien abrió la caja. Sesiones antiguas tienen `'current_user'` |
| `movements` | array\<map> | Ingresos/egresos manuales: `{ type: 'income'\|'expense', amount: number, description: string, time: Timestamp }`. Se reescribe el array completo al agregar o borrar uno |

Campos agregados al **cerrar**:

| Campo | Tipo | Descripción |
|---|---|---|
| `closingTime` | Timestamp | Cierre de la sesión |
| `closingBalance` | number | Efectivo real contado |
| `expectedBalance` | number | `openingBalance + cashSales + totalIncomes − totalExpenses` |
| `cashSales` | number | Ventas en efectivo del período (calculado desde `sales`) |
| `totalIncomes` | number | Suma de movimientos `income` |
| `totalExpenses` | number | Suma de movimientos `expense` |
| `difference` | number | `closingBalance − expectedBalance` (descuadre) |

---

## Colección `gastos`

Gastos del local (publicidad, arriendo, etc.). Crea/edita/elimina: Gastos; también los crea `generarGastosFijos` cada mes a partir de `gastosRecurrentes`. Se consulta por rango de `fecha` (mes visible + anterior) con `orderBy('fecha','desc')`.

| Campo | Tipo | Descripción |
|---|---|---|
| `fecha` | Timestamp | Día del gasto (guardado a las 12:00 locales para no cambiar de día por zona horaria) |
| `monto` | number | Monto en CLP (> 0) |
| `categoria` | string | `'publicidad'` \| `'arriendo'` \| `'suscripciones'` \| `'servicios'` \| `'arreglos'` \| `'sueldos'` \| `'insumos'` \| `'transporte'` \| `'impuestos'` \| `'otro'` (ver `src/lib/gastos.js`) |
| `descripcion` | string | Texto libre, máx. 140 caracteres (puede ser `''`) |
| `creadoEn` | Timestamp | Fecha de registro |
| `userId` | string \| null | UID de quien lo registró |
| `recurrenteId` | string? | Solo en gastos fijos: ID de la plantilla en `gastosRecurrentes` (tanto el gasto con que se marcó como fijo como los generados cada mes) |
| `pagado` | boolean? | `false` solo en gastos fijos generados automáticamente, hasta que se marcan pagados (pasa a `true`). Sin el campo = pagado (todos los gastos manuales). Suman al total del mes igual |

---

## Colección `gastosRecurrentes`

Gastos fijos (suscripciones, arriendo, internet…). Se crean marcando **"Gasto fijo"** al registrar o editar un gasto en Gastos: la plantilla copia sus datos. Al abrir la app (Layout y vista Gastos, `asegurarGastosFijos` en `src/lib/gastosFijos.js`, una vez por mes y sesión, solo roles que escriben) se crea en `gastos` un gasto **por pagar** por cada mes faltante desde `ultimoMes` hasta el actual (tope 12), con fecha = día de pago de ese mes. Una transacción sobre la plantilla evita duplicados entre pestañas/equipos.

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | string | Descripción del gasto (o el nombre de la categoría si iba vacía). Se copia a `gastos.descripcion` |
| `monto` | number | Monto en CLP (> 0) que se registra cada mes |
| `dia` | number | Día de pago, 1–31 (el día del gasto original). En meses más cortos cae el último día |
| `categoria` | string | Misma lista que `gastos.categoria` |
| `activo` | boolean | `true` mientras esté marcado como fijo. Desmarcar el check al editar un gasto suyo lo pasa a `false` (deja de generarse; los gastos ya creados quedan) |
| `ultimoMes` | string | `'YYYY-MM'` del último mes registrado. Al crear: el mayor entre el mes del gasto y el actual, así parte el mes siguiente |
| `creadoEn` | Timestamp | Fecha de registro |
| `userId` | string \| null | UID de quien lo creó |

> Editar un gasto fijo con el check marcado actualiza también la plantilla (`nombre`, `monto`, `categoria`, `dia`): los meses siguientes usan los datos nuevos. Borrar un gasto generado no lo vuelve a crear (`ultimoMes` ya avanzó).

---

## Colección `usuarios`

Perfil y rol de cada cuenta de Firebase Auth. **ID del doc = `uid` de Auth.** Dos formas de alta:
- **Invitación** (vista Usuarios, solo desarrollador): la Cloud Function `crearUsuario` crea la cuenta en Auth **sin contraseña** y este doc con el rol elegido; luego el cliente llama `sendPasswordResetEmail` y ese correo hace de invitación para crear la contraseña.
- **Cuenta creada a mano en Auth**: el doc se crea al primer inicio de sesión (`registrarAcceso` en `src/lib/usuarios.js`) con rol `admin`.

Lee/edita el rol: Usuarios. AuthContext escucha el doc propio y expone `perfil`.

| Campo | Tipo | Descripción |
|---|---|---|
| `email` | string | Email de la cuenta (se refresca en cada acceso) |
| `nombre` | string | Nombre dado al invitar, o `displayName` de Auth al primer acceso (puede ser `''`) |
| `rol` | string | `'desarrollador'` \| `'admin'` \| `'lector'`. Inicial: `'admin'`. Un valor desconocido se trata como `'admin'` |
| `creadoEn` | Timestamp | Fecha de invitación o del primer acceso |
| `ultimoAcceso` | Timestamp? | Último inicio de sesión / recarga con sesión abierta. **No existe** mientras la invitación está pendiente (la vista muestra "Invitación pendiente" y permite reenviar) |
| `invitadoPor` | string? | `uid` del desarrollador que invitó. Solo en cuentas creadas por invitación |

> Permisos: `desarrollador` y `admin` tienen acceso total; la única diferencia es que solo `desarrollador` ve y gestiona `usuarios` (vista `/usuarios`, ítem del sidebar y rules). `lector` ve todas las vistas (salvo Usuarios) pero no crea, edita ni borra nada: solo puede registrar su propio acceso en `usuarios/{uid}`.
> Nadie puede cambiar su propio rol ni darse de alta como algo distinto de `admin`. El primer `desarrollador` se asigna a mano desde la consola de Firebase.

---

## Colección `vehiculos`

> **Desactivada**: `consultarPatente` está comentada en `functions/index.js` (no hay API key de Boostr). La colección y su regla se mantienen para reactivarla.

Caché de la Cloud Function `consultarPatente` (proveedor Boostr). **ID del doc = patente sin guion en mayúsculas** (`ABCD12`). Solo la escribe la función (Admin SDK); el panel tiene lectura. Vigencia: 180 días desde `consultadoEn`.

| Campo | Tipo | Descripción |
|---|---|---|
| `marca` | string | `make` del proveedor |
| `modelo` | string | `model` |
| `anio` | number \| string | `year` (tal como lo devuelve el proveedor) |
| `tipo` | string | `type` |
| `motor` | string | `engine` |
| `consultadoEn` | Timestamp | Fecha de la consulta al proveedor |

> No se guardan datos del dueño del vehículo.

---

## Colección `settings`

Un solo documento: `settings/global`. Lo lee ThemeContext con listener en tiempo real; lo escribe Configuración → Datos de la empresa (`setDoc` con `merge`). Los campos vacíos caen en los valores por defecto del código.

| Campo | Tipo | Descripción |
|---|---|---|
| `businessName` | string | Nombre mostrado en el panel y la cotización (default: `'Roncamotors'`) |
| `primaryColor` | string | Color primario hex (default `'#3b82f6'`, se aplica como CSS variable). Sin pantalla: se edita desde la consola |
| `logo` | string | Logo como **data URL** JPEG (~20–40 KB), no URL de Storage: jsPDF lo necesita sin CORS. `''` usa el logo local |
| `giro` | string | Giro comercial (default `'Repuestos y accesorios'`) |
| `rut` | string | RUT de la empresa formateado, o `''` |
| `direccion` | string | Dirección |
| `telefono` | string | Teléfono |
| `email` | string | Email de contacto |
| `web` | string | Sitio web |
| `validezDias` | number | Días de validez de la cotización (mín. 1, default 15) |
| `piePagina` | string | Texto al pie de la cotización PDF |

---

## Firebase Storage

| Ruta | Contenido |
|---|---|
| `productos/{Date.now()}-{nombreArchivo}` | Imágenes de productos, subidas comprimidas (máx. 5 MB, solo `image/*` según reglas). La URL de descarga se guarda en `productos.imagenProducto`. Lectura pública; subir: con sesión y no `lector` (`storage.rules` lee el rol desde Firestore) |

---

## Reglas (`firestore.rules`)

| Ruta | Lectura | Escritura |
|---|---|---|
| `productos`, `clients` (+`movements`), `sales`, `cash_registers`, `gastos`, `gastosRecurrentes`, `pedidos`, `settings` | con sesión | con sesión y no `lector` |
| `usuarios/{uid}` | el propio doc; todos si es `desarrollador` | `create`: solo el propio, con `rol: 'admin'`. `update`: el propio sin tocar `rol`, u otro si es `desarrollador`. `delete`: `desarrollador`, no a sí mismo |
| `vehiculos` | con sesión | nadie (solo Admin SDK) |
| `salesWeb` | con sesión | `create`: público con validación (`pedidoWebValido`); `update`/`delete`: con sesión y no `lector` |
| resto | nadie | nadie |

"Con sesión" = `request.auth != null`. `desarrollador` = con sesión y `usuarios/{request.auth.uid}.rol == 'desarrollador'` (`esDesarrollador()`). "No `lector`" = con sesión y el rol no es `'lector'`; sin doc de perfil cuenta como admin (`puedeEscribir()`). Ambas son espejo de las funciones homónimas en `src/lib/usuarios.js`. No hay whitelist: el registro público de Auth debe estar deshabilitado en la consola. Las rules del repo **no se aplican hasta** `firebase deploy --only firestore:rules`.

---

## Relaciones y observaciones

- `pedidos.clienteId` → doc de `clients` (nombre denormalizado; si se borra el cliente, el pedido queda con su nombre).
- `sales.idCliente` → doc de `clients`; `movements.saleId` → doc de `sales` (relación espejo: cada fiado/abono existe en ambos lados y el código los mantiene sincronizados manualmente al editar/eliminar o cambiar el método de pago).
- `usuarios/{uid}` ↔ cuenta de Firebase Auth con el mismo `uid`. `usuarios.invitadoPor` → otro `usuarios/{uid}`. `gastos.userId`, `gastosRecurrentes.userId` y `cash_registers.userId` apuntan a ese `uid`.
- `gastos.recurrenteId` → doc de `gastosRecurrentes`. Si se borra la plantilla a mano desde la consola, sus gastos quedan con un `recurrenteId` huérfano (se muestran normal; al editarlos el check sale desmarcado).
- `vehiculos/{patente}` ↔ `clients.patente` sin guion. La ficha copia los datos a `clients.vehiculo`; la caché no se vuelve a leer después.
- Las búsquedas de productos desde ventas/devoluciones se hacen por `sales.productos[].idProducto` → `productos.idProducto` (campo de negocio, no el ID del documento).
- **Denormalización intencional**: nombre/precios del producto y nombre del cliente se copian dentro de la venta para que el historial sea inmutable.
- `precioProducto` es redundante (siempre = `precioVentaLocal`); se mantiene por compatibilidad. Si algún día lo eliminas, revisa `precioLista()` en `src/lib/descuentos.js`, que hace fallback a él.
- `sales.idUsuario` sigue hardcodeado; debería tomar `auth.currentUser.uid`.
- No hay índices compuestos declarados en el repo (no existe `firestore.indexes.json`); las consultas actuales usan índices simples automáticos.
