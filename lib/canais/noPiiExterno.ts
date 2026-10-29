/**
 * lib/canais/noPiiExterno.ts — a trava de PII do conteúdo PÚBLICO (F0). Pré-requisito, não ajuste.
 *
 * Os agentes da Zaeon leem a memória L3 do aluno (nome, telefone, e-mail, trechos de conversa, o que
 * ele está estudando) e muitos são menores de idade. Um post gerado com esse contexto pode vazar dado
 * pessoal pro mundo — e post publicado não volta. Então aqui a regra é diferente da trava do Octa
 * (`lib/octa/noPii`, que REDIGE e segue): conteúdo público é **BLOQUEADO**, não remendado.
 *
 * Por quê bloquear em vez de redigir: um post com buracos ("fale com «omitido» sobre…") é pior que
 * post nenhum, e redigir dá a falsa sensação de que o conteúdo foi "limpo". Bloquear devolve o
 * rascunho pro agente/humano com o motivo — o jeito certo é reescrever sem o dado.
 *
 * Camadas:
 *   1. FORMATO — e-mail, telefone (BR/E.164), CPF, CEP+número, @handle de pessoa, URL com credencial.
 *   2. SEGREDO — reusa `temSegredo` de lib/octa/noPii (token/chave chumbada no rascunho).
 *   3. LISTA — strings que o chamador sabe serem de aluno (nome, apelido, e-mail): casamento exato,
 *      porque nome de pessoa não dá pra detectar por formato sem destruir texto legítimo.
 *
 * Módulo PURO. A `amostra` dos achados é SEMPRE mascarada: o relatório nunca repete o dado inteiro.
 */
import { temSegredo } from "@/lib/octa/noPii";

export type TipoAchado = "email" | "telefone" | "cpf" | "url_credencial" | "handle" | "segredo" | "proibido";
export type AchadoPii = { tipo: TipoAchado; amostra: string };
export type VerificacaoPublica = { ok: true } | { ok: false; achados: AchadoPii[] };

/** Mostra as pontas e esconde o meio: `jo***@***.com`, `119***4455`. Nunca devolve o valor inteiro. */
export function mascarar(v: string): string {
  const s = String(v ?? "");
  if (s.length <= 4) return "*".repeat(s.length);
  return `${s.slice(0, 2)}${"*".repeat(Math.min(6, Math.max(1, s.length - 4)))}${s.slice(-2)}`;
}

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Telefone BR com DDD (10–11 dígitos) ou E.164. `(?<!\d)`/`(?!\d)` evita casar pedaço de número
 * comprido (id, ISBN, hash) — e o `\b` sozinho não resolveria isso.
 */
const TELEFONE = /(?<![\d-])(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}(?![\d-])/g;
const CPF = /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/g;
/** Credencial embutida em URL (`https://user:senha@host`). */
const URL_CREDENCIAL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/gi;

/**
 * @handle de pessoa. É o achado mais ruidoso (a Zaeon cita perfis legítimos), então só conta quando
 * NÃO está na allowlist institucional — marcar o próprio @zaeon como PII seria absurdo.
 */
const HANDLE = /(?<![\w./])@([A-Za-z0-9._]{3,30})\b/g;
export const HANDLES_LIBERADOS = new Set(["zaeon", "zaeonos", "zaeon_os", "zaeonoficial"]);

/** Datas não são telefone: `2026-10-29`, `29/10/2026`. Removidas antes de procurar número. */
const DATAS = /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{2,4}\b/g;

export type OpcoesPublicas = {
  /** Strings que o chamador SABE serem de aluno (nome, apelido, e-mail). Casamento exato, case-insensitive. */
  proibidos?: readonly string[];
  /** Handles extra liberados (perfis institucionais/parceiros). */
  handlesLiberados?: readonly string[];
  /** `false` desliga a checagem de @handle (ruidosa) sem desligar o resto. Default: true. */
  checarHandles?: boolean;
};

/**
 * O rascunho pode ir pro mundo? Devolve TODOS os achados (não para no primeiro): quem reescreve
 * precisa ver a lista inteira, senão corrige um e bate no outro.
 */
export function verificarConteudoPublico(texto: string, opts: OpcoesPublicas = {}): VerificacaoPublica {
  const bruto = String(texto ?? "");
  if (!bruto.trim()) return { ok: true };
  const achados: AchadoPii[] = [];
  const add = (tipo: TipoAchado, amostra: string) => {
    if (!achados.some((a) => a.tipo === tipo && a.amostra === amostra)) achados.push({ tipo, amostra });
  };

  for (const m of bruto.matchAll(EMAIL)) add("email", mascarar(m[0]));
  for (const m of bruto.matchAll(URL_CREDENCIAL)) add("url_credencial", mascarar(m[0]));

  // número: tira datas primeiro pra não confundir dd/mm/aaaa com telefone
  const semDatas = bruto.replace(DATAS, " ");
  for (const m of semDatas.matchAll(CPF)) add("cpf", mascarar(m[0]));
  for (const m of semDatas.matchAll(TELEFONE)) {
    const digitos = m[0].replace(/\D/g, "");
    if (digitos.length >= 10 && digitos.length <= 13) add("telefone", mascarar(m[0].trim()));
  }

  if (opts.checarHandles !== false) {
    const liberados = new Set([...HANDLES_LIBERADOS, ...(opts.handlesLiberados ?? []).map((h) => h.toLowerCase().replace(/^@/, ""))]);
    for (const m of bruto.matchAll(HANDLE)) {
      if (!liberados.has(m[1].toLowerCase())) add("handle", mascarar(m[0]));
    }
  }

  if (temSegredo(bruto)) add("segredo", "«credencial detectada»");

  const alvo = bruto.toLowerCase();
  for (const p of opts.proibidos ?? []) {
    const t = String(p ?? "").trim().toLowerCase();
    if (t.length >= 3 && alvo.includes(t)) add("proibido", mascarar(t));
  }

  return achados.length ? { ok: false, achados } : { ok: true };
}

/** Frase curta pro log/UI, sem repetir o dado. */
export function motivoDoBloqueio(v: VerificacaoPublica): string | null {
  if (v.ok) return null;
  const tipos = [...new Set(v.achados.map((a) => a.tipo))].join(", ");
  return `conteúdo público bloqueado: possível dado pessoal (${tipos}). Reescreva sem o dado — não há redação automática aqui.`;
}

/** Atalho booleano pra quem só quer o gate. */
export const conteudoPublicoLiberado = (texto: string, opts?: OpcoesPublicas): boolean => verificarConteudoPublico(texto, opts).ok;
