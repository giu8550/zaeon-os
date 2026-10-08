/**
 * POST /api/lounge3d/[id]/zaeon/voz { texto } → { audio_base64, mime: "audio/wav" } — a VOZ da Zaeon no holograma do
 * tutorial (lib/cyber/vozZaeon). É a mesma voz do laboratório (Gemini-TTS, Leda, pt-BR — lib/voice/gemini-tts, um
 * utilitário), mas pelo caminho do CYBERESPAÇO, separado do laboratório (/api/ai/voice):
 *  - limite próprio ("cyber-voz"), pra o tutorial não comer o "ai-heavy" do laboratório;
 *  - custo no ledger como agente "cyber:zaeon-voz" (o mesmo jeito de lib/cyber/ia/motor);
 *  - só a voz da Zaeon (o cliente não escolhe voz) e sem o Piper de reserva: sem voz, o balão sai mudo e a boca
 *    mexe sozinha (a conversa nunca trava);
 *  - as falas FIXAS (iguais pra todo mundo) ficam num cache em memória: depois da 1ª pessoa, saem na hora, sem custo
 *    e sem contar no limite.
 * Membro da sala (IDOR → 404). Em DESENVOLVIMENTO, a sala "dev" dispensa sessão (a prévia /zz-cyber não tem login).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu, salaDoMembro } from "@/lib/lounge3d/server";
import { synthGeminiTTS } from "@/lib/voice/gemini-tts";
import { registrarTokens } from "@/lib/llm/ledger";
import { usageDoVertex, USAGE_VAZIO, type Usage } from "@/lib/llm/usage";
import { VOZ_ZAEON, falasFixasZaeon, textoDaVoz } from "@/lib/cyber/vozZaeon";

type Audio = { audio_base64: string; mime: string };
const FIXAS = new Set(falasFixasZaeon());
/** (no globalThis: o servidor de dev reavalia o módulo da rota — o cache sobrevive, como o do prisma) */
const cacheFixas = ((globalThis as { __cyberVozFixas?: Map<string, Audio> }).__cyberVozFixas ??= new Map<string, Audio>());
const PRAZO_MS = 12_000;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const dev = process.env.NODE_ENV === "development" && params.id === "dev";
  let userId: string | null = null;
  if (!dev) {
    const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
    userId = me.id;
  }
  const b = (await req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = textoDaVoz(typeof b.texto === "string" ? b.texto : "");
  if (!texto) return NextResponse.json({ error: "texto vazio" }, { status: 400 });

  // fala fixa já sintetizada: sai do cache (sem custo — nem conta no limite)
  const fixa = FIXAS.has(texto), pronta = fixa ? cacheFixas.get(texto) : undefined;
  if (pronta) return NextResponse.json(pronta);
  const rl = await guard(req, "lounge3d-zaeon-voz", "cyber-voz"); if (!rl.ok) return rl.response;

  const ini = Date.now(); let usage: Usage = USAGE_VAZIO, modelo = "gemini-tts";
  const ctx = { agentKey: "cyber:zaeon-voz", surface: "outro" as const, userId, phase: "cyberespaco" };
  try {
    const out = await synthGeminiTTS(texto, VOZ_ZAEON, PRAZO_MS, (meta, m) => { usage = usageDoVertex(meta); modelo = m; });
    void registrarTokens({ ...ctx, model: modelo, provedor: "vertex", rota: "vertex", usage, ms: Date.now() - ini, ok: true, erro: null, alvo: "vertex-tts", jsonValido: null }).catch(() => undefined);
    if (fixa) cacheFixas.set(texto, out);
    return NextResponse.json(out);
  } catch (e) {
    console.warn("[cyber/zaeon-voz] gemini-tts falhou:", String((e as Error)?.message ?? e).slice(0, 300));
    void registrarTokens({ ...ctx, model: modelo, provedor: "vertex", rota: "vertex", usage: USAGE_VAZIO, ms: Date.now() - ini, ok: false, erro: /timeout|abort/i.test(String((e as Error)?.message ?? e)) ? "timeout" : "outro", alvo: "vertex-tts", jsonValido: null }).catch(() => undefined);
    return NextResponse.json({ error: "voz indisponível" }, { status: 503 });
  }
}
