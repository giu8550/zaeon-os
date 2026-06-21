import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Catálogo de vozes (GET) — espelha o voice-engine (/voices). Se o engine estiver
// offline, devolvemos um catálogo estático equivalente ao engine.py → VOICES, pra
// a UI de escolha de voz nunca ficar vazia.
const VOICE_URL = process.env.VOICE_ENGINE_URL ?? "http://localhost:8004";

const FALLBACK = {
  default: "aura-f",
  voices: [
    { id: "aura-f", label: "Aura (feminina)", gender: "f", lang: "pt-BR", tier: "free" },
    { id: "aura-m", label: "Áureo (masculina)", gender: "m", lang: "pt-BR", tier: "free" },
    { id: "nova-f", label: "Nova (feminina, premium)", gender: "f", lang: "pt-BR", tier: "premium" },
    { id: "piper-f", label: "Piper (fallback)", gender: "f", lang: "pt-BR", tier: "free" },
  ],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${VOICE_URL}/voices`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.voices?.length) return json(data, 200);
    }
  } catch {
    clearTimeout(timer);
  }
  // engine offline / sem dados → catálogo estático
  return json(FALLBACK, 200);
}
