/**
 * lib/solana/devnetTx.ts — transações da Solana SEM dependência (só o ed25519 nativo do Node): o cofre de cada usuário
 * (lib/cyber/cofre) assina daqui. O SDK oficial puxa pacotes com script de instalação que o vetting do CI barra
 * (scripts/vet-deps.mjs) — e o que o cofre precisa é pouco:
 *  - a CHAVE (ed25519: a semente de 32 bytes → a pública, que é o endereço em base58);
 *  - a MENSAGEM legada com 1 assinante (o cofre paga a taxa) e as instruções de MEMO (o registro de cada operação na
 *    rede, conferível no explorer) e de TRANSFERÊNCIA de SOL (o saque pro dono);
 *  - o RPC: saldo, blockhash, envio, faucet (devnet) e o status da assinatura.
 * Só servidor.
 */
import crypto from "crypto";

// ── base58 (o alfabeto do Bitcoin) ──
const ALFABETO = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Uint8Array): string {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ""; while (n > 0n) { s = ALFABETO[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = "1" + s; }
  return s;
}
export function deBase58(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) { const i = ALFABETO.indexOf(c); if (i < 0) throw new Error("base58 inválido"); n = n * 58n + BigInt(i); }
  const out: number[] = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c !== "1") break; out.unshift(0); }
  return Uint8Array.from(out);
}

// ── a CHAVE ed25519 ──
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
const chavePrivada = (semente: Uint8Array) => crypto.createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(semente)]), format: "der", type: "pkcs8" });
/** a pública (32 bytes) de uma semente */
export function publicaDe(semente: Uint8Array): Uint8Array {
  const der = crypto.createPublicKey(chavePrivada(semente)).export({ format: "der", type: "spki" }) as Buffer;
  return Uint8Array.from(der.subarray(der.length - 32));
}
/** uma chave nova: a semente (guardar CIFRADA) e o endereço */
export function novaChave(): { semente: Uint8Array; endereco: string } {
  const semente = Uint8Array.from(crypto.randomBytes(32));
  return { semente, endereco: base58(publicaDe(semente)) };
}
export const assinar = (semente: Uint8Array, msg: Uint8Array) => Uint8Array.from(crypto.sign(null, Buffer.from(msg), chavePrivada(semente)));

// ── a TRANSAÇÃO legada ──
/** o inteiro "compact-u16" da Solana (1 a 3 bytes) */
export function compactU16(n: number): number[] {
  const out: number[] = []; let v = n;
  for (;;) { let b = v & 0x7f; v >>= 7; if (v) { b |= 0x80; out.push(b); } else { out.push(b); return out; } }
}
export const PROGRAMA_MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const PROGRAMA_SISTEMA = "11111111111111111111111111111111";
export type Instrucao = { memo: string } | { transferir: { para: string; lamports: bigint } };

/** a MENSAGEM (o que se assina): o pagador é o único assinante; as contas, o blockhash e as instruções */
export function montarMensagem(pagador: string, blockhash: string, ins: readonly Instrucao[]): Uint8Array {
  // as contas: [pagador (assina, escreve), destinos (escrevem), programas (só leitura)]
  const destinos = [...new Set(ins.flatMap((i) => ("transferir" in i ? [i.transferir.para] : [])))].filter((d) => d !== pagador);
  const programas = [...new Set(ins.map((i) => ("memo" in i ? PROGRAMA_MEMO : PROGRAMA_SISTEMA)))];
  const contas = [pagador, ...destinos, ...programas], idx = (k: string) => contas.indexOf(k);
  const bytes: number[] = [1, 0, programas.length, ...compactU16(contas.length)];
  for (const c of contas) { const b = deBase58(c); if (b.length !== 32) throw new Error(`conta inválida: ${c}`); bytes.push(...b); }
  const bh = deBase58(blockhash); if (bh.length !== 32) throw new Error("blockhash inválido"); bytes.push(...bh);
  bytes.push(...compactU16(ins.length));
  for (const i of ins) {
    if ("memo" in i) {
      const d = Buffer.from(i.memo, "utf8"); if (d.length > 566) throw new Error("memo grande demais");
      bytes.push(idx(PROGRAMA_MEMO), ...compactU16(0), ...compactU16(d.length), ...d);
    } else {
      const d = Buffer.alloc(12); d.writeUInt32LE(2, 0); d.writeBigUInt64LE(i.transferir.lamports, 4);   // (SystemInstruction::Transfer = 2)
      bytes.push(idx(PROGRAMA_SISTEMA), ...compactU16(2), idx(pagador), idx(i.transferir.para), ...compactU16(12), ...d);
    }
  }
  return Uint8Array.from(bytes);
}
/** a transação assinada, em base64 (o que o `sendTransaction` recebe) */
export function transacaoAssinada(semente: Uint8Array, blockhash: string, ins: readonly Instrucao[]): { base64: string; assinatura: string } {
  const pagador = base58(publicaDe(semente)), msg = montarMensagem(pagador, blockhash, ins), sig = assinar(semente, msg);
  return { base64: Buffer.concat([Buffer.from(compactU16(1)), Buffer.from(sig), Buffer.from(msg)]).toString("base64"), assinatura: base58(sig) };
}

// ── o RPC ──
export const RPC_DEVNET = "https://api.devnet.solana.com";
export async function rpc<T>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const r = await fetch(url, { method: "POST", signal: ctl.signal, cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = (await r.json()) as { result?: T; error?: { message?: string } };
    if (j.error || j.result === undefined) throw new Error(`RPC ${method}: ${j.error?.message ?? r.status}`);
    return j.result;
  } finally { clearTimeout(t); }
}
export const LAMPORTS = 1_000_000_000;
export const saldoSol = async (url: string, endereco: string) => (await rpc<{ value: number }>(url, "getBalance", [endereco, { commitment: "confirmed" }])).value / LAMPORTS;
/** assina e envia; devolve a assinatura (o id da transação no explorer) */
export async function enviar(url: string, semente: Uint8Array, ins: readonly Instrucao[]): Promise<string> {
  const { value } = await rpc<{ value: { blockhash: string } }>(url, "getLatestBlockhash", [{ commitment: "confirmed" }]);
  const tx = transacaoAssinada(semente, value.blockhash, ins);
  return rpc<string>(url, "sendTransaction", [tx.base64, { encoding: "base64", preflightCommitment: "confirmed" }]);
}
/** o faucet da devnet (limitado por eles — pode recusar) */
export const pedirAirdrop = (url: string, endereco: string, sol: number) => rpc<string>(url, "requestAirdrop", [endereco, Math.round(sol * LAMPORTS)]);
