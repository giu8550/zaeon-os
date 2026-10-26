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
  preto: 0x04060a,      // o fundo de tudo (quase preto, levinho de azul)
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
  new THREE.MeshStandardMaterial({ color: NEON_HEX.preto, emissive: o.emissive ?? 0x030a10, emissiveIntensity: o.emissiveIntensity ?? 0.4, roughness: o.roughness ?? 0.2, metalness: o.metalness ?? 0.85 });

/** as flags: TRON_SKIN (runtime, servidor) e NEXT_PUBLIC_TRON (build, bundle do cliente) gateiam as etapas 2–5. A
 *  bancada /zz-cyber/tron NÃO depende da flag (é dev). Off por padrão = mundo igual ao de hoje. */
export const tronOn = (): boolean => process.env.TRON_SKIN === "1";
export const tronUiOn = (): boolean => process.env.NEXT_PUBLIC_TRON === "1";
