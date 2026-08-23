/**
 * Carga 40 productos ficticios (idProducto "1".."40") en Firestore.
 *
 *   node scripts/seed-productos.mjs          crea
 *   node scripts/seed-productos.mjs --undo   borra los que creó este script
 *
 * Escribe en el proyecto del .env con tu propia cuenta de admin: las reglas
 * de firestore.rules exigen sesión, no hay forma de hacerlo sin autenticarse.
 * La contraseña se pide por stdin, no se guarda ni se registra en ningún sitio.
 *
 * Los documentos llevan `_seed: true` para poder borrarlos luego sin tocar
 * nada real.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
    getFirestore, collection, query, where, getDocs, writeBatch, doc
} from "firebase/firestore";

const env = Object.fromEntries(
    readFileSync(new URL("../.env", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
        .map((l) => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);

const CATALOGO = [
    ["Pastillas de freno delanteras", "Brembo", "Frenos", 12990, 24990],
    ["Pastillas de freno traseras", "Brembo", "Frenos", 10990, 21990],
    ["Disco de freno 280mm", "Galfer", "Frenos", 34990, 62990],
    ["Líquido de frenos DOT 4", "Motul", "Frenos", 3490, 7990],
    ["Aceite motor 10W40 1L", "Motul", "Lubricantes", 6990, 13990],
    ["Aceite motor 20W50 1L", "Castrol", "Lubricantes", 5990, 11990],
    ["Aceite de horquilla 10W", "Motul", "Lubricantes", 7490, 14990],
    ["Grasa para cadena", "Wurth", "Lubricantes", 4290, 9490],
    ["Filtro de aceite", "Hiflofiltro", "Filtros", 3990, 8990],
    ["Filtro de aire", "K&N", "Filtros", 12990, 26990],
    ["Filtro de combustible", "Hiflofiltro", "Filtros", 2990, 6990],
    ["Bujía NGK CR8E", "NGK", "Encendido", 3490, 7490],
    ["Bujía iridio CR9EIX", "NGK", "Encendido", 8990, 17990],
    ["Bobina de encendido", "Denso", "Encendido", 18990, 36990],
    ["Batería 12V 7Ah", "Yuasa", "Eléctrico", 29990, 54990],
    ["Batería gel 12V 9Ah", "Yuasa", "Eléctrico", 36990, 68990],
    ["Regulador de voltaje", "Shindengen", "Eléctrico", 22990, 44990],
    ["Kit de arrastre 428H", "DID", "Transmisión", 32990, 59990],
    ["Cadena 520 x 120", "DID", "Transmisión", 28990, 52990],
    ["Piñón delantero 15T", "JT Sprockets", "Transmisión", 7990, 15990],
    ["Corona trasera 45T", "JT Sprockets", "Transmisión", 14990, 28990],
    ["Kit de embrague", "Barnett", "Transmisión", 44990, 84990],
    ["Neumático 110/70-17", "Pirelli", "Neumáticos", 48990, 89990],
    ["Neumático 140/70-17", "Pirelli", "Neumáticos", 62990, 114990],
    ["Cámara 17 pulgadas", "Michelin", "Neumáticos", 5990, 12490],
    ["Amortiguador trasero", "YSS", "Suspensión", 79990, 149990],
    ["Retén de horquilla par", "Ariete", "Suspensión", 8990, 18990],
    ["Rodamiento de rueda", "SKF", "Suspensión", 6490, 13990],
    ["Espejo retrovisor par", "Puig", "Carrocería", 12990, 25990],
    ["Manillar aluminio", "Renthal", "Carrocería", 34990, 64990],
    ["Puños de goma par", "Domino", "Carrocería", 6990, 14990],
    ["Protector de motor", "SW-Motech", "Carrocería", 54990, 99990],
    ["Cable de acelerador", "Venhill", "Mandos", 7990, 16990],
    ["Maneta de freno", "Puig", "Mandos", 15990, 31990],
    ["Maneta de embrague", "Puig", "Mandos", 15990, 31990],
    ["Casco integral negro", "LS2", "Equipamiento", 74990, 139990],
    ["Guantes de cuero", "Alpinestars", "Equipamiento", 32990, 62990],
    ["Chaqueta con protecciones", "Alpinestars", "Equipamiento", 119990, 219990],
    ["Candado disco alarma", "Abus", "Accesorios", 27990, 52990],
    ["Soporte de teléfono", "Quad Lock", "Accesorios", 34990, 64990],
];

const productos = CATALOGO.map(([nombre, marca, categoria, costo, venta], i) => ({
    idProducto: String(i + 1),
    nombreProducto: nombre,
    marcaProducto: marca,
    categoriaProducto: categoria,
    precioOriginal: costo,
    precioVentaLocal: venta,
    precioVentaWeb: Math.round((venta * 1.05) / 10) * 10,
    precioProducto: venta,          // legacy: espejo de precioVentaLocal
    cantidadProducto: 3 + ((i * 7) % 25),
    imagenProducto: "",
    afectoIva: true,
    _seed: true
}));

function ask(question, { hidden = false } = {}) {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!hidden) return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));

    return new Promise((res) => {
        process.stdout.write(question);
        const onData = (ch) => {
            if (["\n", "\r", ""].includes(ch.toString())) process.stdin.removeListener("data", onData);
            else process.stdout.write("*");
        };
        process.stdin.on("data", onData);
        rl.question("", (a) => { rl.close(); process.stdout.write("\n"); res(a.trim()); });
        rl._writeToOutput = () => {};
    });
}

const undo = process.argv.includes("--undo");

console.log(`\n  Proyecto destino : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`  Operación        : ${undo ? "BORRAR los 40 productos de prueba" : "CREAR 40 productos de prueba"}\n`);

const ok = await ask('  Escribe "si" para continuar: ');
if (ok.toLowerCase() !== "si") {
    console.log("  Cancelado, no se escribió nada.\n");
    process.exit(0);
}

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);

const email = await ask("  Email de admin: ");
const password = await ask("  Contraseña: ", { hidden: true });
await signInWithEmailAndPassword(getAuth(app), email, password);
console.log("  Sesión iniciada.\n");

const col = collection(db, "productos");

if (undo) {
    const snap = await getDocs(query(col, where("_seed", "==", true)));
    if (snap.empty) {
        console.log("  No hay productos de prueba que borrar.\n");
        process.exit(0);
    }
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`  ${snap.size} productos de prueba borrados.\n`);
    process.exit(0);
}

// Nunca pisar un producto real que ya use uno de esos códigos.
const ids = productos.map((p) => p.idProducto);
const ocupados = [];
for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(col, where("idProducto", "in", ids.slice(i, i + 30))));
    snap.forEach((d) => { if (!d.data()._seed) ocupados.push(d.data().idProducto); });
}
if (ocupados.length) {
    console.error(`  ABORTADO. Estos códigos ya los usan productos reales: ${ocupados.join(", ")}`);
    console.error("  Bórralos o cámbiales el código antes de sembrar.\n");
    process.exit(1);
}

const batch = writeBatch(db);
productos.forEach((p) => batch.set(doc(col), p));
await batch.commit();

console.log(`  ${productos.length} productos creados (idProducto 1 a ${productos.length}).`);
console.log("  Para revertir: node scripts/seed-productos.mjs --undo\n");
process.exit(0);
