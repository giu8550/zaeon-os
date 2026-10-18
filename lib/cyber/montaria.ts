/**
 * Cyberespaço — SUBIR NA MOTO (PURO). Antes (até out/2026) o personagem aparecia sentado no banco num quadro só; agora a
 * SUBIDA é uma coreografia (~1,6 s), pedido do dono, com a câmera chegando perto pra mostrar:
 *  1. CHEGA: um pulinho de onde está até o lado ESQUERDO da moto (a moto da vaga fica em cima da plataforma, ~1 m acima);
 *  2. PEGA no guidão: as mãos vão pros punhos;
 *  3. PASSA A PERNA: o quadril sobe e vai pro banco enquanto a perna DIREITA passa por cima da traseira (num arco alto);
 *  4. SENTA: o quadril desce no banco e os pés vão pras pedaleiras;
 *  5. a moto da vaga ERGUE até a altura de lançamento (com ele já montado) — só aí os comandos valem.
 * Aqui ficam os tempos, os pesos de cada parte do corpo e os caminhos (do grupo e do pé que passa por cima).
 */

export type V3 = { x: number; y: number; z: number };

/** a duração (s) da subida e de cada fase (frações do tempo) */
export const SUBIDA = { dur: 1.6, chega: [0, 0.26], pega: [0.22, 0.42], perna: [0.42, 0.78], senta: [0.7, 0.92], ergue: [0.88, 1] } as const;
/** a CÂMERA durante a subida: ¾ por trás e pela esquerda (o lado de quem sobe), perto */
export const CAMERA_SUBIDA = { giro: 1.2, dist: 4.8, pitch: 0.24 } as const;
/** a câmera PERTO na moto (o V alterna perto ⇄ longe): a distância, quanto ela recua com a velocidade e a altura do olho */
export const CAMERA_MOTO_PERTO = { dist: 4.3, porVel: 1.6, olho: 0.35 } as const;

const suave = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
const fase = (u: number, [a, b]: readonly [number, number]) => suave((u - a) / (b - a));

/** os PESOS de cada parte (0..1) em `u` (0..1 da subida) */
export function pesosSubida(u: number): { pulo: number; maos: number; pernas: number; perna: number; senta: number; ergue: number; agacha: number } {
  const pulo = fase(u, SUBIDA.chega);
  // o AGACHAMENTO: no impulso do pulinho e quando ele aterrissa ao lado da moto
  const ag = (c: number, l: number) => Math.max(0, 1 - Math.abs(u - c) / l);
  return {
    pulo, maos: fase(u, SUBIDA.pega), pernas: fase(u, [SUBIDA.chega[1] - 0.04, SUBIDA.pega[1]]), perna: fase(u, SUBIDA.perna),
    senta: fase(u, SUBIDA.senta), ergue: fase(u, SUBIDA.ergue), agacha: Math.max(ag(0.03, 0.05), ag(SUBIDA.chega[1] + 0.02, 0.06)),
  };
}

const lerp = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
/** onde fica o GRUPO do avatar (os pés dele, de pé; sentado, o banco): de onde estava → o lado da moto (num pulinho) →
 *  o banco (subindo um pouco no meio: o quadril passa por cima) */
export function caminhoDaSubida(u: number, de: V3, lado: V3, banco: V3): V3 {
  const w = pesosSubida(u);
  if (w.perna <= 0) {   // o PULINHO até o lado da moto: um arco que passa acima do mais alto dos dois
    const p = lerp(de, lado, w.pulo), topo = Math.max(de.y, lado.y) + 0.45;
    const arco = 4 * w.pulo * (1 - w.pulo);
    return { x: p.x, y: p.y + arco * Math.max(0, topo - (de.y + lado.y) / 2), z: p.z };
  }
  // passando a perna, o quadril fica na altura de quem está EM PÉ (o grupo no chão ao lado) e só desce pro banco quando
  // ele SENTA (o avatar baixa o corpo junto — senão o quadril ia ~1 m acima do banco e o pé de apoio não alcançava o chão)
  const p = lerp(lado, banco, w.perna);
  return { x: p.x, y: lado.y + (banco.y - lado.y) * w.senta + 0.1 * Math.sin(Math.PI * w.perna), z: p.z };
}
/** o PÉ DIREITO passando por cima da traseira: do chão ao lado → alto atrás do banco → a pedaleira (curva de Bézier) */
export function arcoDaPerna(s: number, chao: V3, atras: V3, pedal: V3): V3 {
  const u = Math.max(0, Math.min(1, s)), a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
  return { x: a * chao.x + b * atras.x + c * pedal.x, y: a * chao.y + b * atras.y + c * pedal.y, z: a * chao.z + b * atras.z + c * pedal.z };
}
/** a altura da moto durante a subida: parada até ele sentar; depois sobe até a de lançamento */
export const alturaDaMoto = (u: number, parada: number, lancamento: number) => parada + (lancamento - parada) * pesosSubida(u).ergue;
