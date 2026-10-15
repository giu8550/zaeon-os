/**
 * lib/octa/genart.ts — P5 do Pack Octa (§7). Arte generativa DETERMINÍSTICA no chat do Octa.
 * Mesma seed → mesma peça, byte a byte; seeds diferentes divergem. A verificação roda ANTES de "assinar"
 * (o hash da peça é o que um dia vai on-chain, se virar credencial). Peça original, gerada aqui — não imita
 * obra de artista nenhum (ética da skill vendor/skills/genart).
 * A skill genart (camilleroux/genart-skill, MIT, SHA pinado em config/vetting/repos.json) guia o agente quando
 * o pedido é maior que este gerador; este arquivo é o gerador nativo + o determinism-check.
 */
import { createHash } from "node:crypto";

/** PRNG sfc32 semeado por sha256(seed): reprodutível em qualquer máquina. */
export function prng(seed: string): () => number {
  const h = createHash("sha256").update(seed).digest();
  let a = h.readUInt32LE(0), b = h.readUInt32LE(4), c = h.readUInt32LE(8), d = h.readUInt32LE(12);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
}

export type PecaGenart = { tipo: "genart"; seed: string; titulo: string; svg: string; hash: string; tracos: Record<string, string> };

const PALETAS: Array<[string, string[]]> = [
  ["noite", ["#0b1020", "#3b82f6", "#a855f7", "#e2e8f0"]],
  ["brasa", ["#1a0b07", "#f97316", "#ef4444", "#fde68a"]],
  ["mata", ["#06140d", "#10b981", "#84cc16", "#ecfccb"]],
  ["neon", ["#050505", "#22d3ee", "#f472b6", "#facc15"]],
];

const f2 = (n: number) => n.toFixed(2);

/** Gera a peça (SVG 1000×1000, resolução-agnóstica via viewBox). Só usa o PRNG — nada de Math.random/Date. */
export function gerarPeca(seed: string): PecaGenart {
  const r = prng(seed);
  const [nomePaleta, pal] = PALETAS[Math.floor(r() * PALETAS.length)];
  const fios = 18 + Math.floor(r() * 30);
  const ondulacao = r() < 0.5 ? "calma" : "turbulenta";
  const amp = ondulacao === "calma" ? 40 : 140;
  const partes: string[] = [`<rect width="1000" height="1000" fill="${pal[0]}"/>`];
  for (let i = 0; i < fios; i++) {
    const y0 = 80 + (840 * i) / fios;
    const cor = pal[1 + Math.floor(r() * (pal.length - 1))];
    const fase = r() * Math.PI * 2;
    const freq = 1 + r() * 4;
    let d = `M0 ${f2(y0)}`;
    for (let x = 25; x <= 1000; x += 25) d += ` L${x} ${f2(y0 + Math.sin(fase + (x / 1000) * freq * Math.PI * 2) * amp * r())}`;
    partes.push(`<path d="${d}" fill="none" stroke="${cor}" stroke-width="${f2(1 + r() * 3)}" stroke-opacity="${f2(0.35 + r() * 0.6)}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${partes.join("")}</svg>`;
  const hash = createHash("sha256").update(svg).digest("hex");
  return { tipo: "genart", seed, titulo: `Fios ${nomePaleta} #${hash.slice(0, 6)}`, svg, hash, tracos: { paleta: nomePaleta, fios: String(fios), ondulacao } };
}

/** Determinism-check: renderiza N vezes e exige o mesmo hash. Só peça verificada pode ser "assinada". */
export function verificarDeterminismo(seed: string, vezes = 3): { ok: boolean; hashes: string[] } {
  const hashes = Array.from({ length: vezes }, () => gerarPeca(seed).hash);
  return { ok: new Set(hashes).size === 1, hashes };
}

/** O Octa decide se a mensagem é um pedido de arte (abre a peça como artefato). */
export function ehPedidoDeArte(msg: string): boolean {
  return /\b(arte|generativ[ao]|gen ?art|desenh[ae]|pintura|ilustra[çc][ãa]o)\b/i.test(msg) && !/\b(arte final|estado da arte)\b/i.test(msg);
}
