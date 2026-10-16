/**
 * Cyberespaço — os ESTACIONAMENTOS DAS PLATAFORMAS DE ESTUDO (PURO, sem three). O trânsito entre os lugares de estudo
 * é de MOTO (pedido do dono, out/2026: fluidez e movimento no céu): cada lugar de estudo — as salas da Zaeon
 * (biblioteca, jardim, lounge) e as universidades flutuantes (UNILAB e os campi) — tem do lado uma PLATAFORMA DE
 * ESTACIONAMENTO com no máximo 33 vagas (3 filas × 11). A IA chega de moto, deixa a moto na vaga (fica lá, parada,
 * enquanto ela estuda), vai de mochila até o lugar dela e, na hora de ir embora, volta pra vaga e sai de moto.
 * Lotou: chega como antes (sem moto parada). O mesmo layout pra todo mundo e pro render.
 *  - nas SALAS da Zaeon: pra FORA da sala (do lado oposto à escada), na altura do piso dela — flutua com a ilha; o do
 *    LOUNGE fica na GARAGEM dele: uma plataforma do lado esquerdo, 25 m abaixo, com um elevador de luz até o pátio
 *    (lib/cyber/templo `GARAGEM_LOUNGE`) — as motos saíram do pátio (mais frames; mais gente na festa);
 *  - nas UNIVERSIDADES: colada à borda do disco, do lado virado pra Zaeon (de onde as motos chegam).
 */
import { CIDADE, daSala, mundo } from "./ceu";
import { GARAGEM_LOUNGE } from "./templo";
import { PLATAFORMAS, plataformaAtiva } from "./plataformas";
import { PLATAFORMA_MOTO, noLote, tamanhoDoLote, vagaNoLote, type Lote } from "./motos";

const TODOS_COM_VAGA = ["biblioteca", "jardim", "lounge", "univ", "ufc", "unifor", "uece"] as const;
export type AmbienteVaga = (typeof TODOS_COM_VAGA)[number];
/** os estacionamentos que EXISTEM (as universidades só com UNIVERSIDADES_NO_MAPA) */
export const AMBIENTES_COM_VAGA: readonly AmbienteVaga[] = TODOS_COM_VAGA.filter((a) => a === "biblioteca" || a === "jardim" || a === "lounge" || plataformaAtiva(a));
export const temVaga = (amb: string | undefined): amb is AmbienteVaga => !!amb && (AMBIENTES_COM_VAGA as readonly string[]).includes(amb);

/** o máximo de vagas de cada estacionamento (o pedido do dono) */
export const VAGAS_POR_ESTACIONAMENTO = 33;
const FILAS = 3, POR_FILA = 11, VAO = 6;

export type EstacionamentoEstudo = Lote & {
  ambiente: AmbienteVaga;
  /** está na Zaeon (o engine soma a boia da ilha) */
  zaeon: boolean;
  /** altura do piso no MUNDO (na Zaeon: sem a boia) */
  y: number;
};
/** uma VAGA (mundo): onde a moto fica (em cima do pedestal) e pra onde ela aponta (`rumo`, o mesmo do corpo das IAs) */
export type VagaEstudo = { ambiente: AmbienteVaga; i: number; x: number; y: number; z: number; rumo: number; zaeon: boolean };

const base = { filas: FILAS, porFila: POR_FILA, espacamento: 4.6, entreFilas: 8 };
const PROF = tamanhoDoLote({ id: "estudo", x: 0, z: 0, rot: 0, ceu: true, alt: 0, ...base }).prof;

function naSalaDaZaeon(amb: "biblioteca" | "jardim" | "lounge"): EstacionamentoEstudo {
  const s = CIDADE.salas[amb], dx = Math.cos(s.ang), dz = Math.sin(s.ang), d = s.r + VAO + PROF / 2;
  const l = { x: s.x + dx * d, z: s.z + dz * d }, w = mundo(l);
  // a FRENTE das vagas (+z do lote) virada pra sala
  return { id: "estudo", ambiente: amb, x: w.x, z: w.z, rot: Math.atan2(s.x - l.x, s.z - l.z), ceu: true, alt: s.y, zaeon: true, y: CIDADE.pisoY + s.y, ...base };
}
function naUniversidade(amb: "univ" | "ufc" | "unifor" | "uece"): EstacionamentoEstudo {
  const P = PLATAFORMAS[amb], vx = CIDADE.centro.x - P.centro.x, vz = CIDADE.centro.z - P.centro.z, n = Math.hypot(vx, vz) || 1;
  const d = P.r + VAO + PROF / 2, x = P.centro.x + (vx / n) * d, z = P.centro.z + (vz / n) * d;
  return { id: "estudo", ambiente: amb, x, z, rot: Math.atan2(P.centro.x - x, P.centro.z - z), ceu: false, alt: 0, zaeon: false, y: P.y, ...base };
}

/** o do LOUNGE fica na GARAGEM dele (lib/cyber/templo `GARAGEM_LOUNGE`): a plataforma do lado esquerdo, `desce` m
 *  abaixo do piso do lounge; as filas correm no eixo z da sala e a frente das vagas vira pro elevador (+x) */
function naGaragemDoLounge(): EstacionamentoEstudo {
  const s = CIDADE.salas.lounge, G = GARAGEM_LOUNGE, c = daSala(s, G.x - 4, G.z), f = daSala(s, G.x - 3, G.z), w = mundo(c), alt = s.y - G.desce + 0.16;
  return { id: "estudo", ambiente: "lounge", x: w.x, z: w.z, rot: Math.atan2(f.x - c.x, f.z - c.z), ceu: true, alt, zaeon: true, y: CIDADE.pisoY + alt, ...base };
}
export const ESTACIONAMENTOS: Record<AmbienteVaga, EstacionamentoEstudo> = {
  biblioteca: naSalaDaZaeon("biblioteca"), jardim: naSalaDaZaeon("jardim"), lounge: naGaragemDoLounge(),
  univ: naUniversidade("univ"), ufc: naUniversidade("ufc"), unifor: naUniversidade("unifor"), uece: naUniversidade("uece"),
};

const cache = new Map<string, VagaEstudo>();
/** a vaga `i` (0..32) do estacionamento de `amb`: a fila da FRENTE (a mais perto do lugar de estudo) enche primeiro */
export function vagaEstudo(amb: AmbienteVaga, i: number): VagaEstudo {
  const k = `${amb}|${i}`, c = cache.get(k); if (c) return c;
  const l = ESTACIONAMENTOS[amb], f = Math.floor(i / l.porFila), q = vagaNoLote(l, f, i % l.porFila), w = noLote(l, q.x, q.z);
  const v: VagaEstudo = { ambiente: amb, i, x: w.x, y: l.y + PLATAFORMA_MOTO.altura, z: w.z, rumo: l.rot, zaeon: l.zaeon };
  cache.set(k, v);
  return v;
}
