# Schema de la base de datos — Roncamotors

Base: **Cloud Firestore** (proyecto `base-de-prueba-cee39`), modo documento/colección.
Este schema fue extraído del código fuente (todas las lecturas/escrituras en `src/`), ya que Firestore no tiene esquema fijo.

Fecha de generación: 2026-08-21

## Diagrama general

```
productos/{id}                  ← catálogo e inventario
clients/{id}                    ← clientes (fiado)
  └─ movements/{id}             ← historial de compras/abonos del cliente
sales/{id}                      ← ventas del POS (incluye fiados y abonos)
salesWeb/{id}                   ← pedidos de la landing pública
cash_registers/{id}             ← sesiones de caja (apertura/cierre)
settings/global                 ← configuración visual del negocio (doc único)

Storage: productos/{timestamp}-{nombreArchivo}   ← imágenes de productos
```

---

## Colección `productos`

Catálogo e inventario. Escriben: CreateProducts, EditProduct; el stock lo descuentan/restauran Sales, SalesHistory y ClientDetails.

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
| `totalVenta` | number | Total de la venta (CLP) |
| `totalGanancia` | number | Ganancia total (venta − costo); `0` en abonos |
| `idCliente` | string? | Solo en fiados y abonos: ID del doc en `clients` |
| `nombreCliente` | string? | Solo en fiados y abonos: nombre denormalizado del cliente |
| `isFiado` | boolean? | `true` solo en ventas fiadas |
| `isAbono` | boolean? | `true` solo cuando el registro es un abono de deuda |

Estructura de cada ítem en `productos[]`:

| Campo | Tipo | Descripción |
|---|---|---|
| `idProducto` | string | Código de negocio del producto (`'ABONO'` en abonos) |
| `nombreProducto` | string | Nombre (denormalizado al momento de la venta) |
| `marcaProducto` | string | Marca (`''` si no tiene) |
| `categoriaProducto` | string | Categoría (`''` si no tiene) |
| `precioVentaLocal` | number | Precio unitario cobrado |
| `precioVentaWeb` | number | Precio web al momento de la venta |
| `precioProducto` | number | Legacy, igual a `precioVentaLocal` |
| `precioOriginal` | number | Costo unitario al momento de la venta |
| `cantidadProducto` | number | Stock que tenía el producto al venderse |
| `cantidad` | number | Unidades vendidas de este ítem |
| `esAbono` | boolean? | `true` solo en el ítem sintético de un abono |

> Los precios y nombres se **denormalizan** (se copian a la venta), así el historial no cambia si después editas el producto.

---

## Colección `clients`

Clientes con cuenta de fiado. Crea: Clients. Actualizan deuda: Sales, ClientDetails.

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre del cliente |
| `phone` | string | Teléfono (puede ser `''`) |
| `currentDebt` | number | Deuda actual (CLP). Sube con compras fiadas, baja con abonos/devoluciones |
| `createdAt` | Timestamp | Fecha de creación |
| `lastUpdated` | Timestamp | Última modificación de la deuda |

### Subcolección `clients/{id}/movements`

Historial de movimientos del cliente. Cada movimiento fiado/abono queda **enlazado** a su venta en `sales` vía `saleId`.

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | string | `'purchase'` (compra fiada) \| `'payment'` (abono) |
| `amount` | number | Monto del movimiento (CLP) |
| `date` | Timestamp | Fecha del movimiento |
| `saleId` | string | ID del documento espejo en `sales` |
| `products` | array\<map>? | Solo en `purchase`: `{ idProducto, nombreProducto, cantidad, precio }` |
| `paymentMethod` | string? | Solo en `payment`: `'efectivo'` \| `'tarjeta'` |
| `note` | string? | Solo en `payment`: nota, ej. `"Abono (efectivo)"` |

> Al eliminar un cliente se borran sus `movements` cargados en pantalla, pero Firestore **no borra subcolecciones automáticamente** — pueden quedar movimientos huérfanos si eran muchos.

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
| `userId` | string | **Hardcodeado** como `'current_user'` |
| `movements` | array\<map> | Ingresos/egresos manuales: `{ type: 'income'\|'expense', amount: number, description: string, time: Timestamp }` |

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

## Colección `settings`

Un solo documento: `settings/global`. Lo lee ThemeContext con listener en tiempo real. (No hay pantalla en la app que lo escriba; se edita desde la consola.)

| Campo | Tipo | Descripción |
|---|---|---|
| `businessName` | string | Nombre mostrado en el panel (default en código: `'Roncamotors'`) |
| `primaryColor` | string | Color primario hex, ej. `'#3b82f6'` (se aplica como CSS variable) |
| `logo` | string | URL del logo (puede ser `''`) |

---

## Firebase Storage

| Ruta | Contenido |
|---|---|
| `productos/{Date.now()}-{nombreArchivo}` | Imágenes de productos, subidas comprimidas (máx. 5 MB, solo `image/*` según reglas). La URL de descarga se guarda en `productos.imagenProducto` |

---

## Relaciones y observaciones

- `sales.idCliente` → doc de `clients`; `movements.saleId` → doc de `sales` (relación espejo: cada fiado/abono existe en ambos lados y el código los mantiene sincronizados manualmente al editar/eliminar).
- Las búsquedas de productos desde ventas/devoluciones se hacen por `sales.productos[].idProducto` → `productos.idProducto` (campo de negocio, no el ID del documento).
- **Denormalización intencional**: nombre/precios del producto y nombre del cliente se copian dentro de la venta para que el historial sea inmutable.
- `precioProducto` es redundante (siempre = `precioVentaLocal`); se mantiene por compatibilidad. Si algún día lo eliminas, revisa `getLocalPrice()` que hace fallback a él.
- `sales.idUsuario` y `cash_registers.userId` están hardcodeados; si algún día hay multiusuario, deberían tomar `auth.currentUser.uid`.
- No hay índices compuestos declarados en el repo (no existe `firestore.indexes.json`); las consultas actuales usan índices simples automáticos, salvo Dashboard (`fechaVenta` con rango + orderBy, que usa índice simple del mismo campo).
