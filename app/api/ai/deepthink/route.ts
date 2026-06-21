/**
 * POST /api/ai/deepthink — modo "pensamento profundo" com Gemini PRO, em CHUNKS.
 *
 * A conexão é limitada (~10s por função na Vercel) e o Pro é mais lento. Em vez de
 * uma única chamada longa, o CLIENTE orquestra a cadeia de pensamento em passos
 * curtos (cada um < 10s):
 *   step "plan"   → o Pro devolve um plano/raciocínio enxuto (poucos tokens);
 *   step "answer" → o Pro escreve a resposta final SEGUINDO o plano.
 * Assim "fatiamos" a cadeia de pensamento do Pro para caber na nossa janela.
 *
 * O foco do app segue sendo o Flash (/api/ai/chat); este modo é opcional.
 */
import { NextResponse } from "next/server";
import { geminiText } from "@/lib/ai/gemini-text";
import { GEMINI_MODEL_PRO } from "@/lib/ai/model";
import { guard } from "@/src/lib/ratelimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { deepThinkStatus, markDeepThinkUsed } from "@/lib/ai/deepThinkAccess";
import { sanitizeHistory } from "@/lib/ai/history";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Modo econômico: deep thinking (Gemini Pro) só para quem o admin liberou.
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const email = session.user.email;
    const ds = await deepThinkStatus(email);
    if (ds.mode === "none") {
      return NextResponse.json({ error: "deepthink_plan", message: "Pensamento profundo é dos planos pagos. Suba para o Plus pra usar 1×/dia (ou Pro/Max sem limite)." }, { status: 403 });
    }
    const rl = await guard(req, "ai-deepthink", "ai-heavy");
    if (!rl.ok) return rl.response;
    const body = await req.json().catch(() => ({} as any));
    const step = body.step === "answer" ? "answer" : "plan";
    // Cota diária (Plus): valida e consome no passo "plan" (o "answer" é continuação do mesmo turno).
    if (step === "plan" && ds.mode === "daily") {
      if (ds.usedToday) {
        return NextResponse.json({ error: "deepthink_daily", message: "Você já usou o pensamento profundo hoje (1×/dia no Plus). Volta amanhã ou suba pro Pro pra usar sem limite." }, { status: 429 });
      }
      await markDeepThinkUsed(email);
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const plan = typeof body.plan === "string" ? body.plan : "";
    const context = typeof body.context === "string" ? body.context.slice(0, 6000) : "";
    // Memória entre turnos: mesmo padrão do /api/ai/chat (ver lib/ai/history.ts).
    const chatHistory = sanitizeHistory(body.history);
    if (prompt.length < 2) return NextResponse.json({ error: "Prompt inválido." }, { status: 400 });

    if (step === "plan") {
      // Passo 1 — raciocínio curto (cabe folgado em <10s).
      const text = await geminiText({
        model: GEMINI_MODEL_PRO,
        temperature: 0.3,
        history: chatHistory,
        system: "Você é a Zaeon em modo de pensamento profundo. Liste em 3 a 6 bullets curtos o raciocínio/plano para responder bem à pergunta. Só os bullets, sem introdução.",
        prompt: context ? `CONTEXTO:\n${context}\n\nPERGUNTA:\n${prompt}` : prompt,
      });
      return NextResponse.json({ step: "plan", plan: text });
    }

    // Passo 2 — resposta final seguindo o plano.
    const text = await geminiText({
      model: GEMINI_MODEL_PRO,
      temperature: 0.5,
      history: chatHistory,
      system: "Você é a Zaeon — calorosa, clara e profunda. Escreva a resposta final em português do Brasil seguindo o PLANO dado, em texto corrido e bem fundamentado, sem citar que existe um plano nem qual IA você usa.",
      prompt: `${context ? `CONTEXTO:\n${context}\n\n` : ""}PERGUNTA:\n${prompt}\n\nPLANO A SEGUIR:\n${plan || "(elabore por conta própria)"}\n\nResponda agora.`,
    });
    return NextResponse.json({ step: "answer", text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Falha no modo profundo." }, { status: 500 });
  }
}
