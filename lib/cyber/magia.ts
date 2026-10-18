/**
 * Cyberespaço — MAGIA e PODERES CÓSMICOS (PURO, sem three). Pack de ação, out/2026 (o dono: "um sistema sofisticado de
 * ação com magia… iniciando por magia"). Os feitiços usam as animações do Mixamo convertidas pro esqueleto do avatar
 * (scripts/anim/mixamo-para-clip.mjs → public/anim/magia/*.json):
 *  - ESTILHAÇO ESTELAR (Q): uma mão (ataque1m) — um cristal rápido, dano baixo, recarga curta; quem leva, a reação LEVE;
 *  - NOVA CÓSMICA (E): as duas mãos (ataque2m) — uma esfera lenta e grande, dano alto, explode em área e EMPURRA; quem
 *    leva, a reação FORTE (o corpo recua);
 *  - ESCUDO (segurar R): os braços cruzados (defesa) — o golpe que vem pela FRENTE perde a maior parte do dano; gasta
 *    energia enquanto segura.
 * Tudo gasta ENERGIA CÓSMICA (a barra que se recarrega). O projétil sai no quadro do LANÇAMENTO da animação, anda em
 * linha reta pra onde a câmera mira e acerta por VARREDURA (segmento × cápsula do corpo — não atravessa ninguém rápido).
 *
 * REDE (como o combate da espada): o lançamento vai como um número (`mag`: sequência, feitiço e a mira) e CADA máquina
 * simula o mesmo projétil a partir do lançador; quem LEVA confere em si e aplica o dano (o alvo é a autoridade). Só há
 * dano entre duas pessoas na ZONA DE DUELO (a praça: a plataforma das motos e das corridas).
 */

export type IdFeitico = "estilhaco" | "nova";
export type NomeClipeMagia = "ataque1m" | "ataque2m" | "defesa" | "idleA" | "idleB" | "reacaoEsq" | "reacaoLeveDir" | "aterrissa" | "recua" | "correLado";
export type Feitico = {
  id: IdFeitico; nome: string; tecla: string; num: 1 | 2;
  /** a animação de quem lança, a velocidade dela e a fração do clipe em que o projétil SAI */
  clipe: NomeClipeMagia; velClipe: number; disparo: number;
  /** o projétil: velocidade (m/s), raio (m), alcance (m) e o raio da EXPLOSÃO (0 = não explode) */
  vel: number; raio: number; alcance: number; explosao: number;
  dano: number; energia: number; recarga: number;
  /** a reação de quem leva e o empurrão (m — o quanto o corpo recua) */
  reacao: "leve" | "forte"; empurra: number;
  /** as cores (o núcleo e o brilho) */
  cor: number; brilho: number;
};
export const FEITICOS: Readonly<Record<IdFeitico, Feitico>> = {
  estilhaco: { id: "estilhaco", nome: "Estilhaço Estelar", tecla: "q", num: 1, clipe: "ataque1m", velClipe: 1.7, disparo: 0.6,
    vel: 36, raio: 0.32, alcance: 48, explosao: 0, dano: 14, energia: 12, recarga: 0.55, reacao: "leve", empurra: 0.35, cor: 0xd9f6ff, brilho: 0x5fd8ff },
  nova: { id: "nova", nome: "Nova Cósmica", tecla: "e", num: 2, clipe: "ataque2m", velClipe: 1.3, disparo: 0.7,
    vel: 21, raio: 0.85, alcance: 42, explosao: 2.6, dano: 32, energia: 35, recarga: 3.2, reacao: "forte", empurra: 1.25, cor: 0xf2e1ff, brilho: 0xa86bff },
};
export const ESCUDO = { tecla: "r", clipe: "defesa" as NomeClipeMagia, gasto: 16, reduz: 0.75, arco: 1.25 } as const;
export const ENERGIA = { max: 100, regen: 15, atraso: 0.9 } as const;
/** o corpo (cápsula vertical): raio e altura — o mesmo raio do combate da espada */
export const CORPO_MAGIA = { raio: 0.45, altura: 1.8 } as const;

/** a duração do lançamento (s) e o instante em que o projétil sai (s depois do começo) */
export const duracaoLancamento = (f: Feitico, durClipe: number) => durClipe / f.velClipe;
export const instanteDoDisparo = (f: Feitico, durClipe: number) => duracaoLancamento(f, durClipe) * f.disparo;

/** a ENERGIA: dá pra lançar? (e quanto sobra) */
export const podeLancar = (energia: number, f: Feitico, recargaAte: number, agora: number) => energia >= f.energia && agora >= recargaAte;
/** recarrega `dt` s (só depois do atraso desde o último gasto) */
export function recarregarEnergia(energia: number, dt: number, agora: number, ultimoGasto: number): number {
  if (agora - ultimoGasto < ENERGIA.atraso) return energia;
  return Math.min(ENERGIA.max, energia + ENERGIA.regen * dt);
}

export type P3 = { x: number; y: number; z: number };
/** a direção da mira: `yaw` (rumo, como o `facing` do engine: atan2(dx, dz)) e `pitch` (+ = pra cima) */
export const direcaoDaMira = (yaw: number, pitch: number): P3 => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
/** onde o projétil está `t` s depois de sair de `de` na direção `dir` (null = passou do alcance) */
export function posDoProjetil(f: Feitico, de: P3, dir: P3, t: number): P3 | null {
  const d = f.vel * t; if (d > f.alcance) return null;
  return { x: de.x + dir.x * d, y: de.y + dir.y * d, z: de.z + dir.z * d };
}

