/**
 * lib/avatars/disco.ts — grava um set aprovado em public/avatars/<id>/ (server-only, fs).
 *
 * Usado pela Etapa A (estúdio em dev + CLI). Em produção o `public/` é do BUILD (Next só serve o
 * que existia no build), por isso o admin grava no banco (AgentAvatarQuadro) e não aqui.
 * Layout: <estado>.webp (512) · <estado>.sm.webp (160) · base.webp (1024) · manifest.json;
 * public/avatars/index.json junta todos os manifestos (1 fetch por página no cliente).
 */
import fs from "node:fs";
import path from "node:path";
import { normalizarManifest, type AvatarManifest, type EstadoSprite } from "./estados";
import type { SetParaSalvar } from "./estudio";

export const RAIZ_AVATARES = () => path.join(process.cwd(), "public", "avatars");

export function lerManifestDisco(id: string): AvatarManifest | null {
  try { return normalizarManifest(JSON.parse(fs.readFileSync(path.join(RAIZ_AVATARES(), id, "manifest.json"), "utf8"))); } catch { return null; }
}

export function reconstruirIndice(): string[] {
  const raiz = RAIZ_AVATARES();
  const agentes: Record<string, AvatarManifest> = {};
  for (const id of fs.existsSync(raiz) ? fs.readdirSync(raiz) : []) {
    const m = lerManifestDisco(id);
    if (m) agentes[m.agentId] = m;
  }
  fs.mkdirSync(raiz, { recursive: true });
  fs.writeFileSync(path.join(raiz, "index.json"), JSON.stringify({ agentes }, null, 2) + "\n");
  return Object.keys(agentes);
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;

/**
 * Grava o set. `substituir` = o set é o conjunto COMPLETO (quadro antigo que não veio é apagado);
 * senão mescla com o que já existe (CLI regerando só alguns estados da mesma base).
 */
export function salvarNoDisco(agentId: string, set: SetParaSalvar, substituir = true): AvatarManifest {
  if (!ID_RE.test(agentId)) throw new Error("agentId inválido");
  const dir = path.join(RAIZ_AVATARES(), agentId);
  fs.mkdirSync(dir, { recursive: true });
  const existente = lerManifestDisco(agentId);
  const anterior = substituir ? null : existente;
  if (substituir) {
    for (const f of fs.readdirSync(dir)) if (/\.webp$/.test(f) && f !== "base.webp") fs.unlinkSync(path.join(dir, f));
  }
  fs.writeFileSync(path.join(dir, "base.webp"), set.base);
  const versao = Date.now().toString(36);
  const estados = new Set<EstadoSprite>([...(Object.keys(anterior?.estados ?? {}) as EstadoSprite[])]);
  for (const [estado, q] of Object.entries(set.quadros) as [EstadoSprite, NonNullable<SetParaSalvar["quadros"][EstadoSprite]>][]) {
    fs.writeFileSync(path.join(dir, `${estado}.webp`), q.grande);
    fs.writeFileSync(path.join(dir, `${estado}.sm.webp`), q.pequeno);
    estados.add(estado);
  }
  // a voz (saudações) não é do estúdio de imagem — sobrevive a qualquer regravação dos quadros
  const m: AvatarManifest = { agentId, versao, motor: "sprite", estados: {}, pequeno: {}, cor: set.cor ?? anterior?.cor, ...(existente?.voz ? { voz: existente.voz } : {}) };
  for (const e of estados) {
    m.estados[e] = `/avatars/${agentId}/${e}.webp?v=${versao}`;
    m.pequeno[e] = `/avatars/${agentId}/${e}.sm.webp?v=${versao}`;
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
  reconstruirIndice();
  return m;
}
