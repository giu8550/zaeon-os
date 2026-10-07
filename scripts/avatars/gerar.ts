/**
 * scripts/avatars/gerar.ts — regeração EM LOTE de avatares JÁ APROVADOS (manutenção).
 *
 * Criar avatar novo é no ESTÚDIO, com o dono vendo cada estado aparecer e aprovando um a um:
 *   dev (Etapa A): http://localhost:3000/dev/avatares  ·  admin (Etapa B): Agents → "avatar vivo".
 * Este script serve pra depois — ex.: mudou o prompt de um estado e quer refazer só ele, mantendo
 * o personagem (base salva):
 *   npx tsx scripts/avatars/gerar.ts aura --estados think,confused
 *   npx tsx scripts/avatars/gerar.ts --indice        # só reconstrói public/avatars/index.json
 * Credencial: a mesma do Vertex (GOOGLE_CREDENTIALS…) — lida de `.env` ou de AVATAR_ENV_FILE.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { gerarSetAvatar, type EstadoEditavel } from "@/lib/avatars/pipeline";
import { isEstadoSprite } from "@/lib/avatars/estados";
import { RAIZ_AVATARES, lerManifestDisco, reconstruirIndice, salvarNoDisco } from "@/lib/avatars/disco";

config({ path: process.env.AVATAR_ENV_FILE || ".env", quiet: true });

const args = process.argv.slice(2);
const valor = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  if (args.includes("--indice")) { console.log(`index.json: ${reconstruirIndice().join(", ") || "(vazio)"}`); return; }
  const estados = (valor("--estados") ?? "").split(",").map((s) => s.trim()).filter((e): e is EstadoEditavel => isEstadoSprite(e) && e !== "idle");
  const ids = args.filter((a) => !a.startsWith("--") && a !== valor("--estados"));
  if (!ids.length || !estados.length) {
    console.log("uso: npx tsx scripts/avatars/gerar.ts <agentId…> --estados a,b   (avatar novo = estúdio /dev/avatares)");
    process.exit(1);
  }
  let falhou = false;
  for (const id of ids) {
    const basePath = path.join(RAIZ_AVATARES(), id, "base.webp");
    const m = lerManifestDisco(id);
    if (!m || !fs.existsSync(basePath)) { console.error(`✗ ${id}: sem set aprovado (crie no estúdio)`); falhou = true; continue; }
    const set = await gerarSetAvatar({ baseImagem: fs.readFileSync(basePath), estados, onProgresso: (msg) => console.log(`  [${id}] ${msg}`) });
    delete set.quadros.idle; // a base não mudou — o idle aprovado continua
    salvarNoDisco(id, { base: set.base, quadros: set.quadros, cor: m.cor }, false);
    if (set.falhas.length) falhou = true;
    console.log(`${set.falhas.length ? "⚠" : "✓"} ${id}: ${Object.keys(set.quadros).join(", ") || "nada"}${set.falhas.length ? ` · falhas: ${set.falhas.map((f) => `${f.estado} (${f.motivo})`).join("; ")}` : ""}`);
  }
  if (falhou) process.exit(1);
}

void main();