/** o projétil (o segmento `a`→`b` deste quadro, raio `r`) encosta no CORPO (a cápsula com a base em `pe`)?
 *  Devolve a fração do segmento onde encosta (0..1) ou null */
export function varreCorpo(a: P3, b: P3, r: number, pe: P3): number | null {
  const R = CORPO_MAGIA.raio + r, y0 = pe.y + R * 0.3, y1 = pe.y + CORPO_MAGIA.altura - R * 0.3;
  // a menor distância entre o segmento do projétil e o eixo do corpo (o segmento vertical y0..y1), por amostragem fina
  const N = 12; let melhor: number | null = null;
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, z = a.z + (b.z - a.z) * u;
    const yc = Math.max(y0, Math.min(y1, y)), d = Math.hypot(x - pe.x, y - yc, z - pe.z);
    if (d <= R) { melhor = u; break; }
  }
  return melhor;
}

/** de que LADO o golpe vem, no referencial de quem leva (`rumo` = pra onde ele olha): pela frente, por trás ou dos lados */
export function ladoDoGolpe(alvo: { x: number; z: number; rumo: number }, de: { x: number; z: number }): "frente" | "tras" | "esquerda" | "direita" {
  const dx = de.x - alvo.x, dz = de.z - alvo.z;
  let a = Math.atan2(dx, dz) - alvo.rumo; a = Math.atan2(Math.sin(a), Math.cos(a));   // 0 = de frente; + = pela esquerda dele
  if (Math.abs(a) <= Math.PI / 4) return "frente";
  if (Math.abs(a) >= (3 * Math.PI) / 4) return "tras";
  return a > 0 ? "esquerda" : "direita";
}
/** a REAÇÃO (a animação e se ESPELHA): temos a forte vindo da esquerda e a leve vindo da direita — os outros lados saem
 *  espelhados; de frente/de trás, a do lado que mais combina */
export function reacaoDoGolpe(f: Feitico, lado: ReturnType<typeof ladoDoGolpe>): { clipe: NomeClipeMagia; espelhar: boolean } {
  const daEsquerda = lado === "esquerda" || lado === "frente";
  if (f.reacao === "forte") return { clipe: "reacaoEsq", espelhar: !daEsquerda };
  return { clipe: "reacaoLeveDir", espelhar: daEsquerda };
}
/** o ESCUDO segura? (de pé com ele erguido e o golpe vindo pela frente, dentro do arco) */
export function escudoSegura(alvo: { x: number; z: number; rumo: number }, de: { x: number; z: number }): boolean {
  let a = Math.atan2(de.x - alvo.x, de.z - alvo.z) - alvo.rumo; a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) <= ESCUDO.arco;
}
/** o dano que fica (com o escudo erguido e o golpe pela frente, só uma parte) */
export const danoComEscudo = (dano: number, segura: boolean) => (segura ? Math.round(dano * (1 - ESCUDO.reduz)) : dano);
/** a EXPLOSÃO (a Nova): o dano cai com a distância do centro, até a borda */
export function danoDaExplosao(f: Feitico, d: number): number {
  if (!f.explosao || d > f.explosao) return 0;
  return Math.round(f.dano * (1 - 0.6 * (d / f.explosao)));
}

/** o LANÇAMENTO na rede: um inteiro só (cabe no uint32 do servidor) — a sequência (0..2047), o feitiço (1..3) e a mira
 *  (o rumo em 1024 passos e a inclinação em 256, de −0,6 a +0,6 rad) */
export const MIRA_PITCH = 0.6;
export function codificarLancamento(seq: number, f: { num: number }, yaw: number, pitch: number): number {
  const y = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), yq = Math.round((y / (2 * Math.PI)) * 1023);
  const pq = Math.round(((Math.max(-MIRA_PITCH, Math.min(MIRA_PITCH, pitch)) + MIRA_PITCH) / (2 * MIRA_PITCH)) * 255);
  return (((seq % 2048) * 4 + f.num) * 1024 + yq) * 256 + pq;
}
export function decodificarLancamento(v: number): { seq: number; num: number; feitico: Feitico | null; yaw: number; pitch: number } | null {
  if (!Number.isInteger(v) || v <= 0 || v >= 2 ** 32) return null;
  const pq = v % 256, r1 = Math.floor(v / 256), yq = r1 % 1024, r2 = Math.floor(r1 / 1024), num = r2 % 4, seq = Math.floor(r2 / 4);
  const feitico = Object.values(FEITICOS).find((f) => f.num === num) ?? null;
  return { seq, num, feitico, yaw: (yq / 1023) * 2 * Math.PI, pitch: (pq / 255) * 2 * MIRA_PITCH - MIRA_PITCH };
}
/** a `mov` da rede (lib/lounge3d): os 3 bits de baixo = o estado do movimento (6 = o ESCUDO erguido); os de cima, o
 *  RIFLE (lib/cyber/rifle: 8 = na mão, 16 = mirando) */
export const MOV_ESCUDO = 6;
export const estadoDoMov = (mov: number) => mov & 7;

/** a duração (s) de cada clipe convertido (public/anim/magia — o engine marca os tempos sem esperar o download) */
export const DURACAO_CLIPE: Readonly<Record<NomeClipeMagia, number>> = {
  ataque1m: 2.3, ataque2m: 2.7, defesa: 0.5, idleA: 11.4, idleB: 7.47, reacaoEsq: 1.57, reacaoLeveDir: 1, aterrissa: 1.1, recua: 1.2, correLado: 0.77,
};
export const urlDoClipe = (n: NomeClipeMagia) => `/anim/magia/${n}.json`;
