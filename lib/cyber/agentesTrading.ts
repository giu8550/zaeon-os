/**
 * Cyberespaço — os AGENTES DE TRADING das mesas de operações do campus (out/2026, o dono: "todo agente da operação tem
 * avatar — por ora, com as skins comuns; acrescente inteligência de resposta pra cada agente que pode fazer trades; eles
 * precisam ser destacados do resto"). PURO: o elenco (um por terminal — lib/cyber/temploCosmico `ESTACOES_TI`), o papel
 * de cada um e o PROMPT que faz ele responder como o especialista que imita, com o mercado AO VIVO (lib/cyber/mercado).
 * Os papéis vêm das três bases do dono:
 *  - TauricResearch/TradingAgents: os analistas (técnico, sentimento, notícias, fundamentos), os pesquisadores que
 *    debatem (otimista × pessimista), o trader, o gestor de risco e o de carteira;
 *  - 51bitquant/ai-hedge-fund-crypto: o quant dos indicadores (tendência, reversão à média, momentum, volatilidade);
 *  - HKUDS/AI-Trader: a arena (cada agente com o seu estilo e o placar — o "trader autônomo").
 * Ninguém executa ordem aqui: a resposta pode trazer um SINAL (comprar/vender/aguardar, confiança, horizonte) — a
 * execução real é a próxima fase (o cofre com limites).
 */
import { fmtGrande, fmtPreco, type PainelMercado } from "./mercado";
import type { TelaoMercado } from "./temploCosmico";

export type Mesa = TelaoMercado["id"];
export type AgenteTrading = {
  id: string; nome: string; papel: string; mesa: Mesa;
  /** a base de onde vem o papel (pro crachá) */
  base: "TradingAgents" | "ai-hedge-fund-crypto" | "AI-Trader";
  /** a skin comum (a chave de CORPOS_VRM) e a cor do crachá */
  skin: "aura" | "zenita" | "caio" | "enfermagem" | "medicina" | "farmacia" | "quimica"; cor: string;
  /** os ativos que ele acompanha (símbolos) */
  foco: readonly string[];
  /** como ele pensa — vai no prompt */
  jeito: string;
};

/** o ELENCO, na ordem dos terminais (4 por mesa: a da Solana, a das métricas, a das moedas) */
export const AGENTES_TRADING: readonly AgenteTrading[] = [
  // a MESA DA SOLANA
  { id: "trader-tecnico", nome: "Iris", papel: "Analista Técnica", mesa: "solana", base: "TradingAgents", skin: "aura", cor: "#a78bfa", foco: ["SOL", "JUP", "BONK"],
    jeito: "Lê preço e volume: tendência (médias), suporte e resistência, RSI, MACD, rompimentos. Fala em níveis de preço e cenários." },
  { id: "trader-onchain", nome: "Ravi", papel: "Analista On-chain", mesa: "solana", base: "TradingAgents", skin: "caio", cor: "#14f195", foco: ["SOL", "JTO", "PYTH"],
    jeito: "Olha a rede: transações por segundo, época, fluxo para staking, atividade do ecossistema. Liga uso da rede a preço." },
  { id: "trader-sentimento", nome: "Luna", papel: "Analista de Sentimento", mesa: "solana", base: "TradingAgents", skin: "zenita", cor: "#f472b6", foco: ["SOL", "WIF", "BONK"],
    jeito: "Mede o humor do mercado: medo e ganância, euforia em memecoins, posicionamento da multidão. Desconfia de consenso." },
  { id: "trader-sol", nome: "Kai", papel: "Trader da Mesa Solana", mesa: "solana", base: "AI-Trader", skin: "quimica", cor: "#9945ff", foco: ["SOL", "JUP", "RAY", "ORCA"],
    jeito: "Decide entrada, alvo e stop combinando o que os analistas trazem. Objetivo, com gestão de posição. Pensa em risco/retorno." },
  // a MESA DAS MÉTRICAS (o macro e o debate)
  { id: "trader-macro", nome: "Helena", papel: "Analista Macro e Notícias", mesa: "blockchain", base: "TradingAgents", skin: "medicina", cor: "#38bdf8", foco: ["BTC", "ETH"],
    jeito: "Lê o contexto: dominância do Bitcoin, capitalização total, liquidez, juros e notícias. Explica como o macro move o cripto." },
  { id: "trader-otimista", nome: "Bruno", papel: "Pesquisador Otimista", mesa: "blockchain", base: "TradingAgents", skin: "caio", cor: "#22c55e", foco: ["BTC", "SOL"],
    jeito: "Defende a tese de alta com argumentos e dados; reconhece o risco mas procura o caso a favor. Debate com o pessimista." },
  { id: "trader-pessimista", nome: "Vera", papel: "Pesquisadora Pessimista", mesa: "blockchain", base: "TradingAgents", skin: "enfermagem", cor: "#f87171", foco: ["BTC", "SOL"],
    jeito: "Procura o que pode dar errado: sobrecompra, alavancagem, euforia, fraqueza de fundamento. Debate com o otimista." },
  { id: "trader-risco", nome: "Otto", papel: "Gestor de Risco", mesa: "blockchain", base: "TradingAgents", skin: "farmacia", cor: "#fbbf24", foco: ["BTC", "SOL", "ETH"],
    jeito: "Dimensiona posição, define stop e limite de perda por dia; corta o que passar do risco. Pensa em volatilidade e drawdown." },
  // a MESA DAS MOEDAS
  { id: "trader-quant", nome: "Nox", papel: "Quant de Indicadores", mesa: "moedas", base: "ai-hedge-fund-crypto", skin: "quimica", cor: "#2dd4bf", foco: ["BTC", "ETH", "SOL", "XRP"],
    jeito: "Combina sinais: tendência, reversão à média, momentum, volatilidade e arbitragem estatística, com pesos. Responde em números." },
  { id: "trader-fundamentos", nome: "Clara", papel: "Analista de Fundamentos", mesa: "moedas", base: "TradingAgents", skin: "zenita", cor: "#e879f9", foco: ["ETH", "LINK", "SOL"],
    jeito: "Avalia o projeto: receita do protocolo, uso, tokenomics, emissão e desbloqueios. Separa narrativa de fundamento." },
  { id: "trader-multi", nome: "Theo", papel: "Trader Multiativo", mesa: "moedas", base: "AI-Trader", skin: "medicina", cor: "#fb923c", foco: ["BTC", "ETH", "SOL", "BNB", "XRP"],
    jeito: "Opera o que tem melhor setup entre as maiores; compara força relativa entre ativos e rotaciona capital." },
  { id: "trader-carteira", nome: "Ada", papel: "Gestora de Carteira", mesa: "moedas", base: "TradingAgents", skin: "aura", cor: "#c084fc", foco: ["BTC", "ETH", "SOL", "USDC"],
    jeito: "Aprova ou não o que a equipe propõe: alocação por ativo, rebalanceamento, quanto fica em caixa (USDC). Pensa no conjunto." },
];
export const agentePorId = (id: string) => AGENTES_TRADING.find((a) => a.id === id) ?? null;

