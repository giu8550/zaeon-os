/**
 * lib/cyber/ia/motor.ts — o HARNESS DO CYBERESPAÇO (só servidor). Os agentes que moram no hiperespaço (a Zaeon do
 * holograma, o Droid…) conversam aqui, SEPARADOS do harness do laboratório (lib/llm/envelope + personas + ferramentas):
 * a capacidade de conversa no cyberespaço é OUTRA — falas curtas de personagem, uma pergunta por vez, resposta em
 * segundos. Por isso este motor é COPIADO do laboratório (o transporte Vertex, o timeout, a extração do texto), não
 * importado dele, e tem limites próprios: modelo leve, saída curta, prazo curto, sempre JSON.
 *  - Modelo: CYBER_IA_MODEL (padrão gemini-2.5-flash-lite — o mais rápido); se ele não existir no projeto, cai pro
 *    CYBER_IA_MODEL_RESERVA (gemini-2.5-flash) na mesma chamada.
 *  - Custo: vai pro ledger da plataforma (lib/llm/ledger — a contabilidade é uma só) com agentKey "cyber:<agente>",
 *    pra aparecer separado do laboratório.
 *  - A MEMÓRIA também é uma só no banco, mas em gavetas próprias (User.cyberPerfil): ninguém mistura.
 */
import { registrarTokens } from "@/lib/llm/ledger";
import { usageDoVertex, USAGE_VAZIO, type Usage } from "@/lib/llm/usage";
import { vertexCredentials, vertexTextClientOpts } from "@/lib/ai/vertex-credentials";
import { GEMINI_MODEL_FLASH } from "@/lib/ai/model";

export const CYBER_IA = {
  modelo: process.env.CYBER_IA_MODEL || "gemini-2.5-flash-lite",
  reserva: process.env.CYBER_IA_MODEL_RESERVA || GEMINI_MODEL_FLASH,
  /** a fala de um personagem é curta: pouco texto de saída e resposta rápida */
  maxSaida: 450,
  timeoutMs: Number(process.env.CYBER_IA_TIMEOUT_MS || 8000),
  temperatura: 0.6,
} as const;

export type PedidoIa = { system: string; user: string; agente: string; userId?: string | null; temperatura?: number };
export type RespostaIa = { texto: string; usage: Usage; modelo: string; ms: number };
/** o transporte (injetável nos testes) */
export type TransporteIa = (p: PedidoIa, modelo: string) => Promise<{ texto: string; usage: Usage }>;

const comPrazo = <T,>(p: Promise<T>, ms: number): Promise<T> => Promise.race([p, new Promise<T>((_, nao) => setTimeout(() => nao(new Error(`cyber-ia timeout (${ms}ms)`)), ms))]);
/** o texto da resposta do Vertex (sem as partes de "pensamento") — copiado do laboratório */
const textoDe = (r: any): string => (r?.response?.candidates?.[0]?.content?.parts ?? []).filter((x: any) => x && !x.thought).map((x: any) => (typeof x.text === "string" ? x.text : "")).join("").trim();

/** o Vertex direto (import tardio: o SDK é pesado) */
const vertex: TransporteIa = async (p, modelo) => {
  const { VertexAI } = await import("@google-cloud/vertexai");
  const c = vertexCredentials();
  const v = new VertexAI({ project: c.project, ...vertexTextClientOpts(), googleAuthOptions: { credentials: { client_email: c.client_email, private_key: c.private_key } } });
  const m = v.getGenerativeModel({
    model: modelo,
    generationConfig: { temperature: p.temperatura ?? CYBER_IA.temperatura, responseMimeType: "application/json", maxOutputTokens: CYBER_IA.maxSaida },
    systemInstruction: { role: "system", parts: [{ text: p.system }] },
  });
  const r: any = await comPrazo(m.generateContent({ contents: [{ role: "user", parts: [{ text: p.user }] }] }), CYBER_IA.timeoutMs);
  return { texto: textoDe(r), usage: usageDoVertex(r?.response?.usageMetadata) };
};

/** o modelo pedido não existe/não está liberado no projeto? (aí tenta o de reserva) */
const modeloIndisponivel = (e: unknown) => /not found|404|is not supported|does not have access|NOT_FOUND|publisher model/i.test(String((e as Error)?.message ?? e));

/** uma fala de agente do cyberespaço, em JSON (já parseado). Erro/timeout/JSON inválido → lança (quem chama tem reserva) */
export async function falarJson<T>(p: PedidoIa, deps: { transporte?: TransporteIa; registrar?: typeof registrarTokens; agora?: () => number } = {}): Promise<T> {
  const t = deps.transporte ?? vertex, registrar = deps.registrar ?? registrarTokens, agora = deps.agora ?? Date.now;
  const ini = agora(), ctx = { agentKey: `cyber:${p.agente}`, surface: "outro" as const, userId: p.userId ?? null, phase: "cyberespaco" };
  let modelo: string = CYBER_IA.modelo, r: { texto: string; usage: Usage };
  try { r = await t(p, modelo); }
  catch (e) {
    if (!modeloIndisponivel(e) || CYBER_IA.reserva === modelo) { void registrar({ ...ctx, model: modelo, provedor: "vertex", rota: "vertex", usage: USAGE_VAZIO, ms: agora() - ini, ok: false, erro: "outro", alvo: "vertex", jsonValido: null }).catch(() => undefined); throw e; }
    modelo = CYBER_IA.reserva; r = await t(p, modelo);
  }
  const limpo = r.texto.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  let valor: T, ok = true;
  try { valor = JSON.parse(limpo) as T; } catch { ok = false; valor = undefined as T; }
  void registrar({ ...ctx, model: modelo, provedor: "vertex", rota: "vertex", usage: r.usage, ms: agora() - ini, ok: true, erro: null, alvo: "vertex", jsonValido: ok }).catch(() => undefined);
  if (!ok) throw new Error(`cyber-ia: JSON inválido: ${limpo.slice(0, 120)}`);
  return valor;
}
