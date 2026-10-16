/**
 * POST /api/lounge3d/[id]/zaeon { perfil, historico, resposta, turno, foraSeguidas } — UM turno da conversa com a
 * Zaeon na capela (a parte GERATIVA do onboarding — lib/cyber/conversaZaeon). Usa o HARNESS DO CYBERESPAÇO
 * (lib/cyber/ia/motor `falarJson`: modelo leve, fala curta, prazo curto) — separado do harness do laboratório; o custo
 * vai pro ledger como agente "cyber:zaeon".
 *  1. MODERA antes (lib/cyber/moderacao): abuso óbvio nem chega na IA → { classe: "abuso" } e a expulsão é gravada.
 *  2. A IA classifica (ok / fora / abuso), responde de forma coesa e extrai o perfil OCULTO (o que faz, o que quer
 *     estudar, o objetivo) — a base da gamificação. O JSON dela é validado (`validarTurnoIa`); inválido/erro/timeout
 *     → a reserva local (`fallbackZaeon`): o onboarding nunca trava.
 *  3. Grava o perfil (User.cyberPerfil, mesclado) e, quando a conversa conclui, o nascimento (User.cyberNasceuEm).
 * Membro da sala (IDOR → 404); limite "ai-light".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { falarJson } from "@/lib/cyber/ia/motor";
import { moderar } from "@/lib/cyber/moderacao";
import { fallbackZaeon, limparPerfil, limparResposta, promptZaeon, validarTurnoIa, type FalaConversa, type PedidoZaeon, type TurnoZaeon } from "@/lib/cyber/conversaZaeon";

const pedidoDe = (b: Record<string, unknown>): PedidoZaeon => ({
  perfil: limparPerfil(b.perfil),
  historico: (Array.isArray(b.historico) ? b.historico : []).slice(-12).flatMap((f): FalaConversa[] => {
    const o = f as Record<string, unknown>, texto = limparResposta(o?.texto, 300);
    return texto && (o?.quem === "zaeon" || o?.quem === "eu") ? [{ quem: o.quem, texto }] : [];
  }),
  resposta: limparResposta(b.resposta),
  turno: Math.max(0, Math.min(20, Math.floor(Number(b.turno) || 0))),
  foraSeguidas: Math.max(0, Math.min(10, Math.floor(Number(b.foraSeguidas) || 0))),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-zaeon", "ai-light"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pedido = pedidoDe((await req.json().catch(() => ({}))) as Record<string, unknown>);
  if (!pedido.resposta) return NextResponse.json({ error: "resposta vazia" }, { status: 400 });

  let turno: TurnoZaeon;
  if (moderar(pedido.resposta).abuso) turno = { classe: "abuso", fala: "", perfil: pedido.perfil, opcoes: [], concluido: false, ia: false };
  else {
    try {
      const { system, user } = promptZaeon(pedido);
      const bruto = await falarJson<unknown>({ system, user, agente: "zaeon", userId: me.id });
      turno = validarTurnoIa(bruto, pedido) ?? fallbackZaeon(pedido);
    } catch { turno = fallbackZaeon(pedido); }
  }

  // grava: a expulsão; ou o perfil (mesclado) e, concluída a conversa, o nascimento (a próxima entrada já é na base)
  try {
    if (turno.classe === "abuso") await prisma.user.update({ where: { id: me.id }, data: { cyberExpulsoEm: new Date() } });
    else {
      const atual = await prisma.user.findUnique({ where: { id: me.id }, select: { cyberPerfil: true } });
      // (o que já estava guardado — do tutorial antigo — fica como está; o novo só acrescenta situação e área)
      const antes = atual?.cyberPerfil && typeof atual.cyberPerfil === "object" && !Array.isArray(atual.cyberPerfil) ? (atual.cyberPerfil as Record<string, unknown>) : {};
      await prisma.user.update({ where: { id: me.id }, data: { cyberPerfil: { ...antes, ...turno.perfil }, ...(turno.concluido && me.novo ? { cyberNasceuEm: new Date() } : {}) } });
    }
  } catch { /* gravar é melhor-esforço: a conversa segue */ }
  return NextResponse.json(turno);
}