export type Sinal = { ativo: string; acao: "comprar" | "vender" | "aguardar"; confianca: number; horizonte: string };
export type RespostaAgente = { fala: string; sinal: Sinal | null };
export type MensagemConversa = { de: "eu" | "agente"; texto: string };

/** os INDICADORES de verdade a partir da série de 7 dias (o que o técnico e o quant podem citar): RSI(14) dos pontos, a
 *  média, a máxima e a mínima da semana e onde o preço está nesse intervalo */
export function indicadores(serie: readonly number[]): { rsi: number; media: number; max: number; min: number; posicao: number } | null {
  if (serie.length < 15) return null;
  let ganho = 0, perda = 0;
  for (let i = serie.length - 14; i < serie.length; i++) { const d = serie[i]! - serie[i - 1]!; if (d > 0) ganho += d; else perda -= d; }
  const rsi = perda === 0 ? 100 : 100 - 100 / (1 + ganho / perda);
  const media = serie.reduce((s, x) => s + x, 0) / serie.length, max = Math.max(...serie), min = Math.min(...serie), ult = serie.at(-1)!;
  return { rsi, media, max, min, posicao: max > min ? (ult - min) / (max - min) : 0.5 };
}
/** a leitura do RSI (rotulada no contexto: o modelo leve confundia sobrecompra com sobrevenda) */
export const leituraRsi = (r: number) => (r >= 70 ? "sobrecomprado" : r <= 30 ? "sobrevendido" : r >= 60 ? "forte, sem sobrecompra" : r <= 40 ? "fraco, perto de sobrevenda" : "neutro");
/** o MERCADO de agora, em poucas linhas (vai no prompt — o agente responde com o que está acontecendo) */
export function contextoDoMercado(p: PainelMercado | null, foco: readonly string[]): string {
  if (!p) return "Mercado: sem dados agora (as fontes não responderam).";
  const linhas: string[] = [];
  const todas = [...(p.solana ? [p.solana] : []), ...p.moedas, ...p.tokensSolana];
  for (const s of foco) {
    const m = todas.find((x) => x.simbolo === s); if (!m) continue;
    const ind = indicadores(m.serie);
    linhas.push(`${m.simbolo}: ${fmtPreco(m.preco)} (24h ${m.var24h?.toFixed(2) ?? "?"}%, 7d ${m.var7d?.toFixed(2) ?? "?"}%)` + (ind ? ` — 7 dias: máx ${fmtPreco(ind.max)}, mín ${fmtPreco(ind.min)}, média ${fmtPreco(ind.media)}, RSI(14 pts) ${ind.rsi.toFixed(0)} (${leituraRsi(ind.rsi)}), no ${Math.round(ind.posicao * 100)}% do intervalo` : ""));
  }
  if (p.global) linhas.push(`Capitalização total ${fmtGrande(p.global.capitalizacao)} (24h ${p.global.var24h.toFixed(2)}%), volume ${fmtGrande(p.global.volume)}, dominância BTC ${p.global.domBtc.toFixed(1)}% / ETH ${p.global.domEth.toFixed(1)}%`);
  if (p.medo) linhas.push(`Medo e ganância: ${p.medo.valor} (${p.medo.rotulo})`);
  if (p.redeSolana) linhas.push(`Rede Solana: ${Math.round(p.redeSolana.tps)} TPS de usuários, época ${p.redeSolana.epoca} (${(p.redeSolana.progressoEpoca * 100).toFixed(0)}%)`);
  if (p.redeBitcoin) linhas.push(`Bitcoin: bloco ${p.redeBitcoin.altura}, taxa rápida ${p.redeBitcoin.taxaRapida} sat/vB`);
  return `Mercado AO VIVO (${new Date(p.atualizadoEm).toISOString()}):\n- ${linhas.join("\n- ")}`;
}

