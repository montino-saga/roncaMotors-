# montinoApp — Roncamotors

Panel de taller/tienda (POS, inventario, clientes con fiado, caja, gastos, reportes). React + Vite + Firebase (Firestore, Auth, Storage, Functions). Tests: Vitest.

## Trato
- Dirígete al usuario **siempre** como **Peter Parker**.
- Directo y resumido. Sin relleno, sin repetir lo obvio.

## Antes de codear
1. Leer `SCHEMA.md` completo (colecciones, campos, rules, relaciones).
2. Leer `firestore.rules` si el cambio toca datos o permisos.
3. Leer solo los entry points necesarios:
   - `src/App.jsx` — rutas
   - `src/components/Layout.jsx` — sidebar (`navSections`)
   - `src/context/AuthContext.jsx` — sesión + `perfil` (rol)
   - `src/lib/usuarios.js` — roles
   - `src/db/firebase.js` — init Firebase
   - `functions/index.js` — Cloud Function `consultarPatente`

## Regla obligatoria: mantener docs al día
Todo cambio que toque datos o permisos actualiza, **en el mismo cambio**:
- `SCHEMA.md`: colección/campo/valor nuevo o cambiado, tabla de Reglas, relaciones y fecha "Última actualización".
- `CLAUDE.md`: tablas de la DB y permisos por rol de abajo.

Aplica a: `addDoc/setDoc/updateDoc/batch.*`, `firestore.rules`, `storage.rules`, `functions/`, roles.
Rules del repo no aplican hasta `firebase deploy --only firestore:rules` — avisarlo siempre.

## Tablas (Firestore)
Detalle de campos en `SCHEMA.md`.

| Colección | Qué guarda |
|---|---|
| `productos` | Catálogo y stock. Clave de negocio `idProducto` |
| `clients` (+`movements`) | Clientes, deuda fiado, RUT, patente, `vehiculo`. `movements` espeja fiados/abonos con `saleId` |
| `sales` | Ventas POS, fiados, abonos, descuentos |
| `salesWeb` | Pedidos de la landing pública |
| `cash_registers` | Sesiones de caja |
| `gastos` | Gastos del local |
| `usuarios/{uid}` | Perfil y rol de cada cuenta de Auth |
| `vehiculos/{patente}` | Caché de patentes (solo Cloud Function escribe) |
| `settings/global` | Datos de empresa y apariencia |

Storage: `productos/` (imágenes).

## Roles y permisos
Estado: **roles creados, permisos NO aplicados** (ni UI ni rules). Hoy toda cuenta con sesión tiene acceso total. Rol inicial al primer login: `admin`.

Plan propuesto (confirmar con Peter Parker antes de aplicar):

| Área | desarrollador | admin | lector |
|---|---|---|---|
| Ventas, caja, clientes, pedidos web, gastos | ✅ total | ✅ total | 👁 solo ver |
| Productos / inventario | ✅ total | ✅ total | 👁 solo ver |
| Reportes (dashboard, análisis, historial) | ✅ | ✅ | 👁 |
| Editar/borrar ventas del historial | ✅ | ✅ | ❌ |
| Configuración (datos empresa) | ✅ | ✅ | ❌ |
| Usuarios: ver | ✅ | ✅ | ❌ |
| Usuarios: cambiar roles | ✅ | ❌ | ❌ |
| Config técnica (apariencia, `primaryColor`) | ✅ | ❌ | ❌ |

Al aplicar: restringir en `firestore.rules` (leer `usuarios/{request.auth.uid}.rol`) **y** en UI (ocultar nav/acciones); impedir que un usuario cambie su propio rol.

## Código
- Español en commits, comentarios y UI.
- Comentarios solo "por qué", no "qué".
- Seguir patrones existentes (`Card`, `Skeleton`, `toast` de sonner, `useDelayedLoading`).
- Tests junto a cada vista en `__tests__/`; mock de Firestore en `src/test/firebaseMock.js`.
- Verificar con `npx eslint src && npx vitest run`.
- Ops destructivas y deploys → confirmar antes.
