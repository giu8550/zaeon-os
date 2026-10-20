/**
 * POST /api/lounge3d/[id]/duelo — o DUELO DE LINGUAGEM da Examiner (a guardiã do Templo Cósmico — lib/cyber/dueloIngles):
 *  - { acao: "iniciar" } → as 7 perguntas de inglês (do AGENTE DE INGLÊS, `falarJson` agente "examiner-ingles"; JSON
 *    inválido/erro/timeout → o banco fixo), SEM o gabarito. Quem já venceu → { passou: true }; quem perdeu há menos de
 *    `ESPERA_S` → 429 com quanto falta.
 *  - { acao: "responder", respostas: number[] } → corrige NO SERVIDOR (o gabarito ficou aqui), grava em User.cyberPerfil
 *    `examinerInglesEm` (venceu: a porta da cúpula abre pra sempre) ou `examinerPerdeuEm` (a espera), e devolve o erro
 *    medido (o que deu, o que era e por quê).
 * O duelo em andamento fica na MEMÓRIA do servidor (uma instância na VPS), 20 min. Membro da sala (IDOR → 404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { falarJson } from "@/lib/cyber/ia/motor";
import { ESPERA_S, PROMPT_AGENTE_INGLES, corrigir, podeTentar, publica, sanearRespostas, sortearDoBanco, validarPerguntasDaIA, type Pergunta } from "@/lib/cyber/dueloIngles";

const VALIDADE_MS = 20 * 60 * 1000;
const emAndamento = new Map<string, { perguntas: Pergunta[]; em: number }>();
const limpar = (agora: number) => { for (const [k, v] of emAndamento) if (agora - v.em > VALIDADE_MS) emAndamento.delete(k); };
const perfilDe = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-duelo", "ai-light"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>, agora = Date.now(); limpar(agora);
  const u = await prisma.user.findUnique({ where: { id: me.id }, select: { cyberPerfil: true } }), perfil = perfilDe(u?.cyberPerfil);
  if (perfil.examinerInglesEm) return NextResponse.json({ passou: true });

  if (body.acao === "iniciar") {
    const perdeu = typeof perfil.examinerPerdeuEm === "string" ? Date.parse(perfil.examinerPerdeuEm) : null;
    if (!podeTentar(perdeu, agora)) return NextResponse.json({ error: "espera", faltaS: Math.ceil(((perdeu ?? 0) + ESPERA_S * 1000 - agora) / 1000) }, { status: 429 });
    let perguntas: Pergunta[] | null = null;
    try {
      const raw = await falarJson<unknown>({ system: PROMPT_AGENTE_INGLES, user: `Seed: ${agora % 100000}. Create a fresh set — do not repeat common textbook examples.`, agente: "examiner-ingles", userId: me.id, temperatura: 0.9 });
      perguntas = validarPerguntasDaIA(raw);
    } catch { perguntas = null; }
    const fonte = perguntas ? "agente" : "banco";
    perguntas ??= sortearDoBanco(agora);
    emAndamento.set(me.id, { perguntas, em: agora });
    return NextResponse.json({ perguntas: perguntas.map(publica), fonte });
  }

  if (body.acao === "responder") {
    const d = emAndamento.get(me.id); if (!d) return NextResponse.json({ error: "Duelo expirado — fale com a Examiner de novo." }, { status: 410 });
    emAndamento.delete(me.id);
    const r = corrigir(d.perguntas, sanearRespostas(body.respostas));
    await prisma.user.update({ where: { id: me.id }, data: { cyberPerfil: { ...perfil, ...(r.passou ? { examinerInglesEm: new Date().toISOString() } : { examinerPerdeuEm: new Date().toISOString() }) } } });
    return NextResponse.json(r);
  }
  return NextResponse.json({ error: "acao inválida" }, { status: 400 });
}
