/**
 * Quita de la sesión de caja abierta los movimientos de prueba
 * (descripción que empieza por "TEST"). No toca nada más.
 *
 *   node scripts/limpiar-qa-caja.mjs
 *
 * Igual que set-marca: escribe con tu cuenta de admin, la contraseña se
 * pide por stdin y no se guarda.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, limit, getDocs, updateDoc } from "firebase/firestore";

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

console.log(`\n  Proyecto destino : ${env.VITE_FIREBASE_PROJECT_ID}\n`);

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const email = await ask("  Email de admin: ");
const password = await ask("  Contraseña: ", { hidden: true });
await signInWithEmailAndPassword(getAuth(app), email, password);

const snap = await getDocs(query(collection(db, "cash_registers"), where("status", "==", "open"), limit(1)));
if (snap.empty) { console.log("  No hay caja abierta."); process.exit(0); }

const ref = snap.docs[0].ref;
const movements = snap.docs[0].data().movements ?? [];
const limpios = movements.filter((m) => !String(m.description ?? "").startsWith("TEST"));
console.log(`  Movimientos: ${movements.length} → ${limpios.length}`);
await updateDoc(ref, { movements: limpios });
console.log("  Listo.\n");
process.exit(0);
