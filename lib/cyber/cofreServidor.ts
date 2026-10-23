/**
 * O COFRE no servidor (lib/cyber/cofre — só servidor): a carteira de cada usuário (a semente CIFRADA com
 * lib/projects/crypto), a sincronização com a rede (depósito/saque de fora entram no livro), a RODADA da mesa (a IA do
 * cyberespaço decide → as ordens válidas → o livro → o MEMO assinado pelo cofre na rede, uma transação por operação) e
 * o SAQUE de SOL pra um endereço da pessoa. Rede: a devnet por enquanto (o dono, out/2026).
 */
import { prisma } from "@/src/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/projects/crypto";
import { falarJson } from "@/lib/cyber/ia/motor";
import { heliusRpcUrl } from "@/lib/solana/config";
import { LAMPORTS, RPC_DEVNET, base58, deBase58, enviar, novaChave, pedirAirdrop, saldoSol } from "@/lib/solana/devnetTx";
import { painelDoMercado } from "./mercadoServidor";
import { precosDaSolana } from "./precosServidor";
import { CAIXA, CONFIG_COFRE_PADRAO, executar, memoDaOperacao, normalizarOrdens, promptDaRodada, reconciliar, sanitizarConfig, sanitizarPosicoes, valorDoFundo, type ConfigCofre, type Execucao, type Posicoes } from "./cofre";

export const REDE_COFRE = "devnet" as const;
const rpcUrl = () => (process.env.HELIUS_API_KEY ? heliusRpcUrl("devnet") : RPC_DEVNET);
type Linha = NonNullable<Awaited<ReturnType<typeof prisma.cofre.findUnique>>>;
const sementeDe = (c: Linha) => deBase58(decryptToken(c.sementeCifrada));

export async function lerCofre(userId: string) { return prisma.cofre.findUnique({ where: { userId } }); }

/** cria o cofre da pessoa (se já tem, devolve o que tem) */
export async function criarCofre(userId: string): Promise<Linha> {
  const ja = await lerCofre(userId); if (ja) return ja;
  const k = novaChave();
  return prisma.cofre.create({ data: { userId, endereco: k.endereco, sementeCifrada: encryptToken(base58(k.semente)), rede: REDE_COFRE, config: CONFIG_COFRE_PADRAO, posicoes: {}, saldoRede: 0 } });
}

/** lê o saldo de SOL na rede e acerta o livro (depósito/saque de fora); registra o depósito como operação */
export async function sincronizar(c: Linha): Promise<Linha> {
  let agora: number; try { agora = await saldoSol(rpcUrl(), c.endereco); } catch { return c; }
  const { posicoes, delta } = reconciliar(sanitizarPosicoes(c.posicoes), c.saldoRede, agora);
  if (delta === 0) return c;
  const precos = await precosDaSolana(), ps = precos.solana?.usd ?? 0;
  const [novo] = await prisma.$transaction([
    prisma.cofre.update({ where: { id: c.id }, data: { posicoes, saldoRede: agora } }),
    prisma.cofreOperacao.create({ data: { cofreId: c.id, userId: c.userId, tipo: delta > 0 ? "deposito" : "saque", ativo: CAIXA, quantidade: Math.abs(delta), preco: ps, valorUsd: Math.abs(delta) * ps, motivo: delta > 0 ? "SOL chegou no cofre" : "SOL saiu do cofre" } }),
  ]);
  return novo;
}

/** o ESTADO pro painel: o cofre, o valor, a composição e as últimas operações */
export async function estadoDoCofre(c: Linha) {
  const precos = await precosDaSolana(), p = sanitizarPosicoes(c.posicoes), v = valorDoFundo(p, precos);
  const ops = await prisma.cofreOperacao.findMany({ where: { cofreId: c.id }, orderBy: { criadoEm: "desc" }, take: 30 });
  return { endereco: c.endereco, rede: c.rede, config: sanitizarConfig(c.config), posicoes: p, total: v.total, linhas: v.linhas, saldoRede: c.saldoRede, ultimaRodada: c.ultimaRodada, operacoes: ops.map((o) => ({ id: o.id, tipo: o.tipo, ativo: o.ativo, quantidade: o.quantidade, preco: o.preco, valorUsd: o.valorUsd, agenteId: o.agenteId, motivo: o.motivo, assinatura: o.assinatura, em: o.criadoEm })) };
}

