/**
 * lib/avatars/pipeline.ts — gera os quadros de um avatar (server-only, sharp).
 *
 * Peça por peça, porque o dono ACOMPANHA a criação ao vivo no estúdio (EstudioAvatar):
 *   gerarBase(personagem, cor)          → o quadro `idle` (+ a base 1024 que as edições usam)
 *   gerarQuadro(base, estado, ajuste?)  → uma expressão a partir da MESMA base (reroll = chamar de novo)
 * Cada expressão: edição imagem→imagem → máscara de diferença → cola só a região mudada sobre a
 * base (quadros sem tremor) → WebP 512 + miniatura 160 recortada no rosto.
 * O estúdio (dev: Etapa A, no Claude Code · admin: Etapa B) chama peça a peça; o CLI
 * (scripts/avatars/gerar.ts) usa `gerarSetAvatar` pra regerar em lote o que já foi aprovado.
 */
import sharp from "sharp";
import { gerarImagemGemini } from "./gemini-image";
import { colarComMascara, mascaraDeEdicao, FRACAO_MAX, FRACAO_MIN } from "./mascara";
import { PREFIXO_REFERENCIA, promptBase, promptEdicao, ORDEM_GERACAO } from "./prompts";
import type { EstadoSprite } from "./estados";

/** Tamanho de trabalho/saída cheia e da miniatura (cards de 22–64 px, retina). */
export const LADO = 512;
export const LADO_PEQUENO = 160;
export const LADO_BASE = 1024;

/**
 * Recorte da miniatura (frações do quadro): o rosto ocupa ~metade do quadro cheio, então a
 * miniatura aproxima no rosto pra ele não sumir num círculo de 26 px.
 */
export const RECORTE_PEQUENO = { esquerda: 0.15, topo: 0.08, lado: 0.7 } as const;

export type QuadroGerado = { grande: Buffer; pequeno: Buffer };
export type EstadoEditavel = Exclude<EstadoSprite, "idle">;

const COR_PADRAO = ["#67e8f9", "#2563eb"] as const;

async function cru(img: Buffer): Promise<Uint8Array> {
  const { data } = await sharp(img).resize(LADO, LADO, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, data.length);
}

async function saidas(rgb: Uint8Array): Promise<QuadroGerado> {
  const raw = { raw: { width: LADO, height: LADO, channels: 3 as const } };
  const grande = await sharp(Buffer.from(rgb), raw).webp({ quality: 88 }).toBuffer();
  const r = RECORTE_PEQUENO;
  const pequeno = await sharp(Buffer.from(rgb), raw)
    .extract({ left: Math.round(r.esquerda * LADO), top: Math.round(r.topo * LADO), width: Math.round(r.lado * LADO), height: Math.round(r.lado * LADO) })
    .resize(LADO_PEQUENO, LADO_PEQUENO)
    .webp({ quality: 86 })
    .toBuffer();
  return { grande, pequeno };
}

/** Qualquer imagem → base quadrada 1024 em WebP (o formato que circula entre estúdio e servidor). */
export async function normalizarBase(img: Buffer): Promise<Buffer> {
  return sharp(img).resize(LADO_BASE, LADO_BASE, { fit: "cover" }).removeAlpha().webp({ quality: 92 }).toBuffer();
}

/**
 * BASE: texto → imagem. Devolve a base 1024 (pras edições) + o quadro idle. Com `referencia` (a base
 * de um avatar já aprovado), o modelo desenha um personagem NOVO no MESMO estilo anime.
 */
