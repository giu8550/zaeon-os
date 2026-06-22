import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Proxy para o engine Python de voz (não roda na Vercel; ver voice-engine/).
const VOICE_URL = process.env.VOICE_ENGINE_URL ?? "http://localhost:8004";

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const rl = await guard(req, "ai-voice", "ai-heavy");
  if (!rl.ok) return rl.response;

  // session.user não carrega id — checa existência por email (padrão do projeto).
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice : undefined;
  if (text.length < 1) return json({ error: "Texto vazio." }, 400);
  if (text.length > 4000) return json({ error: "Texto muito longo (máx. 4000)." }, 400);

  // Sintetiza UMA vez, com timeout próprio. Devolve o JSON da engine ou null (falhou).
  async function synth(voiceId: string | undefined, timeoutMs: number): Promise<any | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${VOICE_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.audio_base64 ? data : null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  // 1ª tentativa: a voz pedida (pode ser Kokoro, mais lenta na CPU do VPS).
  let data = await synth(voice, 45_000);
  // Fallback: se a voz pedida falhar/estourar o tempo e não for já o Piper rápido,
  // tenta 'natural-br' (Piper) — garante áudio em vez de 503 silencioso.
  if (!data && voice !== "natural-br") data = await synth("natural-br", 30_000);
  if (!data) return json({ error: "Engine de voz indisponível." }, 503);
  return json(data, 200);
}
