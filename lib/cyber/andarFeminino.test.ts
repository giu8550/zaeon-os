import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";

/** o andar feminino (o "Catwalk Walk Forward" do Mixamo, convertido por scripts/anim/mixamo-para-clip.mjs) */
const clip = THREE.AnimationClip.parse(JSON.parse(readFileSync("public/anim/catwalk.json", "utf8")));
const trilha = (n: string) => clip.tracks.find((t) => t.name === n)!;

describe("o andar feminino convertido (catwalk)", () => {
  it("é um ciclo curto com as rotações do esqueleto mixamo do avatar", () => {
    expect(clip.duration).toBeGreaterThan(0.8); expect(clip.duration).toBeLessThan(2);
    for (const o of ["mixamorigHips", "mixamorigSpine", "mixamorigLeftUpLeg", "mixamorigRightUpLeg", "mixamorigLeftLeg", "mixamorigLeftArm"]) expect(trilha(`${o}.quaternion`)).toBeDefined();
    expect(clip.tracks.filter((t) => t.name.endsWith(".position")).map((t) => t.name)).toEqual(["mixamorigHips.position"]);   // só o quadril se move
  });
  it("anda NO LUGAR (quem anda é o jogo: sem isso ela deslizaria) e o quadril fica no referencial do soldado (Z pra cima, cm)", () => {
    const v = trilha("mixamorigHips.position").values;
    for (let i = 0; i < v.length; i += 3) { expect(v[i]).toBeCloseTo(0, 6); expect(v[i + 1]).toBeCloseTo(0, 6); expect(v[i + 2]).toBeGreaterThan(90); expect(v[i + 2]).toBeLessThan(120); }
  });
  it("o ciclo FECHA: o último quadro é igual ao primeiro (sem tranco na emenda)", () => {
    for (const t of clip.tracks) { const k = t.getValueSize(), n = t.times.length; for (let c = 0; c < k; c++) expect(t.values[(n - 1) * k + c]).toBeCloseTo(t.values[c]!, 4); }
  });
});
