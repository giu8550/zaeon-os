/**
 * lib/lounge3d/netcode.ts — NETCODE dos avatares remotos (PURO): a pose chega em pacotes (~20 Hz, com jitter);
 * desenhar o pacote mais novo direto fica "travadinho". Então cada remoto tem uma TRILHA de amostras e é
 * desenhado ATRASO_MS no passado, INTERPOLANDO entre as duas amostras em volta desse instante; se os pacotes
 * atrasam e o instante passa da última amostra, EXTRAPOLA pela última velocidade (dead reckoning) por até
 * MAX_EXTRAP_MS — e então VOLTA suave pra última posição real em VOLTA_MS (sem pacote novo não dá pra saber se
 * parou: melhor voltar pro conhecido do que ficar à frente). Se a última amostra diz que PAROU (`moving: false`),
 * nem extrapola. Salto grande (portal, teleporte) não é "arrastado": corta seco.
 *
 * O TEMPO de cada amostra é o do REMETENTE (`t` da pose, no relógio dele) levado pro relógio local por `RelogioRemoto`.
 * Antes era a hora da CHEGADA — e os patches chegam em lotes de 50 ms: a pose mandada a cada 66 ms parecia ter andado
 * em 50 ou em 100 ms, a velocidade aparente dobrava e caía pela metade, e a MOTO (155–280 m/s) dava trancos de metros
 * pra frente e pra trás a cada quadro — os outros viam a pessoa "duplicada e glitchando" (bug de out/2026).
 */
export const ATRASO_MS = 100;
export const MAX_EXTRAP_MS = 250;
export const VOLTA_MS = 200;
const SALTO_M = 100;   // acima disso (além do que dá pra andar no intervalo) entre duas amostras = teleporte (não interpola)
/** a maior velocidade de verdade (m/ms): a moto no boost, 1000 km/h ≈ 0,28 — com folga */
const VEL_MAX = 0.32;

/** leva o relógio do REMETENTE (`t` em ms, o dele) pro LOCAL: o atraso mínimo visto é o da rede sem fila; cada amostra
 *  deixa ele subir 0,1 ms (acompanha deriva/rota mais lenta sem mexer na velocidade desenhada); um salto de mais de 1 s (o outro recarregou e o
 *  relógio dele recomeçou) recomeça a conta */
export class RelogioRemoto {
  private off: number | null = null;
  /** o instante LOCAL da amostra mandada em `t` (remetente) que chegou em `chegada` (local) */
  local(t: number, chegada: number): number {
    const cand = chegada - t;
    this.off = this.off === null || Math.abs(cand - this.off) > 1000 ? cand : Math.min(cand, this.off + 0.1);
    return t + this.off;
  }
}

export type Amostra = { t: number; x: number; z: number; facing: number; moving?: boolean };

const angDif = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Trilha {
  private buf: Amostra[] = [];
  /** guarda a amostra (em ordem de chegada; `t` = relógio local de quando chegou) */
  empurrar(a: Amostra) {
    const ult = this.buf[this.buf.length - 1];
    if (ult && a.t <= ult.t) return;
    if (ult && Math.hypot(a.x - ult.x, a.z - ult.z) > SALTO_M + VEL_MAX * (a.t - ult.t)) this.buf = [];   // teleporte: recomeça a trilha
    this.buf.push(a);
    if (this.buf.length > 24) this.buf.splice(0, this.buf.length - 24);
  }
  get vazia() { return this.buf.length === 0; }
  /** a pose a desenhar agora (`agora` no mesmo relógio de `t`) */
  amostrar(agora: number): { x: number; z: number; facing: number } | null {
    const b = this.buf; if (!b.length) return null;
    const tr = agora - ATRASO_MS;
    if (b.length === 1 || tr <= b[0]!.t) { const a = b[0]!; return { x: a.x, z: a.z, facing: a.facing }; }
    for (let i = b.length - 1; i > 0; i--) {
      const a = b[i - 1]!, c = b[i]!;
      if (tr >= a.t && tr <= c.t) { const k = (tr - a.t) / Math.max(1, c.t - a.t); return { x: a.x + (c.x - a.x) * k, z: a.z + (c.z - a.z) * k, facing: a.facing + angDif(a.facing, c.facing) * k }; }
    }
    // passou da última: parado → fica nela; andando → dead reckoning pela última velocidade, com teto, e depois volta
    const a = b[b.length - 2]!, c = b[b.length - 1]!;
    if (c.moving === false) return { x: c.x, z: c.z, facing: c.facing };
    const dt = Math.max(1, c.t - a.t), alem = tr - c.t;
    const ex = alem <= MAX_EXTRAP_MS ? alem : MAX_EXTRAP_MS * Math.max(0, 1 - (alem - MAX_EXTRAP_MS) / VOLTA_MS);
    return { x: c.x + ((c.x - a.x) / dt) * ex, z: c.z + ((c.z - a.z) / dt) * ex, facing: c.facing };
  }
}
