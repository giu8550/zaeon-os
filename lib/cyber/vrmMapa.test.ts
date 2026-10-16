import { describe, expect, it } from "vitest";
import { MIXAMO_PRO_VRM, ORDEM_VRM, PAI_VRM, paiExistente } from "./vrmMapa";

describe("mapa mixamo → VRM (o avatar VRM copia a pose do esqueleto que já anima tudo)", () => {
  it("cobre o corpo inteiro, os dois lados e os dedos", () => {
    for (const b of ["hips", "spine", "chest", "neck", "head", "leftUpperArm", "rightLowerLeg", "leftFoot", "rightHand", "leftIndexProximal", "rightLittleDistal", "leftThumbMetacarpal"]) expect(Object.values(MIXAMO_PRO_VRM)).toContain(b);
    expect(MIXAMO_PRO_VRM.LeftArm).toBe("leftUpperArm"); expect(MIXAMO_PRO_VRM.RightHandPinky2).toBe("rightLittleIntermediate");
    for (const v of Object.values(MIXAMO_PRO_VRM)) expect(PAI_VRM).toHaveProperty(v);   // todo destino é um osso humanoide conhecido
  });
  it("a ordem sempre põe o pai antes do filho", () => {
    const i = new Map(ORDEM_VRM.map((b, k) => [b, k]));
    for (const b of ORDEM_VRM) { const p = PAI_VRM[b]; if (p) expect(i.get(p)!).toBeLessThan(i.get(b)!); }
    expect(ORDEM_VRM[0]).toBe("hips");
  });
  it("VRM sem os ossos opcionais: o pai efetivo pula o que não existe", () => {
    const tem = new Set(["hips", "spine", "chest", "neck", "head", "leftUpperArm"]);
    expect(paiExistente("neck", (b) => tem.has(b))).toBe("chest");          // sem upperChest
    expect(paiExistente("leftUpperArm", (b) => tem.has(b))).toBe("chest");  // sem ombro nem upperChest
    expect(paiExistente("hips", (b) => tem.has(b))).toBeNull();
  });
});
