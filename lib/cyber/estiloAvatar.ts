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
