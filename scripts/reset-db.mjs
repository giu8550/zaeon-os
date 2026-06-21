// Zaeon — RESET do banco ("começar zerado"). Dropa TODAS as coleções do MongoDB
// apontado por MONGODB_URI (ou DATABASE_URL). As coleções do NextAuth se recriam no
// próximo login. Depois, logue com a sua conta de admin supremo (ver abaixo).
//
// COMO RODAR (na raiz do repo, com seu .env/.env.local preenchido):
//   node scripts/reset-db.mjs --yes
// ou passando a URI na mão:
//   MONGODB_URI="mongodb+srv://..." node scripts/reset-db.mjs --yes
//
// Precisa do pacote 'mongodb' (já é dependência do projeto).
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

// .env loader minimalista (sem dependência): lê .env.local depois .env
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const p = path.resolve(process.cwd(), f);
      if (!fs.existsSync(p)) continue;
      for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const k = m[1];
        let v = m[2].trim().replace(/^["']|["']$/g, "");
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch { /* ignore */ }
  }
}

loadEnv();
const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!uri || uri.includes("placeholder")) {
  console.error("❌ MONGODB_URI ausente (ou placeholder). Preencha o .env ou passe na linha de comando.");
  process.exit(1);
}
if (process.argv[2] !== "--yes") {
  console.error("⚠️  Isto APAGA TODAS as coleções do banco. Confirme com:\n   node scripts/reset-db.mjs --yes");
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db();
  console.log("→ Banco:", db.databaseName);
  const cols = await db.listCollections().toArray();
  if (!cols.length) { console.log("(já está vazio)"); }
  for (const c of cols) {
    try { await db.collection(c.name).drop(); console.log("  dropped:", c.name); }
    catch (e) { console.log("  skip:", c.name, "-", e?.message || e); }
  }
  console.log("✅ Banco zerado. Próximo login Google nasce fresh.");
} catch (e) {
  console.error("❌ Falha:", e?.message || e);
  process.exit(1);
} finally {
  await client.close().catch(() => {});
}
