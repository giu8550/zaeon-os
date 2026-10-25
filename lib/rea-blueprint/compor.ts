/**
 * BLUEPRINT REA — a COMPOSIÇÃO: o modelo lê a conversa (o que está sendo entendido "por dentro") e devolve o documento
 * no estilo do REA — mecanismo + achados ROTULADOS pela proveniência + passos de reconstrução + o que ainda é
 * desconhecido. Opcionalmente recebe a EVIDÊNCIA real do motor do REA (quando um artefato foi analisado). PURO: só
 * monta prompt e lê/valida o JSON; o IO (modelo, motor) é injetado. Espelha lib/blueprint/compor.
 */
import { PROVS, sanitizarDoc, type Achado, type DocReaBlueprint, type PassoRecon } from "./tipos";

export const COMPOR_SYSTEM = [
  "Você é a camada de ENGENHARIA REVERSA da Zaeon (inspirada no morluto/rea). O aluno está entendendo COMO algo funciona",
  "por dentro e como reconstruir. Produza um BLUEPRINT honesto, em PT-BR, a partir da conversa (e da evidência do motor,",
  "se houver).",
  "REGRA DE OURO do REA: separe o que foi OBSERVADO do que foi DERIVADO, do que é INFERÊNCIA, e do que é DESCONHECIDO.",
  "NUNCA invente comportamento, símbolo ou estrutura que a conversa/evidência não sustenta — o que não se sabe vai em",
  "`incertezas`. NÃO ajude a burlar DRM/anti-cheat/autenticação nem a copiar software proprietário; isto é entendimento",
  "e reconstrução lícita (interoperabilidade, estudo, segurança, software próprio/autorizado).",
  "Responda SOMENTE JSON: {\"titulo\":\"...\",\"alvo\":\"o que é analisado\",\"resumo\":\"1-2 frases\",\"comoFunciona\":\"o mecanismo, markdown curto\",",
  "\"achados\":[{\"afirmacao\":\"...\",\"prov\":\"observacao|derivacao|inferencia|desconhecido\",\"detalhe\":\"opcional\",\"fonte\":\"opcional\"}],",
  "\"reconstrucao\":[{\"titulo\":\"passo\",\"corpo\":\"como fazer\",\"verifica\":\"como checar que recriou certo\"}],",
  "\"incertezas\":[\"o que ainda não se sabe\"]}.",
  "Seja conciso e técnico. Prefira poucos achados fortes a muitos fracos.",
].join("\n");

export type Conversa = { role: string; text: string }[];

export function promptComposicao(i: { doc: DocReaBlueprint; conversa: Conversa; evidencia?: string }): string {
  const atual = i.doc.turnos > 0
    ? `BLUEPRINT ATUAL (refine, não recomece do zero; preserve o que ainda vale):\n${JSON.stringify({ titulo: i.doc.titulo, alvo: i.doc.alvo, comoFunciona: i.doc.comoFunciona, achados: i.doc.achados.slice(0, 12), reconstrucao: i.doc.reconstrucao.slice(0, 8), incertezas: i.doc.incertezas }).slice(0, 4000)}\n\n`
    : "";
  const ev = i.evidencia ? `EVIDÊNCIA DO MOTOR DO REA (fatos; o que vier daqui é OBSERVAÇÃO):\n${i.evidencia.slice(0, 6000)}\n\n` : "";
  const conversa = i.conversa.map((m) => `${m.role === "user" ? "Aluno" : "Aura"}: ${m.text.slice(0, 1500)}`).join("\n").slice(0, 8000);
  return `${atual}${ev}CONVERSA:\n${conversa}`;
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** lê o JSON do modelo num plano parcial (o saneamento final é do tipos.sanitizarDoc) — null se não deu pra ler */
export function lerPlano(v: unknown): Partial<DocReaBlueprint> | null {
  const o = obj(v); if (!o) return null;
  const achados = arr(o.achados).map((a): Achado | null => { const x = obj(a); const af = x && s(x.afirmacao); return af ? { id: "", afirmacao: af, prov: (PROVS.includes(x!.prov as any) ? x!.prov : "inferencia") as Achado["prov"], detalhe: x ? s(x.detalhe) : undefined, fonte: x ? s(x.fonte) : undefined } : null; }).filter((x): x is Achado => x !== null);
  const recon = arr(o.reconstrucao).map((p): PassoRecon | null => { const x = obj(p); const t = x && s(x.titulo); return t ? { id: "", titulo: t, corpo: x ? s(x.corpo) : undefined, verifica: x ? s(x.verifica) : undefined } : null; }).filter((x): x is PassoRecon => x !== null);
  const incertezas = arr(o.incertezas).map(s).filter((x): x is string => !!x);
  if (!s(o.comoFunciona) && !achados.length && !s(o.resumo)) return null; // modelo não produziu nada útil
  return { titulo: s(o.titulo), alvo: s(o.alvo), resumo: s(o.resumo), comoFunciona: s(o.comoFunciona), achados, reconstrucao: recon, incertezas };
}

/** aplica a composição sobre o doc atual (substitui o conteúdo, soma 1 turno), passando pelo saneamento */
export function mesclarComposicao(atual: DocReaBlueprint, plano: Partial<DocReaBlueprint>, agora: number, ferramentas?: string[]): DocReaBlueprint {
  const bruto: DocReaBlueprint = {
    ...atual,
    titulo: plano.titulo || atual.titulo,
    alvo: plano.alvo ?? atual.alvo,
    resumo: plano.resumo ?? atual.resumo,
    comoFunciona: plano.comoFunciona ?? atual.comoFunciona,
    achados: plano.achados?.length ? plano.achados : atual.achados,
    reconstrucao: plano.reconstrucao?.length ? plano.reconstrucao : atual.reconstrucao,
    incertezas: plano.incertezas?.length ? plano.incertezas : atual.incertezas,
    ferramentas: ferramentas?.length ? [...new Set([...atual.ferramentas, ...ferramentas])] : atual.ferramentas,
    compostoEm: agora, turnos: atual.turnos + 1,
  };
  return sanitizarDoc(bruto) ?? atual;
}
