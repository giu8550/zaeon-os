/**
 * Cyberespaço — o MAPA de ossos do esqueleto que anima o avatar (rig mixamo do GLB: components/cyber/AvatarLuz) pros
 * ossos humanoides do VRM (o padrão dos personagens do VRoid Studio). O VRM não é animado por conta própria: a cada
 * quadro ele COPIA a pose do esqueleto mixamo (que continua fazendo tudo — andar, jato, moto com IK, DJ, dança),
 * então nenhuma animação ou pose precisa ser refeita pra um corpo novo. Puro (sem three) — testado.
 */
export const MIXAMO_PRO_VRM: Readonly<Record<string, string>> = (() => {
  const m: Record<string, string> = {
    Hips: "hips", Spine: "spine", Spine1: "chest", Spine2: "upperChest", Neck: "neck", Head: "head",
  };
  for (const [mx, v] of [["Left", "left"], ["Right", "right"]] as const) {
    Object.assign(m, {
      [`${mx}Shoulder`]: `${v}Shoulder`, [`${mx}Arm`]: `${v}UpperArm`, [`${mx}ForeArm`]: `${v}LowerArm`, [`${mx}Hand`]: `${v}Hand`,
      [`${mx}UpLeg`]: `${v}UpperLeg`, [`${mx}Leg`]: `${v}LowerLeg`, [`${mx}Foot`]: `${v}Foot`, [`${mx}ToeBase`]: `${v}Toes`,
      [`${mx}HandThumb1`]: `${v}ThumbMetacarpal`, [`${mx}HandThumb2`]: `${v}ThumbProximal`, [`${mx}HandThumb3`]: `${v}ThumbDistal`,
    });
    for (const [dedo, nome] of [["Index", "Index"], ["Middle", "Middle"], ["Ring", "Ring"], ["Pinky", "Little"]] as const)
      Object.assign(m, { [`${mx}Hand${dedo}1`]: `${v}${nome}Proximal`, [`${mx}Hand${dedo}2`]: `${v}${nome}Intermediate`, [`${mx}Hand${dedo}3`]: `${v}${nome}Distal` });
  }
  return m;
})();

/** a hierarquia humanoide do VRM (pai de cada osso) — quem não está no mapa herda a rotação do pai */
export const PAI_VRM: Readonly<Record<string, string | null>> = (() => {
  const p: Record<string, string | null> = { hips: null, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck", leftEye: "head", rightEye: "head", jaw: "head" };
  for (const v of ["left", "right"]) {
    Object.assign(p, {
      [`${v}Shoulder`]: "upperChest", [`${v}UpperArm`]: `${v}Shoulder`, [`${v}LowerArm`]: `${v}UpperArm`, [`${v}Hand`]: `${v}LowerArm`,
      [`${v}UpperLeg`]: "hips", [`${v}LowerLeg`]: `${v}UpperLeg`, [`${v}Foot`]: `${v}LowerLeg`, [`${v}Toes`]: `${v}Foot`,
      [`${v}ThumbMetacarpal`]: `${v}Hand`, [`${v}ThumbProximal`]: `${v}ThumbMetacarpal`, [`${v}ThumbDistal`]: `${v}ThumbProximal`,
    });
    for (const d of ["Index", "Middle", "Ring", "Little"]) Object.assign(p, { [`${v}${d}Proximal`]: `${v}Hand`, [`${v}${d}Intermediate`]: `${v}${d}Proximal`, [`${v}${d}Distal`]: `${v}${d}Intermediate` });
  }
  return p;
})();

/** os ossos do VRM em ordem de pai → filho (pra compor as rotações numa passada só) */
export const ORDEM_VRM: readonly string[] = (() => {
  const out: string[] = [], feito = new Set<string>();
  const visitar = (b: string) => { if (feito.has(b)) return; const pai = PAI_VRM[b]; if (pai) visitar(pai); feito.add(b); out.push(b); };
  for (const b of Object.keys(PAI_VRM)) visitar(b);
  return out;
})();

/** o pai EFETIVO de um osso num VRM que não tem todos os opcionais (sem upperChest, sem ombro…): sobe até achar um que exista */
export function paiExistente(b: string, existe: (b: string) => boolean): string | null {
  let p = PAI_VRM[b] ?? null;
  while (p && !existe(p)) p = PAI_VRM[p] ?? null;
  return p;
}
