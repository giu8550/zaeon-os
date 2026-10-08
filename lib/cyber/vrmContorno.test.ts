import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BORDA_VRM, CONTORNO_VRM, TOON_VRM, contornarMateriais, corTintaLinear, parteDoMaterial, trocarJsonDoGlb } from "./vrmContorno";

const lerJson = (glb: ArrayBuffer) => { const dv = new DataView(glb); return JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, dv.getUint32(12, true)))); };
const arquivo = () => { const b = readFileSync(join(process.cwd(), "public/avatars/fundador/fundador.vrm")); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

describe("traço de anime nos VRM (contorno MToon)", () => {
  it("pele, roupa e cabelo ganham traço; olhos, boca, sobrancelha e delineado não", () => {
    expect(parteDoMaterial("N00_000_00_Body_00_SKIN (Instance)", "MASK")).toBe("corpo");
    expect(parteDoMaterial("N00_005_01_Tops_01_CLOTH (Instance)", "MASK")).toBe("corpo");
    expect(parteDoMaterial("N00_000_Hair_00_HAIR (Instance)", "MASK")).toBe("cabelo");
    expect(parteDoMaterial("N00_000_00_Face_00_SKIN (Instance)", "MASK")).toBe("rosto");
    for (const n of ["N00_000_00_FaceMouth_00_FACE (Instance)", "N00_000_00_EyeWhite_00_EYE (Instance)", "N00_000_00_FaceBrow_00_FACE (Instance)"]) expect(parteDoMaterial(n, "MASK")).toBeNull();
    expect(parteDoMaterial("N00_000_00_Body_00_SKIN", "BLEND")).toBeNull();
  });
  it("a cor é a tinta dos avatares padrão, em linear", () => {
    const [r, g, b] = corTintaLinear(0x0b1226);
    expect(b).toBeGreaterThan(r); expect(Math.max(r, g, b)).toBeLessThan(0.05);
    expect(corTintaLinear(0xffffff)).toEqual([1, 1, 1]);
  });
  it("no VRM do founder: liga o traço no cabelo, engrossa o resto, e o arquivo remontado continua válido", () => {
    const orig = arquivo(), antes = lerJson(orig);
    const novo = trocarJsonDoGlb(orig, (j) => contornarMateriais(j as never)), depois = lerJson(novo);
    const dv = new DataView(novo);
    expect(dv.getUint32(0, true)).toBe(0x46546c67);
    expect(dv.getUint32(8, true)).toBe(novo.byteLength);
    expect(dv.getUint32(12, true) % 4).toBe(0);
    // o chunk binário (a malha, as texturas) vai idêntico
    const binAntes = new Uint8Array(orig, 20 + new DataView(orig).getUint32(12, true)), binDepois = new Uint8Array(novo, 20 + dv.getUint32(12, true));
    expect(binDepois.length).toBe(binAntes.length); expect(binDepois[100]).toBe(binAntes[100]); expect(binDepois[binDepois.length - 1]).toBe(binAntes[binAntes.length - 1]);
    const mt = (nome: RegExp, j: { materials: { name: string; extensions: { VRMC_materials_mtoon: { outlineWidthMode: string; outlineWidthFactor: number } } }[] }) => j.materials.find((m) => nome.test(m.name))!.extensions.VRMC_materials_mtoon;
    expect(mt(/_Hair_/, antes).outlineWidthMode).toBe("none");
    expect(mt(/_Hair_/, depois).outlineWidthFactor).toBe(CONTORNO_VRM.cabelo);
    expect(mt(/_Tops_/, depois).outlineWidthFactor).toBe(CONTORNO_VRM.corpo);
    expect(mt(/_Face_00_SKIN/, depois).outlineWidthFactor).toBe(CONTORNO_VRM.rosto);
    expect(mt(/EyeIris/, depois).outlineWidthMode).toBe("none");
    expect(depois.materials).toHaveLength(antes.materials.length);
    // desenho, não 3D: sem matcap e sombra em faixa seca (o cabelo vinha a 0,8)
    for (const m of depois.materials) { const t = m.extensions.VRMC_materials_mtoon; expect(t.matcapTexture).toBeUndefined(); expect(t.matcapFactor).toEqual([0, 0, 0]); }
    expect(mt(/_Hair_/, depois)).toMatchObject({ shadingToonyFactor: TOON_VRM, parametricRimFresnelPowerFactor: BORDA_VRM.fresnel });
    expect((mt(/_Tops_/, depois) as unknown as { parametricRimColorFactor: number[] }).parametricRimColorFactor[2]).toBeGreaterThan(0.3);   // a borda clara (COR_LUZ)
    expect((mt(/EyeIris/, depois) as unknown as { parametricRimFresnelPowerFactor?: number }).parametricRimFresnelPowerFactor).not.toBe(BORDA_VRM.fresnel);
  });
});