/** o PROMPT do agente: quem ele é, o mercado de agora, a conversa até aqui e a pergunta */
export function promptDoAgente(a: AgenteTrading, painel: PainelMercado | null, pergunta: string, historico: readonly MensagemConversa[]): { system: string; user: string } {
  const system = [
    `Você é ${a.nome}, ${a.papel} da mesa de operações da Zaeon (a mesa ${a.mesa === "solana" ? "da Solana" : a.mesa === "blockchain" ? "das métricas da blockchain" : "das moedas"}), dentro do cyberespaço.`,
    `Você imita um especialista real desse papel. ${a.jeito}`,
    `Ativos que você acompanha: ${a.foco.join(", ")}.`,
    "Responda em português do Brasil, falado, curto (no máximo 4 frases), concreto e com números do mercado de agora quando fizer sentido.",
    "Nunca invente números nem indicadores: use só o que está no contexto (preços, variações, máxima/mínima/média de 7 dias, RSI). Se não tiver o dado, diga que não tem.",
    "Você não executa ordens nem promete lucro; não é recomendação de investimento. Se perguntarem por dinheiro real, diga que a execução fica no cofre com limites, que o dono liga.",
    "Se a pergunta pedir uma opinião de operação, inclua um SINAL; senão, sinal = null.",
    'Formato: JSON {"fala": string, "sinal": null | {"ativo": string, "acao": "comprar"|"vender"|"aguardar", "confianca": number entre 0 e 1, "horizonte": string}}',
  ].join("\n");
  const conversa = historico.slice(-6).map((m) => `${m.de === "eu" ? "Pessoa" : a.nome}: ${m.texto}`).join("\n");
  const user = `${contextoDoMercado(painel, a.foco)}\n\n${conversa ? `Conversa até aqui:\n${conversa}\n\n` : ""}Pessoa: ${pergunta}`;
  return { system, user };
}

/** a resposta da IA → a fala e o sinal validados (o que não bate, cai) */
export function normalizarResposta(j: unknown): RespostaAgente | null {
  const o = (j ?? {}) as Record<string, unknown>;
  const fala = typeof o.fala === "string" ? o.fala.trim().slice(0, 700) : "";
  if (!fala) return null;
  const s = o.sinal as Record<string, unknown> | null | undefined;
  let sinal: Sinal | null = null;
  if (s && typeof s === "object" && typeof s.ativo === "string" && (s.acao === "comprar" || s.acao === "vender" || s.acao === "aguardar")) {
    const c = Number(s.confianca);
    sinal = { ativo: s.ativo.toUpperCase().slice(0, 10), acao: s.acao, confianca: Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.5, horizonte: typeof s.horizonte === "string" ? s.horizonte.slice(0, 40) : "curto prazo" };
  }
  return { fala, sinal };
}
/** a fala de RESERVA (a IA caiu): o agente diz o que vê nos números, sem opinião */
export function falaDeReserva(a: AgenteTrading, painel: PainelMercado | null): RespostaAgente {
  const todas = painel ? [...(painel.solana ? [painel.solana] : []), ...painel.moedas, ...painel.tokensSolana] : [];
  const m = a.foco.map((s) => todas.find((x) => x.simbolo === s)).find(Boolean);
  const fala = m ? `Minha linha caiu agora, mas o painel mostra ${m.simbolo} a ${fmtPreco(m.preco)}, ${m.var24h !== null ? `${m.var24h >= 0 ? "+" : ""}${m.var24h.toFixed(2)}% em 24h` : "sem variação disponível"}. Me pergunta de novo em um instante.` : "Minha linha com o mercado caiu agora. Me pergunta de novo em um instante.";
  return { fala, sinal: null };
}
