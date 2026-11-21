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

function ask(question, { hidden = false } = {}) {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!hidden) return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
    return new Promise((res) => {
        process.stdout.write(question);
        rl.question("", (a) => { rl.close(); process.stdout.write("\n"); res(a.trim()); });
        rl._writeToOutput = () => {};
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

const email = await ask("  Email de desarrollador: ");
const password = await ask("  Contraseña: ", { hidden: true });
await signInWithEmailAndPassword(getAuth(app), email, password);

const backfill = httpsCallable(getFunctions(app, "southamerica-east1"), "backfillCatalogoWeb");

try {
    const { data } = await backfill();
    console.log(`\n  Espejados : ${data.espejados}`);
    console.log(`  Saltados  : ${data.saltados}  (sin nombre o sin precio: no se publican)`);
    console.log(`  Borrados  : ${data.borrados}  (espejos de productos que ya no existen)\n`);
    process.exit(0);
} catch (error) {
    console.error(`\n  Falló: ${error.message}\n`);
    process.exit(1);
}
