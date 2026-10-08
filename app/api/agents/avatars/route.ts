/**
 * GET /api/agents/avatars — manifestos dos AVATARES VIVOS de todos os agentes, num JSON só
 * ({ agentes: { [agentKey]: AvatarManifest } }). Público (landing/canal/chat), cacheado.
 * Fonte: public/avatars/index.json (Etapa A, versionado no git) + sets do admin no banco
 * (Etapa B, sobrepõem). Banco fora do ar → só os estáticos (o cliente ainda cai no index.json).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { normalizarManifest, type AvatarManifest } from "@/lib/avatars/estados";
import { manifestosDoBanco } from "@/lib/avatars/banco";
import { mesclarManifestos } from "@/lib/avatars/mesclar";

function estaticos(): Record<string, AvatarManifest> {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "avatars", "index.json"), "utf8"));
    const out: Record<string, AvatarManifest> = {};
    for (const raw of Object.values(j?.agentes ?? {})) { const m = normalizarManifest(raw); if (m) out[m.agentId] = m; }
    return out;
  } catch { return {}; }
}

export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  const banco = await manifestosDoBanco().catch((e) => { console.warn("[avatars] banco:", (e as Error)?.message); return {}; });
  return NextResponse.json({ agentes: mesclarManifestos(estaticos(), banco) }, { headers });
}
