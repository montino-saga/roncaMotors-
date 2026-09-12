# Pendiente: boleta electrónica (SII)

Estado: **no iniciado**. Decidido el 2026-09-12.

## Por qué no es como la cotización
La cotización no es documento tributario: se genera libre con jsPDF (`src/lib/cotizacion.js`).
La boleta es un DTE: **solo vale si la emite/recibe el SII**. Obligatoria para todo
contribuyente de IVA desde 2021 (Ley 21.210); la de papel ya no sirve.

## Qué exige
- Empresa con inicio de actividades en SII.
- Certificado digital (firma electrónica del representante legal: e-cert, Acepta… ~$10–20k/año).
- Folios (CAF) que entrega el SII por rango.
- XML firmado + timbre electrónico (PDF417 en el papel) + envío al SII.
- RCOF diario (resumen de consumo de folios), aunque no haya ventas.
- Libro de ventas / F29 mensual.

## Caminos

| Camino | Costo | Integración con la app | Trabajo |
|---|---|---|---|
| Sistema gratuito SII (portal e-Boleta) | $0 | Ninguna: doble digitación por venta | Bajo |
| **Proveedor con API** (OpenFactura/Haulmer, SimpleAPI, Bsale, LibreDTE cloud) | Por documento o plan mensual (verificar precios vigentes) | `POST` al finalizar venta → folio, PDF con timbre, estado SII. Ellos firman y gestionan CAF/RCOF | 1–2 sesiones |
| Emisor propio (certificación SII, LibreDTE open source) | $0 licencia | Total | Alto: set de pruebas, firma XML, CAF, RCOF, contingencia |

## Decisión sugerida
Proveedor con API. Empezar contra el **sandbox** (OpenFactura o SimpleAPI) antes de pagar.

## Plan cuando se retome
1. Trámites (los hace el representante con ClaveÚnica, no la app): certificado digital, alta como emisor electrónico en SII, cuenta en el proveedor.
2. `src/lib/boleta.js`: mapear doc `sales` → JSON del proveedor (ítems, cantidad, precio, afecto/exento con `lib/iva`, descuentos con `lib/descuentos`, RUT cliente opcional).
3. En `Sales.jsx` al finalizar venta: emitir → guardar en el doc `sales` `{ folio, urlPdf, estadoSII, timbre }`. Si falla la red, marcar `pendienteEmision` y reintentar desde Historial.
4. Térmica ESC/POS (`lib/printer.js`): imprimir timbre PDF417 + folio.
5. Historial: columna folio, botón "Reimprimir / Ver PDF", reintento de emisión.
6. Configuración: credenciales del proveedor (API key) → **no** en Firestore en claro; usar Cloud Function o secreto del proveedor con dominio restringido.
7. Tests: mapeo venta → JSON (puro), estados de emisión, reintento.

## Datos que ya existen en la app y sirven
- `settings/global`: nombre, RUT, giro, dirección (Configuración → Datos de la empresa).
- Venta completa con IVA/exentos, descuentos, cliente.
- Impresora térmica conectada por Web Serial.