export async function gerarBase(personagem: string, cor?: readonly [string, string], tentativas = 2, referencia?: Buffer | null): Promise<{ base: Buffer; idle: QuadroGerado }> {
  const p = (personagem || "").trim();
  if (p.length < 20) throw new Error("descreva o personagem (≥ 20 caracteres)");
  let erro = "";
  const prompt = promptBase(p, cor ?? COR_PADRAO);
  for (let t = 0; t < tentativas; t++) {
    try {
      const gerada = referencia
        ? await gerarImagemGemini(`${PREFIXO_REFERENCIA}\n${prompt}`, { data: referencia, mimeType: "image/webp" })
        : await gerarImagemGemini(prompt);
      const base = await normalizarBase(gerada);
      return { base, idle: await saidas(await cru(base)) };
    } catch (e) { erro = (e as Error).message; }
  }
  throw new Error(`base: ${erro || "falhou"}`);
}

/** A base que o admin trouxe (foto atual, base salva) → idle. */
export async function idleDaBase(base: Buffer): Promise<QuadroGerado> {
  return saidas(await cru(base));
}

/**
 * Uma expressão a partir da base. Rejeita (e tenta de novo) edição que não mudou nada ou que
 * redesenhou o personagem — fora da faixa [FRACAO_MIN, FRACAO_MAX] da área.
 */
export async function gerarQuadro(base: Buffer, estado: EstadoEditavel, ajuste?: string, tentativas = 2): Promise<QuadroGerado & { fracao: number }> {
  const baseRgb = await cru(base);
  let ultimo = "";
  for (let t = 0; t < tentativas; t++) {
    try {
      const editada = await gerarImagemGemini(promptEdicao(estado, ajuste), { data: base, mimeType: "image/webp" });
      const edRgb = await cru(editada);
      const { alfa, fracao } = mascaraDeEdicao(baseRgb, edRgb, LADO, LADO);
      if (fracao < FRACAO_MIN) { ultimo = `a edição não mudou nada (${(fracao * 100).toFixed(2)}%)`; continue; }
      if (fracao > FRACAO_MAX) { ultimo = `a edição redesenhou demais (${(fracao * 100).toFixed(1)}%)`; continue; }
      return { ...(await saidas(colarComMascara(baseRgb, edRgb, alfa, LADO * LADO))), fracao };
    } catch (e) {
      ultimo = (e as Error)?.message || String(e);
    }
  }
  throw new Error(ultimo || "falhou");
}

// ─── lote (CLI) ─────────────────────────────────────────────────────────────

export type SetAvatar = {
  base: Buffer;
  quadros: Partial<Record<EstadoSprite, QuadroGerado>>;
  falhas: { estado: EstadoSprite; motivo: string }[];
};

/** Roda `fn` em `itens` com no máximo `n` simultâneos (a cota do Vertex agradece). */
async function emLotes<T>(itens: readonly T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  const fila = [...itens];
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => {
    for (let t = fila.shift(); t !== undefined; t = fila.shift()) await fn(t);
  }));
}

export async function gerarSetAvatar(o: {
  personagem?: string;
  cor?: readonly [string, string];
  baseImagem?: Buffer;
  estados?: readonly EstadoEditavel[];
  concorrencia?: number;
  onProgresso?: (msg: string) => void;
}): Promise<SetAvatar> {
  const log = o.onProgresso ?? (() => {});
  let base: Buffer;
  const quadros: SetAvatar["quadros"] = {};
  if (o.baseImagem) {
    base = await normalizarBase(o.baseImagem);
    quadros.idle = await idleDaBase(base);
  } else {
    log("gerando a base…");
    const g = await gerarBase(o.personagem || "", o.cor);
    base = g.base;
    quadros.idle = g.idle;
  }
  const falhas: SetAvatar["falhas"] = [];
  // todas a partir da MESMA base (nunca em cadeia: erro não acumula)
  await emLotes(o.estados ?? ORDEM_GERACAO, o.concorrencia ?? 2, async (estado) => {
    log(`${estado}…`);
    try {
      const q = await gerarQuadro(base, estado);
      quadros[estado] = { grande: q.grande, pequeno: q.pequeno };
      log(`${estado} ✓`);
    } catch (e) {
      falhas.push({ estado, motivo: (e as Error).message });
      log(`${estado} ✗ ${(e as Error).message}`);
    }
  });
  return { base, quadros, falhas };
}
