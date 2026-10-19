/**
 * Cyberespaço — o PERSONAGEM que cada pessoa escolhe ao entrar no jogo (depois do nome de usuário): o GÊNERO (o modelo
 * de astronauta — a feminina ou o masculino, components/cyber/CorpoAstronauta) e a COR. Puro (sem three) — testado.
 * Guardado em `User.cyberPerfil.personagem` (sem coluna nova no banco); o servidor valida e manda pra sala.
 */
export type Genero = "f" | "m";
export type Personagem = { genero: Genero; cor: string };

/** as cores da PERSONAGEM STANDARD FEMININA (a astronauta): o tom forte das placas e o pastel do macacão de cada uma —
 *  só tons femininos, curados. `placa` é a cor que a identifica (o seletor, o nome no chat) */
export const PALETAS_FEMININAS: readonly { nome: string; rotulo: string; placa: number; malha: number }[] = [
  { nome: "rosa", rotulo: "Rosa", placa: 0xd2508a, malha: 0xf7c9dc },
  { nome: "lilas", rotulo: "Lilás", placa: 0x7d5ad6, malha: 0xdccdf7 },
  { nome: "lavanda", rotulo: "Lavanda", placa: 0x6b6292, malha: 0xece6f8 },
  { nome: "menta", rotulo: "Menta", placa: 0x2f9c84, malha: 0xc9f2e4 },
  { nome: "coral", rotulo: "Coral", placa: 0xe2584a, malha: 0xffd3c9 },
  { nome: "ceu", rotulo: "Céu", placa: 0x3d7fd6, malha: 0xcfe5ff },
  { nome: "pessego", rotulo: "Pêssego", placa: 0xd9814b, malha: 0xffe0c7 },
  { nome: "magenta", rotulo: "Magenta", placa: 0xb2309e, malha: 0xf4c6ec },
  { nome: "perola", rotulo: "Pérola", placa: 0x8d8796, malha: 0xf5f1ec },
  { nome: "eve", rotulo: "Original", placa: 0x3d5250, malha: 0xaa9f96 },
];
/** as cores do MASCULINO (o astronauta): as placas na cor, a malha e os tubos escuros */
export const CORES_MASCULINAS: readonly { nome: string; rotulo: string; cor: string }[] = [
  { nome: "azul", rotulo: "Azul", cor: "#2f7bff" },
  { nome: "ciano", rotulo: "Ciano", cor: "#22c3e6" },
  { nome: "verde", rotulo: "Verde", cor: "#2fb36b" },
  { nome: "vermelho", rotulo: "Vermelho", cor: "#e0443a" },
  { nome: "laranja", rotulo: "Laranja", cor: "#f08a24" },
  { nome: "amarelo", rotulo: "Amarelo", cor: "#e8c22a" },
  { nome: "roxo", rotulo: "Roxo", cor: "#7a4dff" },
  { nome: "grafite", rotulo: "Grafite", cor: "#5a606e" },
  { nome: "branco", rotulo: "Branco", cor: "#e6e8ee" },
];
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
/** as opções de cor de um gênero (o que o seletor mostra e o servidor aceita) */
export function coresDoGenero(g: Genero): { nome: string; rotulo: string; cor: string }[] {
  return g === "f" ? PALETAS_FEMININAS.map((p) => ({ nome: p.nome, rotulo: p.rotulo, cor: hex(p.placa) })) : CORES_MASCULINAS.map((c) => ({ ...c }));
}
/** valida o que veio do cliente: gênero conhecido e uma cor DA LISTA daquele gênero (nada de cor livre) */
export function validarPersonagem(x: unknown): Personagem | null {
  if (!x || typeof x !== "object") return null;
  const { genero, cor } = x as { genero?: unknown; cor?: unknown };
  if (genero !== "f" && genero !== "m") return null;
  if (typeof cor !== "string") return null;
  const c = cor.toLowerCase();
  return coresDoGenero(genero).some((o) => o.cor === c) ? { genero, cor: c } : null;
}
/** o personagem guardado no `User.cyberPerfil` (ou null se ainda não escolheu / inválido) */
export function lerPersonagem(cyberPerfil: unknown): Personagem | null {
  return validarPersonagem((cyberPerfil as { personagem?: unknown } | null)?.personagem);
}
/** a PALETA da armadura (components/cyber/CorpoAstronauta `Paleta`): a feminina pelo nome; o masculino pela cor */
export function paletaDoPersonagem(p: Personagem): `fem:${string}` | `#${string}` {
  if (p.genero === "f") { const f = PALETAS_FEMININAS.find((x) => hex(x.placa) === p.cor); return `fem:${f?.nome ?? "rosa"}`; }
  return p.cor as `#${string}`;
}
