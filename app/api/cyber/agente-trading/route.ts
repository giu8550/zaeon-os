/**
 * POST /api/cyber/agente-trading { agente, texto, historico } → { fala, sinal } — a pessoa conversa com um AGENTE DE
 * TRADING da mesa de operações (lib/cyber/agentesTrading). Ele responde como o especialista que imita, com o mercado AO
 * VIVO (lib/cyber/mercadoServidor) — e, se pedirem opinião de operação, com um SINAL (comprar/vender/aguardar). Gerada
 * pela IA do cyberespaço (lib/cyber/ia/motor). Logado; limite "ai-light"; moderado. A IA caiu → a fala de reserva
 * (os números do painel, sem opinião).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu } from "@/lib/lounge3d/server";
import { moderar } from "@/lib/cyber/moderacao";
import { falarJson } from "@/lib/cyber/ia/motor";
import { painelDoMercado } from "@/lib/cyber/mercadoServidor";
import { agentePorId, falaDeReserva, normalizarResposta, promptDoAgente, type MensagemConversa } from "@/lib/cyber/agentesTrading";

export async function POST(req: Request) {
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const a = typeof b.agente === "string" ? agentePorId(b.agente) : null, texto = typeof b.texto === "string" ? b.texto.trim().slice(0, 400) : "";
  if (!a || !texto) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  if (moderar(texto).abuso) return NextResponse.json({ fala: "Vamos manter a conversa no mercado.", sinal: null });
  const historico: MensagemConversa[] = (Array.isArray(b.historico) ? b.historico : []).flatMap((m): MensagemConversa[] => {
    const o = m as Record<string, unknown>;
    return (o.de === "eu" || o.de === "agente") && typeof o.texto === "string" ? [{ de: o.de, texto: o.texto.slice(0, 700) }] : [];
  }).slice(-6);
  const rl = await guard(req, "agente-trading", "ai-light"); if (!rl.ok) return rl.response;
  const painel = await painelDoMercado().catch(() => null);
  try {
    const p = promptDoAgente(a, painel, texto, historico);
    const r = normalizarResposta(await falarJson<unknown>({ system: p.system, user: p.user, agente: `trading:${a.id}`, userId: me.id, temperatura: 0.5 }));
    return NextResponse.json(r ?? falaDeReserva(a, painel));
  } catch {
    return NextResponse.json(falaDeReserva(a, painel));
  }
}
