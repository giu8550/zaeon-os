import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isLevel } from "@/lib/scholar/levels";
import { buildForgeRequest } from "@/lib/scholar/forge";
import type { Paper } from "@/lib/scholar/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const FORGE_URL = process.env.SUGGESTION_FORGE_URL ?? "http://localhost:8003";

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  // session.user não carrega id — checa existência por email (mesmo padrão das outras rotas).
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const level = isLevel(body.level) ? body.level : "msc";
  const references: Paper[] = Array.isArray(body.references) ? body.references : [];
  const excludeTitles = Array.isArray(body.exclude_titles)
    ? body.exclude_titles.filter((t: unknown): t is string => typeof t === "string")
    : [];
  const count = typeof body.count === "number" ? body.count : 5;
  const language = body.language === "en" ? "en" : "pt-BR";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;

  if (topic.length < 2) return json({ error: "Tópico inválido (mínimo 2 caracteres)." }, 400);

  const built = buildForgeRequest({ topic, level, references, count, excludeTitles, language });
  if ("error" in built) return json({ error: built.error }, 400);

  // /reforge força diversificação quando o usuário pede "forjar mais".
  const endpoint = built.exclude_titles.length > 0 ? "/reforge" : "/forge";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  // O Suggestion Forge é um serviço externo (porta 8003) que NÃO roda na Vercel.
  // Em vez de cuspir 503/504 (que sujava o console e quebrava a tela), degradamos
  // gracioso: devolve um ForgeResponse vazio (200). A aba visível "Sugestões de
  // pesquisa" usa /api/ai/research-suggest (Gemini), que funciona normalmente.
  const EMPTY = { suggestions: [], coverage_summary: "", generated_at: new Date().toISOString() };

  let forgeRes: Response;
  try {
    forgeRes = await fetch(`${FORGE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return json(EMPTY, 200); // offline → vazio, sem erro
  }
  clearTimeout(timer);

  if (!forgeRes.ok) {
    return json(EMPTY, 200); // serviço respondeu erro → vazio, sem propagar 5xx
  }

  const result = await forgeRes.json();

  // Persistência best-effort em ScholarSession.suggestions (não falha a resposta).
  if (sessionId) {
    await prisma.scholarSession
      .updateMany({ where: { id: sessionId, userId: dbUser.id }, data: { suggestions: result } })
      .catch(() => {});
  }

  return json(result, 200);
}
