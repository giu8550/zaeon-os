/**
 * Cyberespaço — o TRAÇO DE ANIME (contorno de tinta) nos corpos VRM (PURO, sem three). O VRM do VRoid já traz o
 * contorno do próprio MToon, mas exportado quase invisível (0,8 mm) e desligado no cabelo — o corpo fica com sombra
 * de anime e cara de 3D. Aqui o arquivo é ajustado ANTES de carregar (o @pixiv/three-vrm só gera a malha do
 * contorno na carga): cada material de pele/roupa/cabelo ganha o contorno na espessura e na cor de tinta dos
 * avatares padrão (lib/cyber/estiloAvatar TINTA); olhos, sobrancelha, boca e cílios ficam sem (são desenho
 * por cima do rosto). O contorno do MToon respeita o recorte do cabelo (alpha), as expressões e o esqueleto.
 */
import { TINTA } from "./estiloAvatar";
import { COR_LUZ } from "./cores";

/** a espessura do traço (m, no mundo) por parte — o rosto mais fino (traço grosso no rosto pesa) */
export const CONTORNO_VRM = { corpo: 0.0085, cabelo: 0.007, rosto: 0.0035 } as const;

type Mtoon = { outlineWidthMode?: string; outlineWidthFactor?: number; outlineColorFactor?: number[]; outlineLightingMixFactor?: number; matcapTexture?: unknown; matcapFactor?: number[]; shadingToonyFactor?: number; parametricRimColorFactor?: number[]; parametricRimFresnelPowerFactor?: number; parametricRimLiftFactor?: number; rimLightingMixFactor?: number };
type MaterialGltf = { name?: string; alphaMode?: string; extensions?: { VRMC_materials_mtoon?: Mtoon } };

/** a parte do material pelo nome do VRoid ("N00_000_00_Body_00_SKIN", "…_Hair_00_HAIR", "…_Tops_01_CLOTH"…); null =
 *  sem contorno (olhos, boca, sobrancelha, delineado, cílios) */
export function parteDoMaterial(nome: string, alphaMode = "OPAQUE"): keyof typeof CONTORNO_VRM | null {
  if (alphaMode === "BLEND") return null;   // transparente: desenho por cima (íris, brilho, sobrancelha…)
  if (/_(EYE|FACE)\b|_FACE(\s|$)|Eye|Brow|Mouth|Eyeline|Eyelash/i.test(nome)) return null;
  if (/HAIR/i.test(nome)) return "cabelo";
  if (/Face_\d+_SKIN/i.test(nome)) return "rosto";
  if (/SKIN|CLOTH|Body|Tops|Bottoms|Shoes|Accessory/i.test(nome)) return "corpo";
  return null;
}

/** sRGB (0..255) → linear (o glTF guarda cor linear) */
const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const corTintaLinear = (hex: number = TINTA.cor): [number, number, number] => [linear((hex >> 16) & 255), linear((hex >> 8) & 255), linear(hex & 255)];
const corDaLuz = (): [number, number, number] => corTintaLinear(parseInt(COR_LUZ.slice(1), 16)).map((v) => v * BORDA_VRM.forca) as [number, number, number];

/** quão chapadas ficam as faixas de sombra (1 = degrau seco, como o cel shading dos avatares padrão) */
export const TOON_VRM = 0.97;
/** a BORDA DE LUZ na silhueta (o "rim" dos desenhos — a mesma dos avatares padrão, na cor da luz COR_LUZ): é ela que
 *  separa o personagem do fundo escuro do cyberespaço, onde a tinta escura some. `forca` = quanto da cor; `fresnel`
 *  alto = borda fina */
export const BORDA_VRM = { forca: 0.55, fresnel: 4, lift: 0 } as const;

/** ajusta o JSON do glTF (muta e devolve) pra ficar DESENHO e não 3D: liga/engrossa o contorno MToon de cada material
 *  de pele/roupa/cabelo (com a BORDA DE LUZ na silhueta); em TODOS os materiais tira o matcap (o brilho de "material" que o VRoid põe e que dá
 *  volume de 3D) e deixa a sombra em faixa seca */
export function contornarMateriais<T extends { materials?: MaterialGltf[] }>(json: T, esp: { corpo: number; cabelo: number; rosto: number } = CONTORNO_VRM): T {
  const cor = corTintaLinear(), borda = corDaLuz();
  for (const m of json.materials ?? []) {
    const mt = m.extensions?.VRMC_materials_mtoon; if (!mt) continue;
    delete mt.matcapTexture; mt.matcapFactor = [0, 0, 0];
    if (typeof mt.shadingToonyFactor === "number") mt.shadingToonyFactor = Math.max(mt.shadingToonyFactor, TOON_VRM);
    const parte = parteDoMaterial(m.name ?? "", m.alphaMode);
    if (!parte) continue;
    mt.outlineWidthMode = "worldCoordinates";
    mt.outlineWidthFactor = esp[parte];
    mt.outlineColorFactor = cor;
    mt.outlineLightingMixFactor = 0;   // tinta chapada: a luz da cena não clareia o traço
    mt.parametricRimColorFactor = borda; mt.parametricRimFresnelPowerFactor = BORDA_VRM.fresnel; mt.parametricRimLiftFactor = BORDA_VRM.lift;
    mt.rimLightingMixFactor = 0;   // a borda acende igual em qualquer canto (como a luz presa à câmera do desenho)
  }
  return json;
}

/** um GLB (o .vrm é um GLB) com o JSON trocado: lê o 1º chunk (JSON), aplica `mudar` e remonta o arquivo (o chunk
 *  binário vai igual). Lança se não for GLB. */
export function trocarJsonDoGlb(glb: ArrayBuffer, mudar: (json: Record<string, unknown>) => unknown): ArrayBuffer {
  const dv = new DataView(glb);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("não é GLB");   // "glTF"
  const lenJson = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) throw new Error("GLB sem chunk JSON");   // "JSON"
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, lenJson))) as Record<string, unknown>;
  mudar(json);
  let bytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (bytes.length % 4)) % 4;
  if (pad) { const p = new Uint8Array(bytes.length + pad); p.set(bytes); p.fill(0x20, bytes.length); bytes = p; }   // o JSON é completado com espaços
  const resto = new Uint8Array(glb, 20 + lenJson);   // o(s) chunk(s) binário(s), intactos
  const out = new Uint8Array(12 + 8 + bytes.length + resto.length), odv = new DataView(out.buffer);
  out.set(new Uint8Array(glb, 0, 12));
  odv.setUint32(8, out.length, true);
  odv.setUint32(12, bytes.length, true); odv.setUint32(16, 0x4e4f534a, true);
  out.set(bytes, 20); out.set(resto, 20 + bytes.length);
  return out.buffer;
}
