/**
 * lib/avatars/mascara.ts — a MÁSCARA DE DIFERENÇA entre a base e um quadro editado (PURO,
 * buffers crus, sem sharp) — o que garante que trocar de quadro não "treme".
 *
 * O editor de imagem muda olhos/boca, mas também re-renderiza o resto com um ruído fino de
 * reamostragem (linhas de 1–2 px). Se a gente trocasse o quadro inteiro, o card tremeria a cada
 * piscada. Então: diferença por pixel → limiar → EROSÃO (mata o ruído fino) → DILATAÇÃO (cobre a
 * região mudada com folga) → DESFOQUE (borda suave). Só essa região do quadro editado é colada
 * sobre a base; fora dela o pixel é o da base, idêntico em todos os quadros.
 */

export type OpcoesMascara = {
  /** Soma |ΔR|+|ΔG|+|ΔB| acima disso conta como mudança real. */
  limiar?: number;
  erosao?: number;
  dilatacao?: number;
  suavizacao?: number;
};

/** Diferença por pixel (soma dos canais RGB) de duas imagens cruas do mesmo tamanho. */
export function mapaDiferenca(a: Uint8Array, b: Uint8Array, n: number, canais = 3): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d += Math.abs(a[i * canais + c] - b[i * canais + c]);
    out[i] = d > 255 ? 255 : d;
  }
  return out;
}

/** Filtro de máximo (dilatação) ou mínimo (erosão) quadrado, separável. Binário 0/255. */
function filtroExtremo(m: Uint8Array, w: number, h: number, r: number, max: boolean): Uint8Array {
  if (r <= 0) return m;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const pega = max ? Math.max : Math.min;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = max ? 0 : 255;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = pega(v, m[y * w + k]);
      tmp[y * w + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = max ? 0 : 255;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = pega(v, tmp[k * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Desfoque de caixa separável (borda suave da máscara). */
function desfocar(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return m;
  const tmp = new Float32Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { s += m[y * w + k]; c++; }
      tmp[y * w + x] = s / c;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0, c = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { s += tmp[k * w + x]; c++; }
      out[y * w + x] = Math.round(s / c);
    }
  }
  return out;
}

/**
 * Máscara alfa (0–255) da região realmente mudada + a FRAÇÃO da imagem que mudou (pós-erosão,
 * antes da folga) — o pipeline usa a fração pra rejeitar edição que não mudou nada (≈0) ou que
 * redesenhou o personagem inteiro (grande demais).
 */
export function mascaraDeEdicao(
  base: Uint8Array,
  editado: Uint8Array,
  w: number,
  h: number,
  canais = 3,
  o: OpcoesMascara = {},
): { alfa: Uint8Array; fracao: number } {
  const { limiar = 60, erosao = 1, dilatacao = 14, suavizacao = 6 } = o;
  const n = w * h;
  const d = mapaDiferenca(base, editado, n, canais);
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = d[i] > limiar ? 255 : 0;
  const limpo = filtroExtremo(bin, w, h, erosao, false);
  let mudou = 0;
  for (let i = 0; i < n; i++) if (limpo[i]) mudou++;
  const folga = filtroExtremo(limpo, w, h, dilatacao, true);
  return { alfa: desfocar(folga, w, h, suavizacao), fracao: mudou / n };
}

/** base·(1−α) + editado·α, por pixel. Saída no formato da base (RGB cru). */
export function colarComMascara(base: Uint8Array, editado: Uint8Array, alfa: Uint8Array, n: number, canais = 3): Uint8Array {
  const out = new Uint8Array(n * canais);
  for (let i = 0; i < n; i++) {
    const a = alfa[i] / 255;
    for (let c = 0; c < canais; c++) {
      const j = i * canais + c;
      out[j] = Math.round(base[j] * (1 - a) + editado[j] * a);
    }
  }
  return out;
}

/** Limites aceitáveis da fração mudada por quadro (fora disso o pipeline tenta de novo). */
export const FRACAO_MIN = 0.0004; // boca entreaberta ≈ 0,1% do quadro
export const FRACAO_MAX = 0.3;
