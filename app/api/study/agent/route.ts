/**
 * POST /api/study/agent — o WORKER generativo da Sala de Estudos.
 *
 * Converte um comando em linguagem natural ("Zaeon, estude sobre fotossíntese",
 * "pesquise X", "resuma Y") em BLOCOS estruturados que viram cards no feed "Meus
 * Estudos": título, subtítulos, parágrafos (insights/resumo) e links úteis.
 *
 * O front insere os blocos um a um (efeito de "escrevendo ao vivo"). A IA é só o
 * Gemini Flash. Auth + rate-limit + cache (best-effort) — comando igual não repaga.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { geminiText } from "@/lib/ai/gemini-text";
import { guard } from "@/src/lib/ratelimit";
import { cacheJson, hashKey } from "@/src/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

type Block = { kind: "heading" | "subheading" | "text" | "link"; text: string; url?: string };

const SYSTEM =
  "Você é a Zaeon montando o caderno de estudos do aluno a partir de um comando. " +
  "Produza um material claro, didático e bem estruturado em português do Brasil. " +
  "Responda SOMENTE um JSON válido (sem markdown, sem crases), no formato: " +
  '{"title":"<título curto do estudo>","blocks":[{"kind":"heading|subheading|text|link","text":"...","url":"(só quando kind=link)"}]}. ' +
  "Regras: comece por 1 heading (o tema). Use subheadings pra organizar. Em 'text' escreva parágrafos " +
  "objetivos com os pontos-chave/insights (2 a 5 frases cada). Em 'link' dê recursos úteis e REAIS quando " +
  "tiver certeza (Wikipedia, docs oficiais, artigos conhecidos) — no máximo 3, com 'text' = nome e 'url' = endereço. " +
  "Entre 6 e 12 blocos no total. Não invente URLs improváveis; na dúvida, descreva o recurso num 'text'.";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await guard(req, "study-agent", "ai-light");
  if (!rl.ok) return rl.response;

  const body = await req.json().catch(() => ({} as any));
  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (command.length < 2) return NextResponse.json({ error: "Comando muito curto." }, { status: 400 });

  try {
    const result = await cacheJson(hashKey("studyagent", command.toLowerCase()), 60 * 60 * 24 * 7, async () => {
      const raw = await geminiText({ temperature: 0.5, system: SYSTEM, prompt: `Comando do aluno: ${command}` });
      let parsed: any = {};
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { parsed = {}; }
      const title = typeof parsed.title === "string" ? parsed.title.slice(0, 120) : command.slice(0, 120);
      const blocks: Block[] = (Array.isArray(parsed.blocks) ? parsed.blocks : [])
        .filter((b: any) => b && typeof b.text === "string" && b.text.trim())
        .slice(0, 14)
        .map((b: any) => {
          const kind = ["heading", "subheading", "text", "link"].includes(b.kind) ? b.kind : "text";
          const out: Block = { kind, text: String(b.text).slice(0, 1200) };
          if (kind === "link" && typeof b.url === "string" && /^https?:\/\//i.test(b.url)) out.url = b.url;
          return out;
        });
      // garante ao menos um heading com o tema
      if (!blocks.some((b) => b.kind === "heading")) blocks.unshift({ kind: "heading", text: title });
      return { title, blocks };
    });

    if (!result.blocks?.length) return NextResponse.json({ error: "ai_empty", message: "Não consegui montar o estudo agora." }, { status: 502 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: "ai_error", message: "Falha ao montar o estudo." }, { status: 502 });
  }
}
