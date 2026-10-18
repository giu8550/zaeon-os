/**
 * Cyberespaço — o RIFLE CÓSMICO (PURO). A 2ª fase do sistema de ação (out/2026, pedido do dono: depois da magia, as armas
 * de projéteis): um rifle de energia azul-neon com veias violeta e cano triplo (components/cyber/RifleCosmico), com as
 * animações do Mixamo (public/anim/rifle — convertidas por scripts/anim/mixamo-para-clip.mjs) e a MIRA LIVRE.
 *
 * O que fica aqui (sem three, testado):
 *  - os números da arma: cadência, dano (a CABEÇA vale mais), a DISPERSÃO (mirando × do quadril × andando × rajada), o
 *    CALOR (atirar esquenta; superaqueceu, trava até esfriar — no lugar de munição);
 *  - o MOVIMENTO realista com a arma: a velocidade tem INÉRCIA (acelera e freia — sem arranque nem parada seca), o corpo
 *    VIRA no seu ritmo (andando gira rápido, correndo abre a curva) e, parado, uma virada grande é o "Rifle Turn" (a
 *    animação de virar nos pés) — nada de girar no lugar num quadro só;
 *  - os PESOS das animações de andar com a arma (frente / trás / lados — a direção relativa ao corpo: mirando, ela anda de
 *    lado e de costas olhando pra mira) e a velocidade de cada uma (os pés acompanham o chão);
 *  - a MIRA: o ponto pra onde o tiro vai (o primeiro corpo no raio da câmera, o chão ou o alcance) — a bala sai do cano
 *    e vai até ele, então acerta onde a cruz está;
 *  - a rede: o tiro vai no `mag` (o nº 3 — lib/cyber/magia `codificarLancamento`) e a arma na mão/mirando nos bits de
 *    cima do `mov`.
 */
import { CORPO_MAGIA, type P3 } from "./magia";

export type NomeClipeRifle = "mira" | "anda" | "esq" | "dir" | "cambaleia" | "gira" | "freia" | "morre" | "morreDir";
/** a duração (s) de cada clipe (public/anim/rifle) — o engine marca os tempos sem esperar o download */
export const DURACAO_RIFLE: Readonly<Record<NomeClipeRifle, number>> = {
  mira: 3.1, anda: 1.37, esq: 1.07, dir: 1.43, cambaleia: 1.83, gira: 1.7, freia: 1.47, morre: 4.4, morreDir: 3.3,
};
export const ehClipeRifle = (n: string): n is NomeClipeRifle => n in DURACAO_RIFLE;
export const urlDoClipeRifle = (n: NomeClipeRifle) => `/anim/rifle/${n}.json`;
/** a velocidade (m/s) em que cada andar foi gravado (o deslocamento do quadril ÷ a duração) — a escala de tempo do clipe
 *  é a velocidade do jogo ÷ esta (os pés não deslizam). "anda" de trás pra frente = andar de costas */
export const VEL_CLIPE = { anda: 1.0, esq: 1.34, dir: 0.76 } as const;
/** o "Rifle Turn": quanto o corpo gira (rad; o clipe vira pra DIREITA) e a parte do clipe em que os pés giram */
export const GIRO_CLIPE = { ang: 2.2, ini: 0.12, fim: 0.78 } as const;

