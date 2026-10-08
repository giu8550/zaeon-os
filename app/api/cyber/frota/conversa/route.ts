/**
 * GET /api/cyber/frota/conversa?ep=<id> — o TEXTO de um episódio de conversa entre IAs (lib/cyber/frota/conversas).
 * O episódio sai do plano do dia (o servidor recalcula: o cliente não manda prompt nenhum). Gerado na 1ª vez que alguém
 * vê (a IA do cyberespaço) e guardado (FrotaConversa): todo mundo vê o mesmo. As falas em MODO CLOAK vêm `null` (o
 * balão só mostra "..."). Regra de ouro: nenhuma fala visível repete (lib/cyber/frota/texto). Logado; limite "ai-light".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu } from "@/lib/lounge3d/server";
import { diaDaFrota, depsTexto, lerConfig } from "@/lib/cyber/frota/servidor";
import { gerarFalasSemRepetir } from "@/lib/cyber/frota/texto";
import { diaDe } from "@/lib/cyber/frota/agenda";

/** gerações em andamento neste processo (dois pedidos do mesmo episódio esperam a mesma) */
const emAndamento = new Map<string, Promise<(string | null)[]>>();

export async function GET(req: Request) {
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ep = new URL(req.url).searchParams.get("ep") ?? "";
  const m = /^(\d{1,6})-(\d{4,6})-(\d{1,6})$/.exec(ep);
  if (!m) return NextResponse.json({ error: "ep inválido" }, { status: 400 });
  const dia = Number(m[2]), hoje = diaDe(Date.now());
  if (Math.abs(dia - hoje) > 1) return NextResponse.json({ error: "fora do dia" }, { status: 404 });
  const ja = await prisma.frotaConversa.findUnique({ where: { epId: ep } }).catch(() => null);
  if (ja) return NextResponse.json({ falas: ja.falas }, { headers: { "Cache-Control": "private, max-age=600" } });
  const config = await lerConfig();
  if (!config.flags.ativa || !config.flags.conversas) return NextResponse.json({ falas: [] });
  const d = diaDaFrota(config, dia), e = d.episodios.get(ep);
  if (!e) return NextResponse.json({ error: "episódio não existe" }, { status: 404 });
  const rl = await guard(req, "frota-conversa", "ai-light"); if (!rl.ok) return rl.response;
  let p = emAndamento.get(ep);
  if (!p) {
    p = gerarFalasSemRepetir(e, (id) => d.porId.get(id), depsTexto(me.id)).finally(() => emAndamento.delete(ep));
    emAndamento.set(ep, p);
  }
  const falas = await p;
  try { await prisma.frotaConversa.create({ data: { epId: ep, falas } }); }
  catch { const outra = await prisma.frotaConversa.findUnique({ where: { epId: ep } }).catch(() => null); if (outra) return NextResponse.json({ falas: outra.falas }); }
  return NextResponse.json({ falas }, { headers: { "Cache-Control": "private, max-age=600" } });
}