export async function salvarConfig(c: Linha, v: unknown): Promise<Linha> {
  return prisma.cofre.update({ where: { id: c.id }, data: { config: sanitizarConfig({ ...sanitizarConfig(c.config), ...(v as object) }) } });
}

/** a RODADA: a mesa decide e o cofre executa (cada operação, um memo assinado na rede) */
export async function rodada(c0: Linha, userId: string): Promise<{ resumo: string; execucoes: (Execucao & { assinatura: string | null })[] }> {
  const c = await sincronizar(c0), config: ConfigCofre = sanitizarConfig(c.config);
  let posicoes: Posicoes = sanitizarPosicoes(c.posicoes);
  const [precos, painel] = await Promise.all([precosDaSolana(), painelDoMercado().catch(() => null)]);
  if (valorDoFundo(posicoes, precos).total < 0.01) { await prisma.cofre.update({ where: { id: c.id }, data: { ultimaRodada: new Date() } }); return { resumo: "O fundo está vazio — deposite SOL pra mesa operar.", execucoes: [] }; }
  const p = promptDaRodada(config, posicoes, precos, painel);
  let decisao: { resumo: string; ordens: ReturnType<typeof normalizarOrdens>["ordens"] };
  try { decisao = normalizarOrdens(await falarJson<unknown>({ system: p.system, user: p.user, agente: "trading:cofre", userId, temperatura: 0.4 }), config, precos); }
  catch { await prisma.cofre.update({ where: { id: c.id }, data: { ultimaRodada: new Date() } }); return { resumo: "A mesa não conseguiu decidir agora (a IA não respondeu). Nada foi operado.", execucoes: [] }; }
  const execucoes: (Execucao & { assinatura: string | null })[] = [], semente = sementeDe(c);
  for (const o of decisao.ordens) {
    const r = executar(posicoes, o, precos); if (!r) continue;
    posicoes = r.posicoes;
    let assinatura: string | null = null;
    try { assinatura = await enviar(rpcUrl(), semente, [{ memo: memoDaOperacao(r.exec) }]); } catch { /* sem SOL pra taxa ou rede fora: a operação fica no livro sem o registro */ }
    execucoes.push({ ...r.exec, assinatura });
    await prisma.cofreOperacao.create({ data: { cofreId: c.id, userId, tipo: r.exec.tipo, ativo: r.exec.ativo, quantidade: r.exec.quantidade, preco: r.exec.preco, valorUsd: r.exec.valorUsd, agenteId: r.exec.agenteId, motivo: r.exec.motivo, assinatura } });
  }
  await prisma.cofre.update({ where: { id: c.id }, data: { posicoes, ultimaRodada: new Date() } });
  return { resumo: decisao.resumo || (execucoes.length ? "A mesa operou." : "A mesa preferiu não operar agora."), execucoes };
}

/** SAQUE de SOL do cofre pra um endereço (só o caixa: venda as posições antes) */
export async function sacar(c0: Linha, destino: string, sol: number): Promise<string> {
  const c = await sincronizar(c0), p = sanitizarPosicoes(c.posicoes), taxa = 0.00001;
  if (!(sol > 0) || sol > (p[CAIXA] ?? 0) || sol > c.saldoRede - taxa) throw new Error("Saldo de SOL insuficiente no cofre (venda as posições antes de sacar).");
  return enviar(rpcUrl(), sementeDe(c), [{ transferir: { para: destino, lamports: BigInt(Math.floor(sol * LAMPORTS)) } }, { memo: `ZAEON-COFRE v1|saque|SOL|${sol}` }]);
  // (o livro acerta na próxima sincronização: o saldo da rede cai e o caixa acompanha)
}

/** SOL de teste (o faucet da devnet — eles limitam por dia) */
export async function airdrop(c: Linha, sol = 1): Promise<string> {
  if (c.rede !== "devnet") throw new Error("Só na devnet.");
  return pedirAirdrop(rpcUrl(), c.endereco, Math.max(0.1, Math.min(2, sol)));
}
