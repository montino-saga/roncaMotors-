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
   - `src/lib/usuarios.js` + `src/hooks/usePermisos.js` — roles y permisos
   - `src/db/firebase.js` — init Firebase
   - `functions/index.js` — Cloud Function `crearUsuario` (invitación). `consultarPatente` (Boostr) está comentada: sin API key

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
| `vehiculos/{patente}` | Caché de patentes. Desactivada junto con `consultarPatente` |
| `settings/global` | Datos de empresa y apariencia |

Storage: `productos/` (imágenes).

## Roles y permisos
Rol inicial al primer login: `admin`. Primer `desarrollador`: a mano en consola Firebase.

| Área | desarrollador | admin | lector |
|---|---|---|---|
| Ver todas las vistas (ventas, caja, clientes, inventario, reportes, configuración) | ✅ | ✅ | ✅ |
| Crear, editar, borrar en cualquier vista | ✅ | ✅ | ❌ |
| Usuarios: vista, sidebar, ver, invitar y cambiar roles | ✅ | ❌ | ❌ |

- Fuente única en `src/lib/usuarios.js` (`esDesarrollador`, `puedeEscribir`); en vistas usar `usePermisos()` → `{ soloLectura, esDesarrollador }`.
- UI: `soloDesarrollador` en `navSections` + guarda `SoloDesarrollador` en `App.jsx`. Lector: formularios en `<fieldset disabled={soloLectura} className="contents">`, acciones de fila ocultas, botones de cobro/alta deshabilitados con `TITULO_SOLO_LECTURA`.
- Rules: `esDesarrollador()` y `puedeEscribir()` en `firestore.rules`; `puedeEscribir()` en `storage.rules`. UI y rules deben coincidir.
- **Toda acción de escritura nueva** debe respetar `soloLectura`.
- Nadie cambia su propio rol (rules + select deshabilitado).
- Invitar: Cloud Function `crearUsuario` valida que quien llama sea desarrollador (Admin SDK salta las rules) y crea cuenta sin contraseña + perfil; el correo de restablecimiento de Firebase hace de invitación.
- `ROLES` está duplicado en `src/lib/usuarios.js` y `functions/index.js`: cambiar ambos.

## Código
- Español en commits, comentarios y UI.
- Comentarios solo "por qué", no "qué".
- Seguir patrones existentes (`Card`, `Skeleton`, `toast` de sonner, `useDelayedLoading`).
- Tests junto a cada vista en `__tests__/`; mock de Firestore en `src/test/firebaseMock.js`.
- Verificar con `npx eslint src && npx vitest run`.
- Rules/functions: probar en emulador local con proyecto `demo-test`, nunca contra producción. `firebase.json` no trae bloque `emulators`: para Auth usar un `--config` temporal con puertos (auth 9099, firestore 8080, functions 5001, storage 9199) y `npm install` en `functions/`.
- Ops destructivas y deploys → confirmar antes.
