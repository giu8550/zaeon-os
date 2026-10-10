/**
 * Cyberespaço — a ROTINA DA EXAMINER (PURO, com o acaso injetável). Depois da reforma da capela (out/2026) ela é a
 * única personagem que anda pela cidadela: fica no ALTAR (o templo do lounge — lib/cyber/templo), e QUANDO A MÚSICA
 * ESTÁ ROLANDO, de vez em quando, desce a escadaria até a pista do lounge, dança um pouco e volta pro altar. Sem
 * música, ela não sai do altar (e, se a música para com ela na pista, ela volta).
 * O caminho é no referencial do lounge (`daSala`) → local da ilha; a altura vem de `alturaNaCidade` (o templo, a
 * escadaria, o deck e o pátio já estão lá).
 */
import { CIDADE, PISTA, alturaNaCidade, daSala, mundo, rotDaSala } from "./ceu";
import { ESCADARIA, TEMPLO, curvaDaEscadaria, entradaDoTemplo } from "./templo";
import { comprimento, pontoNaRota } from "./caminhos";
import type { P2 } from "./colisao";
import type { Estado } from "./vidaPersonagem";

/** a velocidade a pé (m/s) e quanto tempo ela fica em cada lugar (s, min–máx) */
export const ROTINA_EXAMINER = { vel: 3, altar: [70, 160], pista: [60, 140], chanceDescer: 0.55 } as const;
export type FaseExaminer = "altar" | "descendo" | "pista" | "subindo";

const L = () => CIDADE.salas.lounge;
const naIlha = (x: number, z: number): P2 => daSala(L(), x, z);
/** o lugar dela no ALTAR (perto da entrada do templo, por dentro — o sanfoneiro fica no palco do centro) e pra onde olha */
export function lugarNoAltar(): P2 & { rumo: number } {
  const e = entradaDoTemplo().ang, d = 9;
  const p = naIlha(TEMPLO.x + Math.cos(e) * d, TEMPLO.z + Math.sin(e) * d), ent = naIlha(TEMPLO.x + Math.cos(e) * TEMPLO.r, TEMPLO.z + Math.sin(e) * TEMPLO.r);
  return { ...p, rumo: Math.atan2(ent.x - p.x, ent.z - p.z) };   // virada pra entrada (quem sobe a escadaria encontra ela)
}
/** o lugar dela na PISTA (no meio da pista, de frente pro palco — o mesmo rumo de quem dança) */
export function lugarNaPista(): P2 & { rumo: number } {
  const s = L(), p = naIlha(PISTA.x + 4, PISTA.z);   // (um pouco de lado do centro: o meio é de quem chega dançando)
  return { ...p, rumo: rotDaSala(s) + Math.PI };
}
/** o caminho do altar até a pista (local da ilha): a entrada do templo, a escadaria inteira (de cima pra baixo), a
 *  borda do deck e a pista */
let rotaCache: P2[] | null = null;
export function rotaAltarPista(): P2[] {
  if (rotaCache) return rotaCache;
  const { pts } = curvaDaEscadaria(), ult = ESCADARIA.controle[ESCADARIA.controle.length - 1]!;
  const a = lugarNoAltar(), b = lugarNaPista();
  const escada = [...pts].reverse().filter((_, i, l) => i % 3 === 0 || i === l.length - 1).map((q) => naIlha(q.x, q.z));
  return (rotaCache = [{ x: a.x, z: a.z }, naIlha(ult.x, ult.z), ...escada, { x: b.x, z: b.z }]);
}
const altura = (p: P2) => alturaNaCidade(mundo(p));

export class RotinaExaminer {
  fase: FaseExaminer = "altar";
  private k = 0; private fica: number;
  private readonly rota = rotaAltarPista(); private readonly len = comprimento(this.rota);
  constructor(private readonly acaso: () => number = Math.random) { this.fica = this.sortear(ROTINA_EXAMINER.altar); }
  private sortear(f: readonly [number, number]) { return f[0] + this.acaso() * (f[1] - f[0]); }
  /** um passo do relógio; `musica` = está tocando no lounge agora */
  passo(dt: number, musica: boolean) {
    this.k += dt;
    if (this.fase === "altar") {
      if (this.k < this.fica) return;
      this.k = 0;
      if (musica && this.acaso() < ROTINA_EXAMINER.chanceDescer) this.fase = "descendo"; else this.fica = this.sortear(ROTINA_EXAMINER.altar);
    } else if (this.fase === "pista") {
      if (musica && this.k < this.fica) return;
      this.fase = "subindo"; this.k = 0;   // acabou o tempo dela ou a música parou: volta pro altar
    } else if (this.k * ROTINA_EXAMINER.vel >= this.len) {
      const desceu = this.fase === "descendo"; this.k = 0;
      this.fase = desceu ? "pista" : "altar"; this.fica = this.sortear(desceu ? ROTINA_EXAMINER.pista : ROTINA_EXAMINER.altar);
    }
  }
  /** o estado pro corpo (o mesmo formato da agenda dos personagens) */
  estado(): Estado {
    const base = { lugar: `examiner-${this.fase}`, sentado: 0, meditando: 0, moto: null };
    if (this.fase === "descendo" || this.fase === "subindo") {
      const s = Math.min(this.len, this.k * ROTINA_EXAMINER.vel), q = pontoNaRota(this.rota, this.fase === "descendo" ? s : this.len - s);
      const rumo = this.fase === "descendo" ? q.rumo : q.rumo + Math.PI;
      return { ...base, atividade: "passear", fase: "andando", pos: { x: q.x, z: q.z }, y: altura(q), rumo, andando: true, danca: 0 };
    }
    const l = this.fase === "pista" ? lugarNaPista() : lugarNoAltar();
    return { ...base, atividade: this.fase === "pista" ? "dancar" : "passear", fase: "ficando", pos: { x: l.x, z: l.z }, y: altura(l), rumo: l.rumo, andando: false, danca: this.fase === "pista" ? 1 : 0 };
  }
}
