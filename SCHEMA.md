# Schema de la base de datos — Roncamotors

Base: **Cloud Firestore**, modo documento/colección. Proyectos (`.firebaserc`): `roncamotors-58fd3` (default, producción), `base-de-prueba-cee39` (prueba), `local-js-d7712` (viejo). La app toma el proyecto de `VITE_FIREBASE_PROJECT_ID`.
Este schema fue extraído del código fuente (todas las lecturas/escrituras en `src/` y `functions/`), ya que Firestore no tiene esquema fijo.

Última actualización: 2026-10-03

## Diagrama general

```
productos/{id}                  ← catálogo e inventario
clients/{id}                    ← clientes (fiado, RUT, patente, vehículo)
  └─ movements/{id}             ← historial de compras/abonos del cliente
sales/{id}                      ← ventas del POS (incluye fiados y abonos)
salesWeb/{id}                   ← pedidos de la landing pública
cash_registers/{id}             ← sesiones de caja (apertura/cierre)
gastos/{id}                     ← gastos del local
usuarios/{uid}                  ← perfil y rol de cada cuenta de Auth
vehiculos/{patente}             ← caché de consultas de patente (solo Cloud Function)
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
> Al devolver un producto desde el historial se recalculan `productos`, `subtotal`, `descuentoTotal` (recortado si supera el nuevo subtotal), `totalVenta` y `totalGanancia`.

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
| `currentDebt` | number | Deuda actual (CLP). Sube con compras fiadas, baja con abonos/devoluciones |
| `createdAt` | Timestamp | Fecha de creación |
| `lastUpdated` | Timestamp? | Última modificación de la deuda (no existe hasta el primer movimiento) |

Campos de `vehiculo` (todos **string**, incluso `anio` y `kilometraje`; se rellenan a mano o desde `consultarPatente`):

`marca`, `modelo`, `anio`, `tipo`, `color`, `combustible`, `transmision`, `kilometraje`, `vin`, `motor`

### Subcolección `clients/{id}/movements`

Historial de movimientos del cliente. Cada movimiento fiado/abono queda **enlazado** a su venta en `sales` vía `saleId`.

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | string | `'purchase'` (compra fiada) \| `'payment'` (abono) |
| `amount` | number | Monto del movimiento (CLP) |
| `date` | Timestamp | Fecha del movimiento |
| `saleId` | string | ID del documento espejo en `sales` |
| `products` | array\<map>? | Solo en `purchase`: `{ idProducto, nombreProducto, cantidad, precio }` (`precio` = precio unitario cobrado) |
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

Gastos del local (publicidad, arriendo, etc.). Crea/edita/elimina: Gastos. Se consulta por rango de `fecha` (mes visible + anterior) con `orderBy('fecha','desc')`.

| Campo | Tipo | Descripción |
|---|---|---|
| `fecha` | Timestamp | Día del gasto (guardado a las 12:00 locales para no cambiar de día por zona horaria) |
| `monto` | number | Monto en CLP (> 0) |
| `categoria` | string | `'publicidad'` \| `'arriendo'` \| `'servicios'` \| `'arreglos'` \| `'sueldos'` \| `'insumos'` \| `'transporte'` \| `'impuestos'` \| `'otro'` (ver `src/lib/gastos.js`) |
| `descripcion` | string | Texto libre, máx. 140 caracteres (puede ser `''`) |
| `creadoEn` | Timestamp | Fecha de registro |
| `userId` | string \| null | UID de quien lo registró |

---

## Colección `usuarios`

Perfil y rol de cada cuenta de Firebase Auth. **ID del doc = `uid` de Auth.** Las cuentas se crean a mano en Auth; el doc se crea solo al iniciar sesión por primera vez (`registrarAcceso` en `src/lib/usuarios.js`). Lee/edita el rol: Usuarios. AuthContext escucha el doc propio y expone `perfil`.

| Campo | Tipo | Descripción |
|---|---|---|
| `email` | string | Email de la cuenta (se refresca en cada acceso) |
| `nombre` | string | `displayName` de Auth al crearse (normalmente `''`) |
| `rol` | string | `'desarrollador'` \| `'admin'` \| `'lector'`. Inicial: `'admin'`. Un valor desconocido se trata como `'admin'` |
| `creadoEn` | Timestamp | Primer acceso registrado |
| `ultimoAcceso` | Timestamp | Último inicio de sesión / recarga con sesión abierta |

> Los roles **aún no restringen nada**: ni la UI ni las rules los aplican.

---

## Colección `vehiculos`

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
| `productos/{Date.now()}-{nombreArchivo}` | Imágenes de productos, subidas comprimidas (máx. 5 MB, solo `image/*` según reglas). La URL de descarga se guarda en `productos.imagenProducto` |

---

## Reglas (`firestore.rules`)

| Ruta | Lectura | Escritura |
|---|---|---|
| `productos`, `clients` (+`movements`), `sales`, `cash_registers`, `gastos`, `usuarios`, `settings` | con sesión | con sesión |
| `vehiculos` | con sesión | nadie (solo Admin SDK) |
| `salesWeb` | con sesión | `create`: público con validación (`pedidoWebValido`); `update`/`delete`: con sesión |
| resto | nadie | nadie |

"Con sesión" = `request.auth != null`. No hay whitelist: el registro público de Auth debe estar deshabilitado en la consola. Las rules del repo **no se aplican hasta** `firebase deploy --only firestore:rules`.

---

## Relaciones y observaciones

- `sales.idCliente` → doc de `clients`; `movements.saleId` → doc de `sales` (relación espejo: cada fiado/abono existe en ambos lados y el código los mantiene sincronizados manualmente al editar/eliminar o cambiar el método de pago).
- `usuarios/{uid}` ↔ cuenta de Firebase Auth con el mismo `uid`. `gastos.userId` y `cash_registers.userId` apuntan a ese `uid`.
- `vehiculos/{patente}` ↔ `clients.patente` sin guion. La ficha copia los datos a `clients.vehiculo`; la caché no se vuelve a leer después.
- Las búsquedas de productos desde ventas/devoluciones se hacen por `sales.productos[].idProducto` → `productos.idProducto` (campo de negocio, no el ID del documento).
- **Denormalización intencional**: nombre/precios del producto y nombre del cliente se copian dentro de la venta para que el historial sea inmutable.
- `precioProducto` es redundante (siempre = `precioVentaLocal`); se mantiene por compatibilidad. Si algún día lo eliminas, revisa `precioLista()` en `src/lib/descuentos.js`, que hace fallback a él.
- `sales.idUsuario` sigue hardcodeado; debería tomar `auth.currentUser.uid` cuando los roles se apliquen.
- No hay índices compuestos declarados en el repo (no existe `firestore.indexes.json`); las consultas actuales usan índices simples automáticos.
