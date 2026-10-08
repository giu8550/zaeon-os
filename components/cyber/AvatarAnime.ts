/**
 * AvatarAnime — os materiais do corpo no ESTILO ANIME (experimento; lib/cyber/estiloAvatar): a armadura vira
 * DESENHO — cel shading em faixas chapadas (MeshToonMaterial + gradiente de 3 degraus), um brilho de borda recortado
 * (o "rim light" dos desenhos) e um CONTORNO DE TINTA (casca invertida: a malha inflada pelo normal, só as faces de
 * trás, numa cor só — a mesma técnica da aura, então custa igual).
 */
import * as THREE from "three";
import { FAIXAS_TOON, TINTA, espessuraTinta } from "@/lib/cyber/estiloAvatar";

let faixas: THREE.DataTexture | null = null;
/** o gradiente do cel shading (1 textura pra todos os avatares) */
function texFaixas(): THREE.DataTexture {
  if (faixas) return faixas;
  const t = new THREE.DataTexture(new Uint8Array(FAIXAS_TOON), FAIXAS_TOON.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return (faixas = t);
}

/** a cor da armadura no desenho: mais clara e mais saturada que a do metal (anime = cor chapada viva) */
export function corDesenho(armadura: THREE.Color, alvo = new THREE.Color()): THREE.Color {
  return alvo.copy(armadura).lerp(new THREE.Color(0xffffff), 0.06);
}

/** um material DESENHADO. A luz do desenho é fixa em relação à câmera (de cima, à esquerda — como num quadro de anime),
 *  não a da cena: o cyberespaço é escuro e cheio de luz colorida, e o personagem tem que ficar legível em qualquer
 *  lugar. 3 faixas chapadas (sombra, meio-tom, luz) + um brilho especular recortado + o brilho de borda na cor da luz */
export function toon(cor: THREE.ColorRepresentation, o: { map?: THREE.Texture; rim?: THREE.Color; rimForca?: number; brilho?: number } = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: texFaixas(), map: o.map ?? null });
  const [s, mt] = FAIXAS_TOON.map((v) => (v / 255).toFixed(3));
  const uRim = { value: (o.rim ?? new THREE.Color(0xffffff)).clone() }, rimF = (o.rim ? o.rimForca ?? 0.6 : 0).toFixed(3), brilho = (o.brilho ?? 0.35).toFixed(3);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = uRim;
    sh.fragmentShader = "uniform vec3 uRim;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", `
      vec3 Ld = normalize(vec3(-0.45, 0.75, 0.5));
      float nl = dot(normal, Ld);
      float faixa = nl > 0.32 ? 1.0 : (nl > -0.2 ? ${mt} : ${s});
      vec3 V = normalize(vViewPosition);
      float brilho = step(0.94, max(dot(reflect(-Ld, normal), V), 0.0));
      float rimF = 1.0 - clamp(dot(normal, V), 0.0, 1.0);
      outgoingLight = diffuseColor.rgb * faixa + vec3(0.85) * brilho * ${brilho} + uRim * step(0.6, rimF) * ${rimF} * (0.4 + 0.6 * faixa);
      #include <opaque_fragment>`);
  };
  return m;
}

/** a armadura desenhada (o "stock" dos iniciantes): a cor dela + o brilho de borda na cor da luz */
export function materialToon(armadura: THREE.Color, luz: THREE.Color): THREE.MeshToonMaterial {
  return toon(corDesenho(armadura), { rim: luz });
}

/** contorno de tinta de espessura FIXA (m) — pras peças montadas em metros (o avatar do founder) */
export function tintaFixa(espessura: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: TINTA.cor, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n transformed += normalize(normal) * ${espessura.toFixed(4)};`); };
  return m;
}

/** o contorno de tinta (casca invertida). `tinta.espessar(geometria)` mede a malha e acerta o traço (a escala do GLB
 *  pode ser qualquer uma) */
export function materialTinta(): THREE.MeshBasicMaterial & { espessar(g: THREE.BufferGeometry): void } {
  const uEsp = { value: 0 };
  const m = new THREE.MeshBasicMaterial({ color: TINTA.cor, side: THREE.BackSide }) as THREE.MeshBasicMaterial & { espessar(g: THREE.BufferGeometry): void };
  m.onBeforeCompile = (sh) => { sh.uniforms.uEsp = uEsp; sh.vertexShader = "uniform float uEsp;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed += normalize(normal) * uEsp;"); };
  m.espessar = (g) => {
    if (!g.boundingBox) g.computeBoundingBox();
    const s = g.boundingBox!.getSize(new THREE.Vector3());
    uEsp.value = Math.max(uEsp.value, espessuraTinta(Math.max(s.x, s.y, s.z)));
  };
  return m;
}

/** peças pequenas (mochila, fone, prancha) no mesmo desenho, sem o brilho de borda */
export function materialToonSimples(cor: THREE.ColorRepresentation, emissivo: THREE.Color): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: cor, gradientMap: texFaixas(), emissive: emissivo });
}