export const RIFLE = {
  /** a tecla que saca/guarda (fora do inventário) */
  tecla: "1",
  /** dano de um tiro no corpo e o multiplicador na CABEÇA (o tiro pega acima de `alturaCabeca` m dos pés) */
  dano: 9, cabeca: 1.8, alturaCabeca: 1.5,
  /** s entre dois tiros (segurando: rajada automática) */
  cadencia: 0.13,
  /** a bala: velocidade (m/s), alcance (m) e raio (m) */
  vel: 140, alcance: 90, raio: 0.12,
  /** o CALOR: cada tiro soma, esfria por segundo depois de um respiro; em 1 trava (superaquecido) por `trava` s */
  calorPorTiro: 0.07, esfria: 0.55, respiro: 0.3, trava: 1.6,
  /** a DISPERSÃO (rad, meio-ângulo): mirando, do quadril, a mais andando/correndo, a mais por tiro seguido (some rápido) */
  dispersao: { mira: 0.003, quadril: 0.028, andando: 0.012, correndo: 0.03, porTiro: 0.006, maxRajada: 0.03, recupera: 0.09 },
  /** a velocidade (m/s) mirando (passo tático), de costas mirando e a aceleração/freada (m/s²) */
  velMira: 2.3, velCostas: 1.6, acel: 16, freio: 11, freioCorrida: 7,
  /** o giro do corpo (rad/s): andando, correndo (abre a curva) e mirando (segue a câmera); parado, acima de `limiarGiro`
   *  rad de diferença vira com o "Rifle Turn" */
  giroAndando: 6.5, giroCorrendo: 3.4, giroMira: 10, limiarGiro: 1.75, velGiroClipe: 2.2,
  /** mirando: o tronco torce até `torcaoMax` rad pra mira antes de os pés acompanharem */
  torcaoMax: 0.9,
  /** depois de um tiro, quanto tempo (s) o corpo fica na POSE DE ATAQUE (a arma no ombro) antes de voltar ao descanso */
  posturaDepoisDoTiro: 2.5,
  /** o zoom da mira (o FOV), a distância da câmera por cima do ombro e o olho dela (pro lado direito e a altura acima
   *  dos pés — o personagem fica à esquerda e a arma à mostra) */
  fovMira: 38, distMira: 3.1, ombroMira: 0.9, alturaMira: 1.62,
} as const;
/** o `mag` do tiro: o nº 3 (1 e 2 são os feitiços) */
export const NUM_TIRO = 3;
/** os bits do RIFLE na `mov` da rede (os 3 de baixo são o estado do movimento) */
export const MOV_RIFLE = 8, MOV_MIRA = 16;
export const movComRifle = (mov: number, naMao: boolean, mirando: boolean) => (mov & 7) | (naMao ? MOV_RIFLE : 0) | (naMao && mirando ? MOV_MIRA : 0);
export const rifleDoMov = (mov: number) => ({ naMao: (mov & MOV_RIFLE) !== 0, mirando: (mov & MOV_MIRA) !== 0 });

/** a diferença angular b − a, em (−π, π] */
export const difAng = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** gira `atual` rumo a `alvo` no máximo `passo` rad */
export function girarAte(atual: number, alvo: number, passo: number): number {
  const d = difAng(atual, alvo);
  return Math.abs(d) <= passo ? alvo : atual + Math.sign(d) * passo;
}

export type V2 = { x: number; z: number };
/** a INÉRCIA: a velocidade vai até a pedida com aceleração limitada (acelerar ≠ frear: correndo, a freada é mais longa) */
export function passoInercia(v: V2, alvo: V2, dt: number, o: { acel: number; freio: number }): V2 {
  const dx = alvo.x - v.x, dz = alvo.z - v.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: alvo.x, z: alvo.z };
  const freando = Math.hypot(alvo.x, alvo.z) < Math.hypot(v.x, v.z) - 1e-6, max = (freando ? o.freio : o.acel) * dt;
  if (d <= max) return { x: alvo.x, z: alvo.z };
  return { x: v.x + (dx / d) * max, z: v.z + (dz / d) * max };
}

/** a velocidade no referencial do CORPO (frente = o rumo `facing`; lado + = direita de quem anda) */
export function noCorpo(v: V2, facing: number): { frente: number; lado: number } {
  const fx = Math.sin(facing), fz = Math.cos(facing);
  return { frente: v.x * fx + v.z * fz, lado: -(v.x * fz - v.z * fx) };
}

