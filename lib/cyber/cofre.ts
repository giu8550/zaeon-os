/**
 * Cyberespaço — o COFRE: o fundo privado de cada usuário que os AGENTES DE TRADING operam (out/2026, o dono: "não vamos
 * ter teto, deixe o próprio usuário decidir; o cofre pode negociar qualquer moeda do ecossistema da Solana; ele se
 * comporta como um fundo privado de cada usuário — se eu quiser colocar um fundo lá, eu coloco; por enquanto, na
 * devnet"). PURO: a configuração (quem decide é a pessoa), o LIVRO do fundo (as posições, os depósitos que chegam na
 * rede), o valor, e a RODADA da mesa — o prompt, as ordens validadas e a execução aos preços reais.
 * Na devnet não há liquidez (a Jupiter é só mainnet): o SOL é de verdade (a pessoa deposita), as posições nas outras
 * moedas ficam no livro, a preço de mercado, e CADA operação é registrada na rede (o memo, assinado pelo cofre —
 * lib/cyber/cofreServidor). Na mainnet, a mesma ordem vira troca de verdade.
 */
import { TOKENS_CONHECIDOS, type Precos } from "./carteira";
import { contextoDoMercado, agentePorId } from "./agentesTrading";
import type { PainelMercado } from "./mercado";

/** as moedas que o cofre negocia: o ecossistema da Solana (o SOL é o caixa do fundo) */
export const ATIVOS_COFRE = TOKENS_CONHECIDOS.map((t) => ({ simbolo: t.simbolo, cg: t.cg, estavel: !!t.estavel, cor: t.cor, mint: t.mint }));
export const CAIXA = "SOL";
/** quem decide na mesa do cofre (os agentes de trading que operam) */
export const MESA_PADRAO = ["trader-sol", "trader-risco", "trader-carteira"] as const;

export type ConfigCofre = {
  /** a mesa opera sozinha? (a pessoa liga e desliga) */
  ligado: boolean;
  /** quanto do fundo (0..1) cada COMPRA pode usar — e quanto de uma posição cada VENDA pode vender. Quem decide é a
   *  pessoa (sem teto da plataforma) */
  fracaoPorOperacao: number;
  /** quantas ordens por rodada, no máximo */
  ordensPorRodada: number;
  /** de quanto em quanto tempo a mesa roda sozinha (min; 0 = só quando a pessoa pede) */
  intervaloMin: number;
  /** as moedas permitidas ("todas" = o ecossistema inteiro) */
  ativos: "todas" | string[];
  /** os agentes que decidem (ids de lib/cyber/agentesTrading) */
  mesa: string[];
};
export const CONFIG_COFRE_PADRAO: ConfigCofre = { ligado: false, fracaoPorOperacao: 0.1, ordensPorRodada: 3, intervaloMin: 60, ativos: "todas", mesa: [...MESA_PADRAO] };
const num = (v: unknown, a: number, b: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
/** o que vem de fora (o corpo do pedido, o banco) → uma configuração válida */
export function sanitizarConfig(v: unknown): ConfigCofre {
  const o = (v ?? {}) as Record<string, unknown>, d = CONFIG_COFRE_PADRAO, simbolos = new Set(ATIVOS_COFRE.map((a) => a.simbolo));
  const ativos = Array.isArray(o.ativos) ? [...new Set(o.ativos.filter((s): s is string => typeof s === "string" && simbolos.has(s)))] : "todas";
  const mesa = Array.isArray(o.mesa) ? [...new Set(o.mesa.filter((s): s is string => typeof s === "string" && !!agentePorId(s)))] : [...d.mesa];
  return {
    ligado: o.ligado === true,
    fracaoPorOperacao: num(o.fracaoPorOperacao, 0.01, 1, d.fracaoPorOperacao),
    ordensPorRodada: Math.round(num(o.ordensPorRodada, 1, 10, d.ordensPorRodada)),
    intervaloMin: Math.round(num(o.intervaloMin, 0, 24 * 60, d.intervaloMin)),
    ativos: Array.isArray(ativos) && ativos.length ? ativos : "todas",
    mesa: mesa.length ? mesa : [...d.mesa],
  };
}
export const ativosPermitidos = (c: ConfigCofre) => (c.ativos === "todas" ? ATIVOS_COFRE.map((a) => a.simbolo) : c.ativos);

// ── o LIVRO do fundo ──
export type Posicoes = Record<string, number>;
export function sanitizarPosicoes(v: unknown): Posicoes {
  const out: Posicoes = {};
  if (v && typeof v === "object") for (const [k, q] of Object.entries(v as Record<string, unknown>)) { const n = Number(q); if (Number.isFinite(n) && n > 1e-12) out[k] = n; }
  return out;
}
/** o preço (US$) de uma moeda do cofre */
export function precoDe(simbolo: string, precos: Precos): number | null {
  const a = ATIVOS_COFRE.find((x) => x.simbolo === simbolo); if (!a) return null;
  if (a.estavel) return 1;
  return a.cg ? precos[a.cg]?.usd ?? null : null;
}
/** a rede mudou o saldo de SOL do cofre (depósito ou saque de fora) → o caixa do livro acompanha */
export function reconciliar(p: Posicoes, saldoAntes: number, saldoAgora: number): { posicoes: Posicoes; delta: number } {
  const delta = saldoAgora - saldoAntes, out = { ...p };
  if (Math.abs(delta) < 1e-9) return { posicoes: out, delta: 0 };
  out[CAIXA] = Math.max(0, (out[CAIXA] ?? 0) + delta); if (out[CAIXA] < 1e-12) delete out[CAIXA];
  return { posicoes: out, delta };
}
export type LinhaFundo = { simbolo: string; quantidade: number; preco: number | null; valor: number | null; peso: number };
/** o VALOR do fundo e a composição (o maior primeiro) */
export function valorDoFundo(p: Posicoes, precos: Precos): { total: number; linhas: LinhaFundo[] } {
  const linhas = Object.entries(p).map(([simbolo, quantidade]) => { const preco = precoDe(simbolo, precos); return { simbolo, quantidade, preco, valor: preco === null ? null : preco * quantidade, peso: 0 }; });
  const total = linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
  for (const l of linhas) l.peso = total > 0 && l.valor !== null ? l.valor / total : 0;
  return { total, linhas: linhas.sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0)) };
}

