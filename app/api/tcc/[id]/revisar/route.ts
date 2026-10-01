/**
 * POST /api/tcc/:id/revisar { pedido, secaoId? } → { texto, sugestoes, descartadas }
 * O chat da Sala de Pesquisa lapidando o MESMO TCC com rigor: busca fonte verificada (Scholar),
 * propõe edições por seção, o crítico derruba o que não tem fonte, e tudo nasce como SUGESTÃO.
 */
import { NextResponse } from "next/server";
import { entrarTcc, respostaDeRecusa } from "@/lib/tcc/route-auth";
import { getTccForUser, sugerirNoTcc } from "@/lib/tcc/store";
import { lapidarComRigor, type RigorDeps } from "@/lib/tcc/rigor";
import { podeEscrever } from "@/lib/cartolina/access";

export const runtime = "nodejs";
export const maxDuration = 120;

const depsPadrao: RigorDeps = {
  retrieve: async (queries) => {
    const { retrievePapers } = await import("@/lib/scholar/retrieve");
    return (await retrievePapers(queries, { minResults: 8 })).papers;
  },
  gen: async (sys, user) => {
    const { geminiJson } = await import("@/lib/scholar/gemini");
    return geminiJson(sys, user, { temperature: 0.2, timeoutMs: 45_000 });
  },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarTcc(req, "tcc-revisar", "ai-heavy");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => null);
  const pedido = typeof body?.pedido === "string" ? body.pedido.trim().slice(0, 1000) : "";
  if (!pedido) return NextResponse.json({ error: "Diga o que revisar." }, { status: 400 });
  const tcc = await getTccForUser(params.id, a.userId);
  if (!tcc) return respostaDeRecusa("not_found");
  if (!podeEscrever(tcc.papel)) return respostaDeRecusa("forbidden"); // leitor não gasta modelo à toa
  try {
    const r = await lapidarComRigor(
      { titulo: tcc.titulo, secoes: tcc.secoes, pedido, secaoId: typeof body?.secaoId === "string" ? body.secaoId : undefined },
      depsPadrao,
    );
    const s = r.sugestoes.length ? await sugerirNoTcc(tcc.id, a.userId, r.sugestoes) : { ok: true as const, revisoes: [] };
    if (!s.ok) return respostaDeRecusa(s.reason);
    return NextResponse.json({ texto: r.texto, sugestoes: s.revisoes, descartadas: r.descartadas });
  } catch (e: any) {
    console.warn("[tcc] revisar falhou:", e?.message ?? e);
    return NextResponse.json({ error: "Não consegui revisar agora.", texto: "Não consegui revisar agora — tente de novo em instantes." }, { status: 502 });
  }
}
