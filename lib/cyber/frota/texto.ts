/**
 * Frota de IAs — o TEXTO gerado, sem repetir (lógica do servidor, com as dependências injetáveis pros testes):
 *  - `gerarFalasSemRepetir`: as falas de um episódio (lib/cyber/frota/conversas `promptEpisodio`) — a IA escreve todas
 *    de uma vez (continuidade), e as VISÍVEIS (sem cloak) passam pela regra de ouro: a impressão (`normalizarFala`) de
 *    cada uma não pode já ter sido vista — nem repetir dentro do próprio episódio. A que colidir é REESCRITA (até 3
 *    tentativas); se não sair, fica sem texto (o balão não aparece). As que ficaram são ANOTADAS (a anotação é atômica:
 *    se outra conversa anotou a mesma no meio-tempo, essa também sai).
 *  - `gerarResposta`: a resposta seca/cortante a um usuário (lib/cyber/frota/conversas `promptResposta`), pela mesma regra.
 */
import { limparFala, normalizarFala, promptEpisodio, promptResposta, validarFalas, type Episodio, type TomResposta } from "./conversas";
import type { AgenteIA } from "./frota";

export type DepsTexto = {
  /** a IA (JSON já parseado); erro → lança */
  ia: (p: { system: string; user: string; temperatura: number }) => Promise<unknown>;
  /** quais dessas impressões JÁ foram vistas */
  jaVistas: (imps: string[]) => Promise<Set<string>>;
  /** anota as impressões; devolve as que JÁ existiam (corrida com outra conversa) */
  anotar: (imps: string[]) => Promise<Set<string>>;
};
const TENTATIVAS = 3;

/** reescreve UMA fala do mesmo jeito, com outras palavras */
async function reescrever(fala: string, deps: DepsTexto, k: number): Promise<string | null> {
  try {
    const r = await deps.ia({
      system: "você reescreve uma fala curtinha de chat entre amigos universitários brasileiros: o MESMO sentido e o mesmo tom, com OUTRAS palavras (outra gíria, outra ordem). minúsculas, até 90 caracteres. responda SÓ com JSON: {\"fala\": \"...\"}",
      user: `fala: "${fala}" (variação ${k})`, temperatura: 1,
    });
    const f = (r as { fala?: unknown })?.fala;
    return typeof f === "string" && limparFala(f) ? limparFala(f) : null;
  } catch { return null; }
}

/** garante que nenhuma das falas visíveis repete (entre si nem com o que já foi visto); as que não deu → null */
async function semRepetir(falas: (string | null)[], deps: DepsTexto): Promise<(string | null)[]> {
  const out = [...falas];
  for (let rodada = 0; rodada <= TENTATIVAS; rodada++) {
    const imps = out.map((f) => (f ? normalizarFala(f) : null)), vistas = await deps.jaVistas(imps.filter((x): x is string => !!x));
    const repetidas = imps.map((imp, i) => !!imp && (vistas.has(imp) || imps.indexOf(imp) !== i || imp.length === 0));
    if (!repetidas.some(Boolean)) break;
    for (let i = 0; i < out.length; i++) if (repetidas[i]) out[i] = rodada < TENTATIVAS ? await reescrever(out[i]!, deps, rodada * 10 + i) : null;
  }
  const finais = out.map((f) => (f ? normalizarFala(f) : null)).filter((x): x is string => !!x);
  const corrida = await deps.anotar(finais);
  return out.map((f) => (f && corrida.has(normalizarFala(f)) ? null : f));
}

/** as falas de um episódio: string (visível) ou null (cloak, ou não saiu sem repetir) */
export async function gerarFalasSemRepetir(e: Episodio, quem: (id: string) => AgenteIA | undefined, deps: DepsTexto): Promise<(string | null)[]> {
  const { system, user } = promptEpisodio(e, quem);
  let falas: string[] | null = null;
  for (let k = 0; k < 2 && !falas; k++) { try { falas = validarFalas(await deps.ia({ system, user, temperatura: 1 }), e.falas.length); } catch { /* tenta de novo */ } }
  if (!falas) return e.falas.map(() => null);
  return semRepetir(falas.map((f, i) => (e.falas[i]!.cloak ? null : f)), deps);
}

/** a resposta a um usuário: seca (1ª/2ª), cortante (3ª/4ª); depois ignora (null) */
export async function gerarResposta(a: AgenteIA, tom: TomResposta, texto: string, nonce: number, deps: DepsTexto): Promise<string | null> {
  if (tom === "ignora") return null;
  const { system, user } = promptResposta(a, tom, texto, nonce);
  let fala: string | null = null;
  try { const r = await deps.ia({ system, user, temperatura: 1 }); const f = (r as { fala?: unknown })?.fala; fala = typeof f === "string" ? limparFala(f).slice(0, 60) : null; } catch { fala = null; }
  if (!fala) return null;
  return (await semRepetir([fala], deps))[0] ?? null;
}
