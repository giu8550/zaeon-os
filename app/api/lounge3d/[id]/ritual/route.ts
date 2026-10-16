/**
 * O RITUAL do dono (lib/cyber/ritual) — a "call" dentro da nave:
 *  PATCH { tempestade?: boolean; droids?: boolean; veu?: boolean; nave?: boolean } → liga/desliga a FUMAÇA E OS TROVÕES (o instante fica no
 *  relógio do servidor: todo mundo vê a fumaça se formar no mesmo tempo; desligada, cada cliente a desmancha devagar), liga/desliga os ANUNCIADORES e/ou TIRA O
 *  VÉU da nave (`veu: true` — o evento, com o instante; a nave volta a ser invisível quando a tempestade desliga).
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
  const b = (await req.json().catch(() => ({}))) as { tempestade?: unknown; droids?: unknown; veu?: unknown; nave?: unknown };
  if (typeof b.tempestade !== "boolean" && typeof b.droids !== "boolean" && typeof b.veu !== "boolean" && typeof b.nave !== "boolean") return NextResponse.json({ error: "nada pra mudar" }, { status: 400 });
  const conteudo = lerConteudo(s.content), atual: Ritual = conteudo.ritual ?? RITUAL_OFF, agora = Date.now();
  const ritual: Ritual = {
    tempestade: typeof b.tempestade === "boolean" ? (b.tempestade ? (atual.tempestade > 0 ? atual.tempestade : agora) : 0) : atual.tempestade,   // (já ligada: não recomeça a formação)
    droids: typeof b.droids === "boolean" ? b.droids : atual.droids,
    veu: typeof b.veu === "boolean" ? (b.veu ? (atual.veu > 0 ? atual.veu : agora) : 0) : atual.veu,
    nave: typeof b.nave === "boolean" ? b.nave : atual.nave,   // o ritual DA NAVE (K): a mandala e as nuvens em volta dela
  };
  if (ritual.tempestade <= 0) ritual.veu = 0;   // sem tempestade, a nave volta a ser invisível
  const novo = { ...conteudo, ...(ritualDesligado(ritual) ? { ritual: null } : { ritual }) };
  await prisma.collabDoc.update({ where: { id: s.id }, data: { content: JSON.stringify(novo) } });
  await triggerSafe(canalSala(s.id), EV_RITUAL, { ritual, agora });
  return NextResponse.json({ ok: true, ritual, agora });
}
