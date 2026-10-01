/**
 * Link de convite da cartolina — token ASSINADO, sem tabela.
 *
 * token = base64url(payload).base64url(hmac)   payload = { b: boardId, p: papel, e: expira, s: sal }
 *
 * - Assinado com NEXTAUTH_SECRET: ninguém fabrica um convite pra board alheio nem promove
 *   "leitor" a "editor" editando o link.
 * - `s` (sal) tem que bater com Cartolina.conviteSalt: o dono troca o sal → todo link já
 *   enviado morre. É a revogação, sem guardar token nenhum.
 * - Comparação em tempo constante.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isPapelConvidavel, type PapelConvidavel } from "@/lib/cartolina/access";

export const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const segredo = () => {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET ausente: convite desabilitado");
  return s;
};
const assinar = (dados: string) => createHmac("sha256", segredo()).update("cartolina-convite:" + dados).digest();

export const novoSal = () => randomBytes(12).toString("base64url");

export function criarConvite(boardId: string, papel: PapelConvidavel, sal: string, agora = Date.now()): string {
  const dados = b64(JSON.stringify({ b: boardId, p: papel, e: agora + VALIDADE_MS, s: sal }));
  return `${dados}.${b64(assinar(dados))}`;
}

export type ConviteLido = { boardId: string; papel: PapelConvidavel; sal: string };

/** null = inválido, adulterado, de outro board ou vencido. NÃO confere o sal (quem chama compara com o banco). */
export function lerConvite(token: unknown, boardId: string, agora = Date.now()): ConviteLido | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [dados, mac, ...resto] = token.split(".");
  if (!dados || !mac || resto.length) return null;
  try {
    const esperado = assinar(dados);
    const veio = Buffer.from(mac, "base64url");
    if (veio.length !== esperado.length || !timingSafeEqual(veio, esperado)) return null;
    const o = JSON.parse(Buffer.from(dados, "base64url").toString("utf8"));
    if (o?.b !== boardId || !isPapelConvidavel(o?.p) || typeof o?.e !== "number" || o.e < agora || typeof o?.s !== "string") return null;
    return { boardId: o.b, papel: o.p, sal: o.s };
  } catch {
    return null; // base64/JSON quebrado = convite inválido, nunca 500
  }
}