export type PesosRifle = { parado: number; frente: number; tras: number; esq: number; dir: number; escala: { frente: number; tras: number; esq: number; dir: number } };
/** os PESOS dos andares com a arma pela velocidade no corpo: cada direção pela componente dela; parado some com a
 *  velocidade. As escalas de tempo seguem o chão (limitadas: rápido demais vira um trote esquisito) */
export function pesosRifle(c: { frente: number; lado: number }): PesosRifle {
  const vel = Math.hypot(c.frente, c.lado), mov = Math.min(1, vel / 0.5);
  const f = Math.max(0, c.frente), t = Math.max(0, -c.frente), d = Math.max(0, c.lado), e = Math.max(0, -c.lado), soma = f + t + d + e || 1;
  const esc = (v: number, base: number) => Math.min(2.4, Math.max(0.55, v / base));
  return {
    parado: 1 - mov, frente: (mov * f) / soma, tras: (mov * t) / soma, esq: (mov * e) / soma, dir: (mov * d) / soma,
    escala: { frente: esc(vel, VEL_CLIPE.anda), tras: esc(vel, VEL_CLIPE.anda), esq: esc(vel, VEL_CLIPE.esq), dir: esc(vel, VEL_CLIPE.dir) },
  };
}

/** precisa do "Rifle Turn"? parado (ou quase) e a diferença pro rumo pedido passou do limiar. O sinal: + = pra esquerda */
export function precisaVirar(facing: number, alvo: number, vel: number): number {
  const d = difAng(facing, alvo);
  return vel < 0.8 && Math.abs(d) > RIFLE.limiarGiro ? d : 0;
}
/** o quanto da virada (0..1) já foi, pelo tempo do clipe (0..1) — os pés giram no meio dele, suave */
export function fracaoDoGiro(u: number): number {
  const x = Math.max(0, Math.min(1, (u - GIRO_CLIPE.ini) / (GIRO_CLIPE.fim - GIRO_CLIPE.ini)));
  return x * x * (3 - 2 * x);
}

/** o CALOR depois de `dt` (esfria só depois do respiro) e se travou/destravou */
export function passoCalor(calor: number, dt: number, agora: number, ultimoTiro: number): number {
  return agora - ultimoTiro < RIFLE.respiro ? calor : Math.max(0, calor - RIFLE.esfria * dt);
}
export const podeAtirar = (agora: number, proximoTiro: number, travadoAte: number) => agora >= proximoTiro && agora >= travadoAte;