// ── a RODADA da mesa ──
export type Ordem = { ativo: string; acao: "comprar" | "vender"; fracao: number; motivo: string; agenteId: string };
export type Execucao = { tipo: "compra" | "venda"; ativo: string; quantidade: number; preco: number; valorUsd: number; agenteId: string; motivo: string };

/** o prompt da rodada: a mesa (os agentes da pessoa), o fundo, as regras DELA e o mercado ao vivo */
export function promptDaRodada(c: ConfigCofre, p: Posicoes, precos: Precos, painel: PainelMercado | null): { system: string; user: string } {
  const mesa = c.mesa.map((id) => agentePorId(id)).filter((a): a is NonNullable<typeof a> => !!a), permitidos = ativosPermitidos(c);
  const { total, linhas } = valorDoFundo(p, precos);
  const system = [
    "Você é a MESA DE OPERAÇÕES de um fundo privado na Solana, dentro do cyberespaço da Zaeon. Decidem juntos:",
    ...mesa.map((a) => `- ${a.nome} (${a.id}), ${a.papel}: ${a.jeito}`),
    `O caixa do fundo é ${CAIXA}. Comprar uma moeda usa ${CAIXA}; vender devolve ${CAIXA}. Comprar USDC = proteger o fundo.`,
    `Regras do dono do fundo: no máximo ${c.ordensPorRodada} ordens; cada compra usa no máximo ${Math.round(c.fracaoPorOperacao * 100)}% do valor do fundo; cada venda vende no máximo ${Math.round(c.fracaoPorOperacao * 100)}% da posição. Moedas permitidas: ${permitidos.join(", ")}.`,
    "Opere só com motivo claro nos números do contexto (preço, variação, máxima/mínima/média de 7 dias, RSI); sem motivo, não opere (lista vazia). Nunca invente números.",
    'Formato: JSON {"resumo": string (até 2 frases), "ordens": [{"ativo": string, "acao": "comprar"|"vender", "fracao": number de 0 a 1, "motivo": string curto, "agente": id de quem propôs}]}',
  ].join("\n");
  const fundo = linhas.length ? linhas.map((l) => `${l.simbolo}: ${l.quantidade} (${l.valor === null ? "sem preço" : `US$ ${l.valor.toFixed(2)}`}, ${(l.peso * 100).toFixed(1)}%)`).join("\n- ") : "vazio";
  const user = `${contextoDoMercado(painel, permitidos)}\n\nO fundo agora (total US$ ${total.toFixed(2)}):\n- ${fundo}\n\nQuais ordens a mesa executa agora?`;
  return { system, user };
}
/** as ordens da IA → as válidas (moeda permitida e com preço, ação certa, fração dentro do que a pessoa deixou) */
export function normalizarOrdens(j: unknown, c: ConfigCofre, precos: Precos): { resumo: string; ordens: Ordem[] } {
  const o = (j ?? {}) as Record<string, unknown>, permitidos = new Set(ativosPermitidos(c)), mesa = new Set(c.mesa);
  const ordens = (Array.isArray(o.ordens) ? o.ordens : []).flatMap((x): Ordem[] => {
    const r = x as Record<string, unknown>, ativo = typeof r.ativo === "string" ? r.ativo.trim() : "";
    const simb = ATIVOS_COFRE.find((a) => a.simbolo.toLowerCase() === ativo.toLowerCase())?.simbolo;
    if (!simb || simb === CAIXA || !permitidos.has(simb) || precoDe(simb, precos) === null) return [];
    if (r.acao !== "comprar" && r.acao !== "vender") return [];
    const fracao = Math.min(c.fracaoPorOperacao, num(r.fracao, 0, 1, 0)); if (fracao <= 0) return [];
    const agente = typeof r.agente === "string" && mesa.has(r.agente) ? r.agente : c.mesa[0]!;
    return [{ ativo: simb, acao: r.acao, fracao, motivo: typeof r.motivo === "string" ? r.motivo.slice(0, 200) : "", agenteId: agente }];
  }).slice(0, c.ordensPorRodada);
  return { resumo: typeof o.resumo === "string" ? o.resumo.slice(0, 300) : "", ordens };
}
/** EXECUTA uma ordem no livro, aos preços de agora (null = não deu: sem caixa, sem posição, sem preço) */
export function executar(p: Posicoes, o: Ordem, precos: Precos): { posicoes: Posicoes; exec: Execucao } | null {
  const pa = precoDe(o.ativo, precos), pc = precoDe(CAIXA, precos); if (!pa || !pc) return null;
  const out = { ...p }, { total } = valorDoFundo(p, precos);
  if (o.acao === "comprar") {
    const usd = Math.min(o.fracao * total, (out[CAIXA] ?? 0) * pc); if (usd < 0.01) return null;
    out[CAIXA] = (out[CAIXA] ?? 0) - usd / pc; out[o.ativo] = (out[o.ativo] ?? 0) + usd / pa;
    if (out[CAIXA] < 1e-12) delete out[CAIXA];
    return { posicoes: out, exec: { tipo: "compra", ativo: o.ativo, quantidade: usd / pa, preco: pa, valorUsd: usd, agenteId: o.agenteId, motivo: o.motivo } };
  }
  const q = o.fracao * (out[o.ativo] ?? 0); if (q * pa < 0.01) return null;
  out[o.ativo] = (out[o.ativo] ?? 0) - q; if (out[o.ativo]! < 1e-12) delete out[o.ativo];
  out[CAIXA] = (out[CAIXA] ?? 0) + (q * pa) / pc;
  return { posicoes: out, exec: { tipo: "venda", ativo: o.ativo, quantidade: q, preco: pa, valorUsd: q * pa, agenteId: o.agenteId, motivo: o.motivo } };
}
/** o MEMO que registra a operação na rede (curto: cabe numa transação) */
export const memoDaOperacao = (e: Pick<Execucao, "tipo" | "ativo" | "quantidade" | "preco" | "agenteId">) =>
  `ZAEON-COFRE v1|${e.tipo}|${e.ativo}|${e.quantidade.toPrecision(8)}|${e.preco.toPrecision(8)}|${e.agenteId}`;
/** a mesa já deveria ter rodado sozinha? */
export const horaDaRodada = (c: ConfigCofre, ultima: Date | null, agora = Date.now()) => c.ligado && c.intervaloMin > 0 && (!ultima || agora - ultima.getTime() >= c.intervaloMin * 60_000);
