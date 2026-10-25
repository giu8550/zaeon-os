/**
 * BLUEPRINT REA — o documento de uma ENGENHARIA REVERSA (PURO, client-safe). Pedido do dono (out/2026): quando algo de
 * substância está sendo estudado "por dentro" (como funciona, como reconstruir), a Aura produz um BLUEPRINT — um
 * módulo próprio no chat, como um paper de pesquisa, mas com o estilo do REA: achados ROTULADOS pela proveniência
 * (observação · derivação · inferência · desconhecido — fiel ao morluto/rea) e os passos pra reconstruir.
 *
 * Um documento por conversa, guardado em `Cartolina.cards` (surface `rea`, `scopeId` = o thread id). Tudo que entra
 * (modelo, cliente, banco) passa por `sanitizarDoc`: o corrompido é podado, nunca lança. Espelha lib/blueprint/tipos.
 */
export const SURFACE_REA = "rea" as const;
/** o servidor: compõe o blueprint REA no turno de engenharia reversa e abre /api/rea */
export const reaBlueprintOn = (): boolean => process.env.REA_BLUEPRINT === "1";
/** a UI: o card no chat e a aba na Sala de Estudos (valor de BUILD) */
export const reaBlueprintUiOn = (): boolean => process.env.NEXT_PUBLIC_REA_BLUEPRINT === "1";

/** a PROVENIÊNCIA de um achado — o coração do REA: separar o que se VIU do que se DEDUZIU, INFERIU ou não se sabe */
export type Prov = "observacao" | "derivacao" | "inferencia" | "desconhecido";
export const PROVS: readonly Prov[] = ["observacao", "derivacao", "inferencia", "desconhecido"];
export const ROTULO_PROV: Record<Prov, string> = { observacao: "Observação", derivacao: "Derivação", inferencia: "Inferência", desconhecido: "Desconhecido" };

export type Achado = { id: string; afirmacao: string; prov: Prov; detalhe?: string; fonte?: string };
/** um passo pra RECONSTRUIR (a "obrigação de reconstrução" do REA): o que recriar e como verificar */
export type PassoRecon = { id: string; titulo: string; corpo?: string; verifica?: string };

export type DocReaBlueprint = {
  v: 1;
  titulo: string;           // "Como o Shazam reconhece música", "Mecanismo do protocolo X"
  alvo: string;             // o que foi analisado (um app, binário, protocolo, mecanismo)
  resumo: string;           // o que é, em 1–2 frases
  comoFunciona: string;     // o MECANISMO entendido (markdown curto)
  achados: Achado[];        // a Evidence, rotulada pela proveniência
  reconstrucao: PassoRecon[]; // como reconstruir, passo a passo
  incertezas: string[];     // os DESCONHECIDOS (o REA nunca finge saber)
  ferramentas: string[];    // o que o REA usou (ex.: analyze, inspect-macho, ghidra) — vazio = só metodologia
  compostoEm: number; turnos: number;
};

export const MAX_ACHADOS = 24, MAX_RECON = 12, MAX_INCERTEZAS = 10, MAX_FERR = 12;
const MAX_TITULO = 200, MAX_TEXTO = 2400, MAX_CURTO = 400, MAX_FONTE = 300;
const ID_RE = /^[\w:.-]{1,64}$/;

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
export const idOk = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
const prov = (v: unknown): Prov => (PROVS.includes(v as Prov) ? (v as Prov) : "inferencia");
const ids = new Set<string>();
const idUnico = (v: unknown, prefixo: string): string => {
  let id = idOk(v) ? v : `${prefixo}-${Math.random().toString(36).slice(2, 8)}`;
  while (ids.has(id)) id = `${prefixo}-${Math.random().toString(36).slice(2, 8)}`;
  ids.add(id); return id;
};

export function docVazio(titulo = "Engenharia reversa", em = Date.now()): DocReaBlueprint {
  return { v: 1, titulo: (titulo || "Engenharia reversa").slice(0, MAX_TITULO), alvo: "", resumo: "", comoFunciona: "", achados: [], reconstrucao: [], incertezas: [], ferramentas: [], compostoEm: em, turnos: 0 };
}

/** poda o que veio (modelo/banco/cliente) num DocReaBlueprint válido — nunca lança; corrompido → null */
export function sanitizarDoc(v: unknown): DocReaBlueprint | null {
  const o = obj(v); if (!o) return null;
  ids.clear();
  const achados: Achado[] = arr(o.achados).map((a): Achado | null => { const x = obj(a); const af = x && str(x.afirmacao, MAX_CURTO); return af ? { id: idUnico(x!.id, "ac"), afirmacao: af, prov: prov(x!.prov), detalhe: x ? str(x.detalhe, MAX_TEXTO) : undefined, fonte: x ? str(x.fonte, MAX_FONTE) : undefined } : null; }).filter((x): x is Achado => x !== null).slice(0, MAX_ACHADOS);
  const reconstrucao: PassoRecon[] = arr(o.reconstrucao).map((p): PassoRecon | null => { const x = obj(p); const t = x && str(x.titulo, MAX_CURTO); return t ? { id: idUnico(x!.id, "rc"), titulo: t, corpo: x ? str(x.corpo, MAX_TEXTO) : undefined, verifica: x ? str(x.verifica, MAX_CURTO) : undefined } : null; }).filter((x): x is PassoRecon => x !== null).slice(0, MAX_RECON);
  const incertezas = arr(o.incertezas).map((s) => str(s, MAX_CURTO)).filter((s): s is string => !!s).slice(0, MAX_INCERTEZAS);
  const ferramentas = arr(o.ferramentas).map((s) => str(s, 60)).filter((s): s is string => !!s).slice(0, MAX_FERR);
  return {
    v: 1,
    titulo: str(o.titulo, MAX_TITULO) ?? "Engenharia reversa",
    alvo: str(o.alvo, MAX_CURTO) ?? "",
    resumo: str(o.resumo, MAX_TEXTO) ?? "",
    comoFunciona: str(o.comoFunciona, MAX_TEXTO) ?? "",
    achados, reconstrucao, incertezas, ferramentas,
    compostoEm: typeof o.compostoEm === "number" && Number.isFinite(o.compostoEm) ? o.compostoEm : Date.now(),
    turnos: typeof o.turnos === "number" && Number.isFinite(o.turnos) ? Math.max(0, Math.min(9999, Math.floor(o.turnos))) : 0,
  };
}

/** o que o chat/estudo recebe de resumo (sem o corpo todo) */
export type ResumoRea = { id: string; titulo: string; alvo: string; achados: number; incertezas: number; updatedAt: string };
