/**
 * Cyberespaço — a ROTINA DA EXAMINER (PURO, com o acaso injetável). Ela é a única personagem que anda pela cidadela
 * (fora o DJ): TRABALHA NO DESKTOP do templo (em cima do lounge — lib/cyber/templo `mesaDaExaminer`), em pé, digitando,
 * de costas pro sigilo de Metatron (quem entra vê as asas negras). Pedido do dono (out/2026): ela NÃO FICA NA SALA COM
 * O JOGADOR — quando alguém chega no templo, ela larga a mesa e desce a escadaria pro lounge (e, se a pessoa vem
 * subindo, cruza com ela no caminho); só volta pra mesa depois que o templo fica vazio um tempo. Com MÚSICA no lounge,
 * de vez em quando ela desce pra pista por conta própria, dança um pouco e volta.
 * O caminho é no referencial do lounge (`daSala`) → local da ilha; a altura vem de `alturaNaCidade` (o templo, a
 * escadaria, o deck e o pátio já estão lá).
 */
import { CIDADE, PISTA, alturaNaCidade, daSala, mundo, rotDaSala } from "./ceu";
import { ESCADARIA, curvaDaEscadaria, mesaDaExaminer } from "./templo";
import { comprimento, pontoNaRota } from "./caminhos";
import type { P2 } from "./colisao";
import type { Estado } from "./vidaPersonagem";

/** a velocidade a pé (m/s), quanto tempo ela fica em cada lugar (s, min–máx), a chance de descer com música, quanto
 *  ela leva pra largar a mesa quando alguém chega (s) e quanto tempo o templo tem que ficar VAZIO pra ela voltar (s) */
export const ROTINA_EXAMINER = { vel: 3, mesa: [70, 160], pista: [60, 140], chanceDescer: 0.55, reage: 1.2, voltaVazio: 20 } as const;
export type FaseExaminer = "mesa" | "descendo" | "pista" | "subindo";

const L = () => CIDADE.salas.lounge;
const naIlha = (x: number, z: number): P2 => daSala(L(), x, z);
/** o lugar dela na MESA (em pé na frente do desktop, local da ilha) e pra onde olha (a tela) */
export function lugarNaMesa(): P2 & { rumo: number } {
  const m = mesaDaExaminer(), p = naIlha(m.pe.x, m.pe.z), tela = naIlha(m.x, m.z);
  return { ...p, rumo: Math.atan2(tela.x - p.x, tela.z - p.z) };
}
/** o lugar dela na PISTA (no meio da pista, de frente pro palco — o mesmo rumo de quem dança) */
export function lugarNaPista(): P2 & { rumo: number } {
  const s = L(), p = naIlha(PISTA.x + 4, PISTA.z);   // (um pouco de lado do centro: o meio é de quem chega dançando)
  return { ...p, rumo: rotDaSala(s) + Math.PI };
}
/** o caminho da mesa até a pista (local da ilha): a entrada do templo, a escadaria inteira (de cima pra baixo), a borda
 *  do deck e a pista */
let rotaCache: P2[] | null = null;
export function rotaMesaPista(): P2[] {
  if (rotaCache) return rotaCache;
  const { pts } = curvaDaEscadaria(), ult = ESCADARIA.controle[ESCADARIA.controle.length - 1]!;
  const a = lugarNaMesa(), b = lugarNaPista();
  const escada = [...pts].reverse().filter((_, i, l) => i % 3 === 0 || i === l.length - 1).map((q) => naIlha(q.x, q.z));
  return (rotaCache = [{ x: a.x, z: a.z }, naIlha(ult.x, ult.z), ...escada, { x: b.x, z: b.z }]);
}
const altura = (p: P2) => alturaNaCidade(mundo(p));

export class RotinaExaminer {
  fase: FaseExaminer = "mesa";
  /** quanto do caminho ela já andou (m, 0 = a mesa, `len` = a pista) */
  private s = 0;
  private k = 0; private fica: number; private vazio = Infinity; private gente = 0; private musica = false;
  private readonly rota = rotaMesaPista(); private readonly len = comprimento(this.rota);
  constructor(private readonly acaso: () => number = Math.random) { this.fica = this.sortear(ROTINA_EXAMINER.mesa); }
  private sortear(f: readonly [number, number]) { return f[0] + this.acaso() * (f[1] - f[0]); }
  /** um passo do relógio; `musica` = está tocando no lounge agora; `genteNoTemplo` = tem jogador no templo agora */
  passo(dt: number, musica: boolean, genteNoTemplo = false) {
    const R = ROTINA_EXAMINER;
    this.musica = musica; this.k += dt;
    if (genteNoTemplo) { this.vazio = 0; this.gente += dt; } else { this.vazio += dt; this.gente = 0; }
    if (this.fase === "mesa") {
      if (this.gente >= R.reage) { this.fase = "descendo"; this.k = 0; return; }   // chegou alguém: ela se levanta e vai
      if (this.k < this.fica) return;
      this.k = 0;
      if (musica && this.acaso() < R.chanceDescer) this.fase = "descendo"; else this.fica = this.sortear(R.mesa);
    } else if (this.fase === "descendo") {
      this.s = Math.min(this.len, this.s + R.vel * dt);
      if (this.s >= this.len) { this.fase = "pista"; this.k = 0; this.fica = this.sortear(R.pista); }
    } else if (this.fase === "pista") {
      // só volta com o templo vazio há um tempo — e quando acabou o tempo dela na pista ou a música parou
      if (this.vazio >= R.voltaVazio && (this.k >= this.fica || !musica)) { this.fase = "subindo"; this.k = 0; }
    } else {
      if (genteNoTemplo) { this.fase = "descendo"; this.k = 0; return; }   // alguém chegou lá em cima: dá meia-volta
      this.s = Math.max(0, this.s - R.vel * dt);
      if (this.s <= 0) { this.fase = "mesa"; this.k = 0; this.fica = this.sortear(R.mesa); }
    }
  }
  /** o estado pro corpo (o mesmo formato da agenda dos personagens) */
  estado(): Estado {
    const base = { lugar: `examiner-${this.fase}`, sentado: 0, meditando: 0, moto: null };
    if (this.fase === "descendo" || this.fase === "subindo") {
      const q = pontoNaRota(this.rota, this.s), rumo = this.fase === "descendo" ? q.rumo : q.rumo + Math.PI;
      return { ...base, atividade: "passear", fase: "andando", pos: { x: q.x, z: q.z }, y: altura(q), rumo, andando: true, danca: 0 };
    }
    if (this.fase === "pista") {
      const l = lugarNaPista(), danca = this.musica ? 1 : 0;
      return { ...base, atividade: danca ? "dancar" : "passear", fase: "ficando", pos: { x: l.x, z: l.z }, y: altura(l), rumo: l.rumo, andando: false, danca };
    }
    // na MESA: em pé, digitando no desktop (a pose de trabalhar nas telas — `sentado` = digitar)
    const l = lugarNaMesa();
    return { ...base, atividade: "trabalhar", fase: "ficando", sentado: 1, pos: { x: l.x, z: l.z }, y: altura(l), rumo: l.rumo, andando: false, danca: 0 };
  }
}
