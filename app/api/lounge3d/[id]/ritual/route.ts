/**
 * O RITUAL da chegada do dono (lib/cyber/ritual) — a "call" dentro da nave:
 *  PATCH { tempestade?: boolean; droids?: boolean } → liga/desliga a TEMPESTADE no templo (o instante fica no relógio
 *  do servidor: todo mundo vê as nuvens se formarem no mesmo tempo) e/ou solta/recolhe os ANUNCIADORES.
 * Só o DONO (fundador, pela SESSÃO). Vai pro conteúdo da sala (quem entra depois vê a tempestade armada) e é difundido
 * na hora (EV_RITUAL, com o relógio do servidor).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { lerConteudo } from "@/lib/lounge3d/sala";
import { EV_RITUAL, canalSala } from "@/lib/lounge3d/tipos";
import { RITUAL_OFF, ritualDesligado, type Ritual } from "@/lib/cyber/ritual";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-ritual"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.fundador) return NextResponse.json({ error: "Só o dono inicia o ritual." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { tempestade?: unknown; droids?: unknown };
  if (typeof b.tempestade !== "boolean" && typeof b.droids !== "boolean") return NextResponse.json({ error: "nada pra mudar" }, { status: 400 });
  const conteudo = lerConteudo(s.content), atual: Ritual = conteudo.ritual ?? RITUAL_OFF, agora = Date.now();
  const ritual: Ritual = {
    tempestade: typeof b.tempestade === "boolean" ? (b.tempestade ? (atual.tempestade > 0 ? atual.tempestade : agora) : 0) : atual.tempestade,   // (já ligada: não recomeça a formação)
    droids: typeof b.droids === "boolean" ? b.droids : atual.droids,
  };
  const novo = { ...conteudo, ...(ritualDesligado(ritual) ? { ritual: null } : { ritual }) };
  await prisma.collabDoc.update({ where: { id: s.id }, data: { content: JSON.stringify(novo) } });
  await triggerSafe(canalSala(s.id), EV_RITUAL, { ritual, agora });
  return NextResponse.json({ ok: true, ritual, agora });
}
