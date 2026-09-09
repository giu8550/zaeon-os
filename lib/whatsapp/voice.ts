/**
 * lib/whatsapp/voice.ts — reescreve "fatos" (agenda, revisão, prazo, conquista) na VOZ do mentor
 * ativo do aluno, como mensagem curta de WhatsApp. Gemini Flash via `geminiJson`; se a IA falhar
 * ou não houver credencial, cai num texto determinístico (os fatos crus) — o disparo nunca some.
 * `genJson` é injetável (teste sem rede).
 */
import { buildPersona } from "@/lib/ai/personas";

type GenJson = <T>(system: string, user: string, opts?: { temperature?: number; timeoutMs?: number }) => Promise<T>;

export type VoiceInput = {
  mentorContext?: string | null;   // bloco do mentor (resolveMentor().context); null = Aura base
  mentorName?: string | null;
  studentName?: string | null;
  kind: string;                    // agenda | review | deadline | tree | credential | welcome | test
  facts: string;                   // o conteúdo (já composto por dispatch.ts)
  genJson?: GenJson;
};

const KIND_HINT: Record<string, string> = {
  agenda: "É a mensagem da manhã com a agenda do dia. Liste os compromissos de forma legível (um por linha se forem vários) e feche com um incentivo curto.",
  review: "É um lembrete de revisão espaçada (ciência do aprendizado). Explique em 1 frase por que revisar agora e faça UMA pergunta rápida de recall sobre o primeiro item — o aluno responde aqui mesmo.",
  deadline: "É um aviso de prazo. Seja direto: o que vence, quando, e um próximo passo pequeno.",
  tree: "É progresso na árvore de conhecimento. Comemore com sobriedade e diga o que falta.",
  credential: "É uma credencial verificável conquistada (Solana). Comemore e diga em 1 frase o que ela representa.",
  welcome: "É a primeira mensagem depois de conectar o WhatsApp. Apresente-se em 1 frase, diga o que vai mandar (agenda, lembretes, revisões) e que responder PARE desliga.",
  test: "É um teste de envio. Cumprimente e confirme que o canal está funcionando.",
};

export const WHATSAPP_STYLE = `Você está falando pelo WhatsApp. Regras: português do Brasil; mensagem curta (1 a 4 frases, no máximo ~450 caracteres); sem títulos markdown, sem tabelas, sem listas com "-"; pode usar *negrito* com asteriscos simples e emoji com parcimônia (no máximo 1). Nunca invente compromissos, prazos ou notas que não estejam nos fatos.`;

const defaultGenJson: GenJson = async (system, user, opts) => {
  const { geminiJson } = await import("@/lib/scholar/gemini");
  return geminiJson(system, user, opts);
};

/** Fallback determinístico: os fatos, com um prefixo humano por kind. */
export function plainVoice(kind: string, facts: string, mentorName?: string | null): string {
  const who = mentorName ? `${mentorName} aqui. ` : "";
  switch (kind) {
    case "agenda": return `${who}${facts} Bom dia de estudo!`;
    case "review": return `${who}${facts.replace(/ Proponha UMA pergunta.*$/, "")} Topa um recall rápido? Me conta o que você lembra.`;
    case "deadline": return `${who}${facts} Quer que eu te ajude a organizar?`;
    case "tree": return `${who}${facts}`;
    case "credential": return `${who}🎓 ${facts}`;
    case "welcome": return `${who}Conectado! Vou te mandar sua agenda, lembretes de estudo e revisões por aqui — e você pode me perguntar qualquer coisa. Responda PARE pra desligar.`;
    default: return `${who}${facts}`;
  }
}

export async function inMentorVoice(input: VoiceInput): Promise<string> {
  const fallback = plainVoice(input.kind, input.facts, input.mentorName);
  const gen = input.genJson ?? defaultGenJson;
  const system = [
    buildPersona("aura"),
    input.mentorContext ? `=== MENTOR ATIVO ===\n${input.mentorContext}` : "",
    WHATSAPP_STYLE,
    `Responda SOMENTE JSON: {"text": "<a mensagem>"}.`,
  ].filter(Boolean).join("\n\n");
  const user = [
    input.studentName ? `Aluno: ${input.studentName.split(" ")[0]}.` : "",
    KIND_HINT[input.kind] ?? "Escreva uma mensagem curta com base nos fatos.",
    `FATOS:\n${input.facts}`,
  ].filter(Boolean).join("\n");
  try {
    const out = await gen<{ text?: string }>(system, user, { temperature: 0.5, timeoutMs: 20_000 });
    const text = typeof out?.text === "string" ? out.text.trim() : "";
    return text ? text.slice(0, 900) : fallback;
  } catch {
    return fallback;
  }
}
