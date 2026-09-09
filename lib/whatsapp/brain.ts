/**
 * lib/whatsapp/brain.ts — o CÉREBRO do mentor no WhatsApp = o MESMO harness/mentor da web.
 *
 * Não é motor novo: reusa `resolveMentor` (persona do mentor ativo), a memória L3
 * (`wakeUpContext`/`writeTurnMemory`, wing = <slug>/<userId>), o harness (`buildHarnessDeps` +
 * `runTrajectoryTraced`) e o transcript L1 (surface "whatsapp"). Sem sessão HTTP: o `userId` vem
 * do vínculo telefone↔usuário (WhatsAppLink), nunca de cookie.
 *
 * AURA_HARNESS="0" (kill-switch) ou erro no laço → fallback Gemini Flash direto (mesma persona).
 */
import { prisma } from "@/src/lib/prisma";
import { buildPersona } from "@/lib/ai/personas";
import { toWhatsAppText } from "./format";
import { WHATSAPP_STYLE } from "./voice";
import type { StructuredAnswer } from "@/lib/agent/contracts";

export type BrainInput = { userId: string; text: string };
export type BrainOutput = { text: string; via: "harness" | "gemini" | "fallback"; mentor: string | null };

const HISTORY_TURNS = 12;

export async function answerOnWhatsApp({ userId, text }: BrainInput): Promise<BrainOutput> {
  const [{ resolveMentor }, transcript, mem] = await Promise.all([
    import("@/lib/agent/mentors-server"),
    import("@/lib/agent/transcript"),
    import("@/lib/agent/memory-provider"),
  ]);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, course: true, institution: true, activeMentorId: true },
  });
  const mentor = user?.activeMentorId ? await resolveMentor(user.activeMentorId, userId).catch(() => null) : null;

  const persona = buildPersona("aura");
  const userBlock = user
    ? `=== DADOS DO USUÁRIO ===\n${[user.name ? `- Nome: ${user.name}` : "", user.course ? `- Curso: ${user.course}` : "", user.institution ? `- Instituição: ${user.institution}` : ""].filter(Boolean).join("\n")}`
    : "";
  const memBlock = await mem.wakeUpContext({ userId, surface: "whatsapp", hint: text, wingLabel: mentor?.wing.label }).catch(() => "");
  const systemContext = [mentor?.context, userBlock, memBlock, WHATSAPP_STYLE].filter(Boolean).join("\n\n");

  const recent = await transcript.getRecent(userId, "whatsapp", null, HISTORY_TURNS).catch(() => ({ conversationId: null, messages: [] }));
  const history = recent.messages
    .filter((m) => m.text && m.text.trim())
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text.trim() }));

  let answer: StructuredAnswer | null = null;   // o que vai pra memória L3 (estruturado)
  let rendered = "";                             // o que vai pro Zap (texto)
  let via: BrainOutput["via"] = "fallback";

  if (process.env.AURA_HARNESS !== "0") {
    try {
      const [{ buildHarnessDeps, renderStructuredAnswer }, { runTrajectoryTraced }] = await Promise.all([
        import("@/lib/agent/aura-harness"),
        import("@/lib/agent/trajectory"),
      ]);
      const hctx: any = {
        userId,
        activeTab: "whatsapp",
        plan: "free",
        execMode: "auto",
        currentGoal: text.slice(0, 200),
        mentor: mentor?.slug,
        wing: mentor?.wing.label,
      };
      const deps = buildHarnessDeps(hctx, { systemContext, history });
      const { answer: a } = await runTrajectoryTraced(text, hctx, deps);
      answer = a;
      rendered = renderStructuredAnswer(a); // mesmo render texto do cliente web (sem sentinelas)
      via = "harness";
    } catch (e) {
      console.warn("[whatsapp:brain] harness falhou, caindo no Gemini direto:", (e as any)?.message ?? e);
    }
  }

  if (!answer) {
    try {
      const [{ getGeminiChatModel, extractText }, { sanitizeHistory }] = await Promise.all([
        import("@/lib/scholar/gemini"),
        import("@/lib/ai/history"),
      ]);
      const model = getGeminiChatModel(`${persona}\n\n=== CONTEXTO ===\n${systemContext}`);
      const chat = model.startChat({ history: sanitizeHistory(history) }); // começa em user, alternado
      const res = await chat.sendMessage(text);
      const out = extractText(res).trim();
      if (out) { answer = { nucleo: out }; rendered = out; via = "gemini"; }
    } catch (e) {
      console.warn("[whatsapp:brain] gemini falhou:", (e as any)?.message ?? e);
    }
  }

  if (!answer) {
    const { messageForError } = await import("@/lib/agent/errors");
    rendered = messageForError("network");
    answer = { nucleo: rendered };
  }

  const finalText = toWhatsAppText(rendered || answer.nucleo);

  // L1 (transcript) + L3 (memória) — best-effort, nunca derruba a resposta
  try {
    const convId = await transcript.ensureConversation(userId, "whatsapp", null, { agentId: mentor?.slug ?? "aura" });
    await transcript.appendMessages(convId, [{ role: "user", text }, { role: "assistant", text: finalText, meta: { via, mentor: mentor?.slug ?? null } }]);
  } catch { /* transcript opcional */ }
  void mem.writeTurnMemory({ userId, surface: "whatsapp", scopeId: null, prompt: text, answer, wing: mentor?.wing });

  return { text: finalText, via, mentor: mentor?.slug ?? null };
}
