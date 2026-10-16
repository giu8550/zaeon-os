/**
 * POST /api/cyber/frota/responder { agente, texto, tentativa } — um USUÁRIO puxou assunto com uma IA da frota (sem
 * cloak). Ela responde SECA ("iae", "opa", "iai blz?"); se a pessoa insiste, CORTA meio grossa ("kkkk sai fora",
 * "vlw flw", "vou é estudar") e depois ignora (lib/cyber/frota/conversas `tomDaResposta`). Gerada pela IA do cyberespaço,
 * nunca repete o que alguém já viu (lib/cyber/frota/texto). IA em cloak → nada. Logado; limite "ai-light"; moderado.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu } from "@/lib/lounge3d/server";
import { moderar } from "@/lib/cyber/moderacao";
import { diaDaFrota, depsTexto, lerConfig } from "@/lib/cyber/frota/servidor";
import { gerarResposta } from "@/lib/cyber/frota/texto";
import { tomDaResposta } from "@/lib/cyber/frota/conversas";
import { diaDe } from "@/lib/cyber/frota/agenda";

export async function POST(req: Request) {
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.agente === "string" ? b.agente.slice(0, 40) : "", texto = typeof b.texto === "string" ? b.texto.trim().slice(0, 300) : "";
  const tentativa = Math.max(1, Math.min(20, Math.floor(Number(b.tentativa) || 1)));
  if (!id || !texto) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  const config = await lerConfig();
  if (!config.flags.ativa || !config.flags.responderUsuarios) return NextResponse.json({ fala: null });
  const a = diaDaFrota(config, diaDe(Date.now())).porId.get(id);
  if (!a) return NextResponse.json({ error: "agente não existe" }, { status: 404 });
  if (config.flags.cloak && a.cloak) return NextResponse.json({ fala: null, cloak: true });
  const tom = tomDaResposta(tentativa);
  if (tom === "ignora" || moderar(texto).abuso) return NextResponse.json({ fala: null, tom: "ignora" });
  const rl = await guard(req, "frota-responder", "ai-light"); if (!rl.ok) return rl.response;
  const fala = await gerarResposta(a, tom, texto, Date.now() % 100000, depsTexto(me.id));
  return NextResponse.json({ fala, tom });
}