/** a DISPERSÃO agora (rad): mirando × do quadril, a velocidade e a rajada (`rajada` = tiros seguidos, já decaindo) */
export function dispersao(mirando: number, vel: number, rajada: number): number {
  const D = RIFLE.dispersao, base = D.quadril + (D.mira - D.quadril) * Math.max(0, Math.min(1, mirando));
  const mov = vel > 5 ? D.correndo : vel > 0.4 ? D.andando * Math.min(1, vel / 3) : 0;
  return base + mov * (1 - 0.6 * mirando) + Math.min(D.maxRajada, rajada * D.porTiro);
}
/** desvia a direção `d` (unitária) de até `ang` rad, com dois números 0..1 (aleatórios) — um cone uniforme no disco */
export function desviar(d: P3, ang: number, r1: number, r2: number): P3 {
  if (ang <= 0) return { ...d };
  const up = Math.abs(d.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ax = up.y * d.z - up.z * d.y, ay = up.z * d.x - up.x * d.z, az = up.x * d.y - up.y * d.x; const la = Math.hypot(ax, ay, az); ax /= la; ay /= la; az /= la;
  const bx = d.y * az - d.z * ay, by = d.z * ax - d.x * az, bz = d.x * ay - d.y * ax;
  const r = Math.tan(ang) * Math.sqrt(r1), th = 2 * Math.PI * r2, u = r * Math.cos(th), w = r * Math.sin(th);
  const x = d.x + ax * u + bx * w, y = d.y + ay * u + by * w, z = d.z + az * u + bz * w, l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
}

/** o raio (de `o`, direção unitária `d`, até `alcance` m) passa pelo CORPO (a cápsula de pé em `pe`)? A fração do
 *  alcance no ponto mais perto do eixo — exato (segmento × segmento), não amostrado: o raio da câmera é longo */
export function raioNoCorpo(o: P3, d: P3, alcance: number, pe: P3, folga = 0): number | null {
  const R = CORPO_MAGIA.raio + folga, y0 = pe.y + 0.15, y1 = pe.y + CORPO_MAGIA.altura - 0.1;
  // o eixo do corpo: q(s) = (pe.x, y0 + s(y1 − y0), pe.z); o raio: p(t) = o + d·t, t ∈ [0, alcance]
  const wx = o.x - pe.x, wy = o.y - y0, wz = o.z - pe.z, h = y1 - y0;
  const b = d.y * h, c = h * h, dd = d.x * wx + d.y * wy + d.z * wz, e = h * wy, den = c - b * b;   // (a = |d|² = 1)
  let t = den > 1e-9 ? (b * e - c * dd) / den : 0, s: number;
  t = Math.max(0, Math.min(alcance, t)); s = Math.max(0, Math.min(1, (b * t + e) / c));
  t = Math.max(0, Math.min(alcance, b * s - dd));
  const px = o.x + d.x * t - pe.x, py = o.y + d.y * t - (y0 + h * s), pz = o.z + d.z * t - pe.z;
  return Math.hypot(px, py, pz) <= R ? t / alcance : null;
}

/** um corpo que a mira pode pegar (os pés) */
export type CorpoMira = { id: string; pe: P3 };
/** o PONTO DA MIRA: do olho da câmera na direção dela — o 1º corpo no raio, senão o chão (y = `chao`), senão o alcance.
 *  `ignorar` = quem atira (o raio passa por cima do ombro dele) */
export function pontoDaMira(olho: P3, dir: P3, corpos: CorpoMira[], o: { alcance: number; chao: number | null; ignorar?: string }): { p: P3; id: string | null } {
  let u = 1, id: string | null = null;
  for (const c of corpos) { if (c.id === o.ignorar) continue; const h = raioNoCorpo(olho, dir, o.alcance, c.pe); if (h !== null && h < u) { u = h; id = c.id; } }
  if (o.chao !== null && dir.y < -1e-4) { const uc = (o.chao - olho.y) / (dir.y * o.alcance); if (uc > 0 && uc < u) { u = uc; id = null; } }
  return { p: { x: olho.x + dir.x * o.alcance * u, y: olho.y + dir.y * o.alcance * u, z: olho.z + dir.z * o.alcance * u }, id };
}
/** o tiro pegou na CABEÇA? (a altura do ponto acima dos pés) e o dano */
export const naCabeca = (yPonto: number, yPe: number) => yPonto - yPe >= RIFLE.alturaCabeca;
export const danoDoTiro = (cabeca: boolean) => Math.round(RIFLE.dano * (cabeca ? RIFLE.cabeca : 1));

/** quantos tiros novos um `seq` trouxe (o 11 bits do `mag` dá a volta); no máximo 6 de uma vez (pacote atrasado) */
export const tirosNovos = (seqAnt: number, seq: number) => Math.min(6, (((seq - seqAnt) % 2048) + 2048) % 2048);

/** a MORTE pelo lado de onde veio o golpe: da direita, a "Death From Right"; da esquerda, ela espelhada; senão, "Dying" */
export function animacaoDaMorte(lado: "frente" | "tras" | "esquerda" | "direita"): { clipe: NomeClipeRifle; espelhar: boolean } {
  return lado === "direita" ? { clipe: "morreDir", espelhar: false } : lado === "esquerda" ? { clipe: "morreDir", espelhar: true } : { clipe: "morre", espelhar: false };
}
