/**
 * Cyberespaço — o ESTILO do corpo do jogador (EXPERIMENTO). "luz" = o ser de luz de sempre (armadura metálica
 * emissiva + aura); "anime" = a MESMA armadura, mas DESENHADA como os nossos avatares (public/avatars): sombra em
 * faixas chapadas (cel shading), contorno de tinta e um brilho de borda — components/cyber/AvatarAnime.
 * Liga com NEXT_PUBLIC_CYBER_AVATAR_ESTILO=anime (todo mundo) ou ?anime=1 / ?anime=0 na URL (só pra quem testa).
 */
export type EstiloAvatar = "luz" | "anime";

export function estiloDe(env: string | undefined, busca: string): EstiloAvatar {
  const q = new URLSearchParams(busca).get("anime");
  if (q === "1") return "anime";
  if (q === "0") return "luz";
  return env === "anime" ? "anime" : "luz";
}

/** as FAIXAS do cel shading (0..255): sombra, meio-tom, luz — 3 degraus chapados, como no desenho */
export const FAIXAS_TOON = [96, 178, 255] as const;
/** o contorno de tinta: espessura como FRAÇÃO da altura do modelo (o GLB pode vir em cm ou em m — o Soldier é em cm)
 *  e cor (azul-noite, não preto puro — igual aos avatares) */
export const TINTA = { fracao: 0.0085, cor: 0x0b1226 } as const;
/** a espessura do traço no espaço da geometria (altura = a maior dimensão da malha, nas unidades dela) */
export const espessuraTinta = (altura: number) => Math.max(0, altura) * TINTA.fracao;
/** a aura do ser de luz no desenho: mais discreta (fica atrás do traço, não lava o contorno) */
export const AURA_NO_DESENHO = 0.3;

/** o corpo PRÓPRIO do founder: um VRM feito no VRoid Studio (projeto em ~/Documents/fundador.vroid), anime, com as
 *  roupas tingidas aqui (o moletom é branco no VRoid → qualquer cor). `?founder=0` mostra o padrão (pra comparar) */
export const CORPO_DO_FUNDADOR = { url: "/avatars/fundador/fundador.vrm", tintas: { Tops: "#1a1b20" } } as const;
export const usaCorpoDoFundador = (fundador: boolean | undefined, busca: string) => !!fundador && new URLSearchParams(busca).get("founder") !== "0";

/** os ACESSÓRIOS feitos em código (presos aos ossos do VRM — components/cyber/AcessoriosVrm): o VRoid não tem esses */
export type AcessorioVrm = "foneNoPescoco" | "presilhaLapis" | "oculosRedondos" | "presilhaEstrela" | "oculosRetangulares" | "golaCircuito";
export type CorpoVrm = { url: string; tintas: Readonly<Record<string, string>>; acessorios?: readonly AcessorioVrm[]; /** a pose parada (lib/cyber/posesVrm) */ pose?: "feminina" | "masculina" };
/** os corpos VRM dos PERSONAGENS (os agentes que vivem na cidadela Zaeon), feitos no VRoid Studio (~/Documents/<id>.vroid)
 *  a partir do card (public/avatars/<id>): a roupa branca do VRoid é tingida aqui */
export const CORPOS_VRM: Readonly<Record<string, CorpoVrm>> = {
  nina: { url: "/avatars/nina/nina.vrm", tintas: { Tops: "#f6b9d1" }, acessorios: ["foneNoPescoco", "presilhaLapis"], pose: "feminina" },
  teo: { url: "/avatars/teo/teo.vrm", tintas: { Tops: "#3b3f46", Bottoms: "#4d72b8" }, acessorios: ["oculosRetangulares", "golaCircuito"], pose: "masculina" },
  aura: { url: "/avatars/aura/aura.vrm", tintas: { Tops: "#b9a0f2", Bottoms: "#38407a" }, acessorios: ["oculosRedondos", "presilhaEstrela"], pose: "feminina" },
};
