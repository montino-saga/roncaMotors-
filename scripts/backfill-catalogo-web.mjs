/**
 * Reconstruye `catalogoWeb`, el espejo público que lee el sitio
 * (../WebRoncaMotors), llamando a la Cloud Function `backfillCatalogoWeb`.
 *
 *   node scripts/backfill-catalogo-web.mjs
 *
 * El espejo está cerrado a escritura en las rules: solo lo escribe la función
 * con el Admin SDK. Por eso aquí solo iniciamos sesión (hay que ser
 * desarrollador) y la invocamos. Es idempotente: se puede repetir.
 *
 * Igual que seed-productos: la contraseña se pide por stdin y no se guarda.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const env = Object.fromEntries(
    readFileSync(new URL("../.env", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

// Al pedir la contraseña se oculta lo que se teclea, pero NO la etiqueta:
// silenciar todo el output dejaba la línea en blanco y parecía colgado.
function ask(question, { hidden = false } = {}) {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!hidden) return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
    return new Promise((res) => {
        const escribir = rl._writeToOutput.bind(rl);
        rl._writeToOutput = (texto) => { if (texto.includes(question)) escribir(texto); };
        rl.question(question, (a) => { rl.close(); console.log(); res(a.trim()); });
    });
}

console.log(`\n  Proyecto destino : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`  Acción           : reconstruir catalogoWeb desde productos\n`);

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});

console.log("  La cuenta y la contraseña son las que usas para entrar al panel,");
console.log("  no las de Google ni las del CLI de Firebase.\n");

// El correo también se puede pasar como argumento: npm run catalogo:web -- tu@correo.cl
const email = process.argv[2]?.trim() || (await ask("  Email del panel: "));
const password = await ask("  Contraseña: ", { hidden: true });

try {
    await signInWithEmailAndPassword(getAuth(app), email, password);
} catch (error) {
    const porCodigo = {
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/invalid-email": "Ese correo no tiene formato válido.",
        "auth/user-not-found": "Esa cuenta no existe en este proyecto.",
        "auth/wrong-password": "Contraseña incorrecta.",
        "auth/too-many-requests": "Demasiados intentos fallidos; espera unos minutos.",
        "auth/network-request-failed": "Sin conexión con Firebase.",
    };
    console.error(`\n  No pude iniciar sesión: ${porCodigo[error.code] ?? error.message}\n`);
    process.exit(1);
}

const backfill = httpsCallable(getFunctions(app, "southamerica-east1"), "backfillCatalogoWeb");

try {
    const { data } = await backfill();
    console.log(`\n  Espejados : ${data.espejados}`);
    console.log(`  Saltados  : ${data.saltados}  (sin nombre o sin precio: no se publican)`);
    console.log(`  Borrados  : ${data.borrados}  (espejos de productos que ya no existen)\n`);
    process.exit(0);
} catch (error) {
    if (error.code === "functions/permission-denied") {
        console.error("\n  Esa cuenta no es desarrollador.");
        console.error("  Cámbiale el rol en la consola de Firebase: Firestore → usuarios → tu uid → rol: 'desarrollador'.\n");
    } else {
        console.error(`\n  Falló: ${error.message}\n`);
    }
    process.exit(1);
}
