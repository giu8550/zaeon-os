/**
 * lib/cyber/neon.ts — os TOKENS da estética Tron do cyberespaço (out/2026, o dono: "neon ciano sob um preto").
 *
 * UMA regra de cor: o MUNDO (chão, paredes, estruturas, o fluxo animado) é CIANO sobre PRETO; cada JOGADOR e a MOTO
 * dele mantêm a COR do usuário (lib/cyber/cores) como neon — identidade na pista. BRANCO só pro "quente" (boost,
 * impacto). Nenhuma outra cor. Abster-se de outras cores também ajuda a performance: menos material, glow por
 * additive + emissive + toneMapped:false (a cena já não tem bloom nem post-processing — components/cyber/CenaCosmica).
 *
 * Este módulo centraliza o que estava espalhado: o ciano vivia solto em ritual.ts/motos.ts/Cidade.ts e o helper
 * `aditivo` estava copiado em ~13 arquivos. Código novo (bancada /zz-cyber/tron e etapas 2–5) bebe daqui.
 */
import * as THREE from "three";
import { corDaArmadura } from "@/lib/cyber/cores";

/** os tokens, em hex (pro que precisa de número) */
export const NEON_HEX = {
  preto: 0x020304,      // o fundo de tudo — PRETO de verdade (Tron), quase sem azul
  ciano: 0x2ef2ff,      // o neon do MUNDO
  cianoDim: 0x0a2e38,   // a linha APAGADA (antes da onda passar)
  branco: 0xe8ffff,     // o "quente": pico de boost/impacto
} as const;

/** os mesmos tokens como THREE.Color (clonar antes de mutar) */
export const NEON = {
  preto: new THREE.Color(NEON_HEX.preto),
  ciano: new THREE.Color(NEON_HEX.ciano),
  cianoDim: new THREE.Color(NEON_HEX.cianoDim),
  branco: new THREE.Color(NEON_HEX.branco),
} as const;

/** a cor-neon de um ser: a cor REAL do usuário (determinística pelo id). Sem id → a cor padrão do visitante. */
export const neonDoUsuario = (id?: string | null): string => corDaArmadura(id);

/** material de GLOW: additive, sem gravar profundidade, dois lados — o jeito que a cena faz "luz" sem bloom. O helper
 *  único (antes copiado osso a osso em TemploMeio, Arena, Nave, Relicario, …). */
export const aditivo = (cor: THREE.ColorRepresentation, op = 1, toneMapped = false): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped });

/** a base PRETA das superfícies (chão/parede/casco): quase preta, metálica, pra o neon estourar por cima. */
export const matPreto = (o: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number; roughness?: number; metalness?: number } = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: NEON_HEX.preto, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 0, roughness: o.roughness ?? 0.6, metalness: o.metalness ?? 0.25 });

/** TRON: num grupo JÁ montado, troca os materiais ROXOS/MAGENTA por CIANO (os brilhos) ou quase-preto (as bases),
 *  deixando VERMELHO, VERDE e CIANO intactos. Assim o lounge/sala de estudos ficam ciano sobre preto SEM encostar nas
 *  escadas protegidas (a vermelha → torre do inglês; a verde → torre da direita). Rode uma vez, depois de montar. */
/** subárvores que o remap NUNCA entra: a TORRE/caminho do meio (exclusiva — o pulso dela é só dela) e a escada pra ela
 *  (= torre do desafio de inglês), e a RASTA (a escada verde da torre do lado direito). As PONTES também ficam fora
 *  (nome começa com "ponte") — elas são a ÚNICA cor que o mundo guarda (esq./dir./meio). */
const DEPURPLEAR_PULA = new Set(["caminho-do-meio", "lounge-rasta"]);
const naoMexer = (nome: string): boolean => DEPURPLEAR_PULA.has(nome) || nome.startsWith("ponte");

/** TRON (agressivo): deixa o ambiente PRETO com só o neon CIANO. Qualquer material saturado que NÃO seja ciano/azul
 *  vira ciano (se for brilho) ou quase-preto (se for base) — ouro, roxo, rosa, verde, vermelho, tudo. Cinza/branco
 *  (estruturas neutras) e ciano ficam. Pula a torre, as escadas protegidas e as pontes (a cor do mundo é só delas). */
export function dePurplear(root: THREE.Object3D): void {
  const hsl = { h: 0, s: 0, l: 0 }, tmp = new THREE.Color();
  const remap = (c?: THREE.Color | null): void => {
    if (!c) return;
    c.getHSL(hsl);
    if (hsl.s < 0.14) return;                         // cinza/branco/preto: deixa (estrutura neutra)
    if (hsl.h >= 0.45 && hsl.h <= 0.62) return;       // ciano / azul-ciano: é o neon, deixa
    if (hsl.l > 0.3) c.setHex(NEON_HEX.ciano);        // brilho de qualquer outra cor → ciano
    else c.setRGB(0.008, 0.011, 0.016);               // base escura de qualquer cor → PRETO
  };
  // cor por INSTÂNCIA (InstancedMesh) e por VÉRTICE (geometria): o que vira "lote" assado é feito disto, então precisa
  // ser remapeado AQUI (antes do engine fundir) — senão o ouro/roxo volta no lote.
  const remapAttr = (attr: THREE.BufferAttribute | null | undefined): void => {
    if (!attr || attr.itemSize < 3) return;
    const a = attr.array as ArrayLike<number> & { [i: number]: number };
    for (let i = 0; i < attr.count; i++) { tmp.fromArray(a, i * attr.itemSize); remap(tmp); tmp.toArray(a as unknown as number[], i * attr.itemSize); }
    attr.needsUpdate = true;
  };
  const walk = (n: THREE.Object3D): void => {
    if (n !== root && naoMexer(n.name)) return;       // torre / escadas protegidas / pontes: não toca
    const mesh = n as THREE.Mesh & { instanceColor?: THREE.BufferAttribute | null };
    const m = mesh.material;
    if (m) for (const mat of Array.isArray(m) ? m : [m]) { const a = mat as THREE.MeshStandardMaterial; remap(a.color); remap(a.emissive); }
    if (mesh.instanceColor) remapAttr(mesh.instanceColor);
    if (mesh.geometry && (mesh.geometry as THREE.BufferGeometry).attributes?.color) remapAttr((mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute);
    for (const ch of n.children) walk(ch);
  };
  walk(root);
}

/** as flags: TRON_SKIN (runtime, servidor) e NEXT_PUBLIC_TRON (build, bundle do cliente) gateiam as etapas 2–5. A
 *  bancada /zz-cyber/tron NÃO depende da flag (é dev). Off por padrão = mundo igual ao de hoje. */
export const tronOn = (): boolean => process.env.TRON_SKIN === "1";
export const tronUiOn = (): boolean => process.env.NEXT_PUBLIC_TRON === "1";
