/**
 * Fija el nombre del negocio en `settings/global` (lo que muestra la barra
 * lateral, la boleta y la cotización).
 *
 *   node scripts/set-marca.mjs                → "Roncamotors"
 *   node scripts/set-marca.mjs "Otro nombre"
 *
 * Igual que seed-productos: escribe con tu cuenta de admin, la contraseña se
 * pide por stdin y no se guarda.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

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

const nombre = process.argv[2]?.trim() || "Roncamotors";

console.log(`\n  Proyecto destino : ${env.VITE_FIREBASE_PROJECT_ID}`);
console.log(`  businessName     : "${nombre}"\n`);

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

const ref = doc(db, "settings", "global");
const antes = (await getDoc(ref)).data();
console.log(`  Antes: ${JSON.stringify(antes ?? null)}`);
// merge: no toca logo ni primaryColor.
await setDoc(ref, { businessName: nombre }, { merge: true });
console.log(`  Listo: businessName = "${nombre}"\n`);
process.exit(0);
