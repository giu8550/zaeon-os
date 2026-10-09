import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { criarOclusaoDePisos, tampado } from "./oclusaoPisos";

// uma plataforma de raio 40, piso no y = 0; o conteúdo é uma caixa de 10×3×10 no centro, em cima do piso
const caixa = (x: number, z: number, h = 3, l = 5) => new THREE.Box3(new THREE.Vector3(x - l, 0.2, z - l), new THREE.Vector3(x + l, 0.2 + h, z + l));
const cam = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("pisos que escondem (as células/portais do céu aberto)", () => {
  it("de BAIXO da plataforma, o que está em cima some (o piso tampa)", () => {
    expect(tampado(cam(0, -88, 0), caixa(0, 0), 40, 0)).toBe(true);        // bem embaixo
    expect(tampado(cam(0, -88, 300), caixa(0, 0), 40, 0)).toBe(true);      // de longe e de baixo (a capela olhando a sala)
  });
  it("de cima, na altura do piso ou de lado, aparece", () => {
    expect(tampado(cam(0, 10, 0), caixa(0, 0), 40, 0)).toBe(false);
    expect(tampado(cam(100, 0.1, 0), caixa(0, 0), 40, 0)).toBe(false);
  });
  it("o que está na BORDA (ou alto demais) escapa por cima da borda — fica à mostra", () => {
    expect(tampado(cam(0, -88, 300), caixa(0, 36), 40, 0)).toBe(false);     // na borda mais perto da câmera
    expect(tampado(cam(0, -10, 300), caixa(0, 0, 30), 40, 0)).toBe(false);  // alto, visto quase de lado
  });
  it("o que desce abaixo do piso nunca some (não está em cima dele)", () => {
    const b = caixa(0, 0); b.min.y = -2;
    expect(tampado(cam(0, -88, 0), b, 40, 0)).toBe(false);
  });
  it("peça por peça, num invólucro: o miolo some, a borda fica; o que está dentro não é tocado", () => {
    const plat = new THREE.Group(); plat.position.set(0, 100, 0); const acima = new THREE.Group(); plat.add(acima);
    const miolo = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 10)); miolo.position.y = 1.7;
    const borda = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4)); borda.position.set(0, 1.7, 37);
    acima.add(miolo, borda);
    const o = criarOclusaoDePisos(); o.adicionar({ acima, r: 40, topo: 0.16 });
    o.atualizar(cam(0, 15, 300));   // ~85 m abaixo, de longe, do lado da borda
    expect(miolo.parent!.visible).toBe(false); expect(borda.parent!.visible).toBe(true);
    expect(miolo.visible).toBe(true);
    o.atualizar(cam(0, 110, 0)); expect(miolo.parent!.visible).toBe(true);   // em cima da plataforma: tudo aparece
  });
});
