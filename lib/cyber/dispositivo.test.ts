import { describe, expect, it } from "vitest";
import { classificarGpu, comPreferencia, detectarPerfil, lerPreferencia, precisaGirar, proximoQuadro, qualidadeDe } from "./dispositivo";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

describe("onde o cyberespaço está rodando", () => {
  it("celular: toque, user-agent móvel ou toque + tela pequena", () => {
    expect(detectarPerfil({ coarse: true, toques: 5, ua: IPHONE, largura: 390, altura: 844 }).movel).toBe(true);
    expect(detectarPerfil({ coarse: false, toques: 0, ua: ANDROID, largura: 915, altura: 412 }).movel).toBe(true);
    expect(detectarPerfil({ coarse: false, toques: 5, ua: MAC, largura: 700, altura: 500 }).movel).toBe(true);   // iPad "desktop" pequeno
  });
  it("desktop bom: nem celular, nem leve", () => {
    expect(detectarPerfil({ coarse: false, toques: 0, ua: MAC, largura: 1440, altura: 900, memoriaGB: 8, nucleos: 10 })).toMatchObject({ movel: false, leve: false, fraco: false });
  });
  it("desktop fraco (pouca memória/núcleos) ou janela minúscula fica leve", () => {
    expect(detectarPerfil({ coarse: false, toques: 0, ua: MAC, largura: 1440, altura: 900, memoriaGB: 2 })).toMatchObject({ movel: false, leve: true, fraco: true });
    expect(detectarPerfil({ coarse: false, toques: 0, ua: MAC, largura: 480, altura: 900 }).leve).toBe(true);
  });
});

describe("a placa de vídeo (out/2026: notebook Intel com 8 GB travava no perfil cheio)", () => {
  const INTEL = "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)";
  it("classifica: integrada, dedicada, software (sem aceleração) e desconhecida", () => {
    for (const n of [INTEL, "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)", "ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)", "AMD Radeon Vega 8 Graphics", "Mali-G78", "Adreno (TM) 650"]) expect(classificarGpu(n), n).toBe("integrada");
    for (const n of ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)", "AMD Radeon RX 6600", "Intel(R) Arc(TM) A770 Graphics", "Apple M2"]) expect(classificarGpu(n), n).toBe("dedicada");
    for (const n of ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)", "llvmpipe (LLVM 15.0.7, 256 bits)", "Microsoft Basic Render Driver"]) expect(classificarGpu(n), n).toBe("software");
    expect(classificarGpu(undefined)).toBe("desconhecida"); expect(classificarGpu("Algo Novo 9000")).toBe("desconhecida");
  });
  it("Intel integrada com 8 GB e 8 núcleos agora é LEVE; desenhando na CPU (software) é leve + fraco", () => {
    const base = { coarse: false, toques: 0, ua: MAC, largura: 1440, altura: 900, memoriaGB: 8, nucleos: 8 };
    expect(detectarPerfil({ ...base, gpu: INTEL })).toMatchObject({ leve: true, fraco: false, gpu: "integrada" });
    expect(detectarPerfil({ ...base, gpu: "SwiftShader" })).toMatchObject({ leve: true, fraco: true, gpu: "software" });
    expect(detectarPerfil({ ...base, gpu: "NVIDIA GeForce RTX 4070" })).toMatchObject({ leve: false, gpu: "dedicada" });
  });
  it("desktop leve: resolução da tela COM antialias (sem serrilhado no talo) e 30 fps cravados", () => {
    expect(qualidadeDe({ movel: false, leve: true, fraco: false, gpu: "integrada" })).toEqual({ leve: true, pixelRatioMax: 1, antialias: true, fpsMax: 30 });
  });
  it("a escolha nas configurações vence a detecção (leve força; completo tira — menos no celular)", () => {
    const forte = { movel: false, leve: false, fraco: false, gpu: "dedicada" as const }, fraca = { movel: false, leve: true, fraco: true, gpu: "integrada" as const };
    expect(comPreferencia(forte, "leve").leve).toBe(true); expect(comPreferencia(fraca, "cheio")).toMatchObject({ leve: false, fraco: false });
    expect(comPreferencia(fraca, "auto")).toEqual(fraca); expect(comPreferencia({ movel: true, leve: true, fraco: false }, "cheio").leve).toBe(true);
    expect(lerPreferencia("leve")).toBe("leve"); expect(lerPreferencia("x")).toBe("auto"); expect(lerPreferencia(null)).toBe("auto");
  });
});

describe("qualidade por perfil", () => {
  it("desktop: cheia (até 60 fps); celular: pixel ratio 1, sem antialias, 45 fps; aparelho fraco: 30 fps", () => {
    expect(qualidadeDe({ movel: false, leve: false, fraco: false })).toEqual({ leve: false, pixelRatioMax: 1.5, antialias: true, fpsMax: 60 });   // tela de 120/144 Hz não desenha o dobro
    expect(qualidadeDe({ movel: true, leve: true, fraco: false })).toEqual({ leve: true, pixelRatioMax: 1, antialias: false, fpsMax: 45 });
    expect(qualidadeDe({ movel: true, leve: true, fraco: true }).fpsMax).toBe(30);
  });
  it("celular em pé pede pra girar; na horizontal (ou desktop) não", () => {
    const cel = { movel: true, leve: true, fraco: false };
    expect(precisaGirar(cel, 390, 844)).toBe(true);
    expect(precisaGirar(cel, 844, 390)).toBe(false);
    expect(precisaGirar({ movel: false, leve: false, fraco: false }, 600, 900)).toBe(false);
  });
  it("limite de fps pula os quadros cedo demais", () => {
    expect(proximoQuadro(30, 1000, 990).pular).toBe(true);
    expect(proximoQuadro(30, 1000, 960).pular).toBe(false);
    expect(proximoQuadro(0, 1000, 999).pular).toBe(false);
  });
  it("limitador com compasso: 45 fps num monitor de 60 Hz dá 45 (não cai pra 30), 30 dá 30, e 0 não limita", () => {
    const rodar = (fps: number, hz: number, seg = 2) => { let ult = -1e9, n = 0; for (let i = 0; i < hz * seg; i++) { const r = proximoQuadro(fps, (i * 1000) / hz, ult); if (!r.pular) { n++; ult = r.ultimo; } } return n / seg; };
    expect(rodar(45, 60)).toBeCloseTo(45, -0.5);
    expect(rodar(30, 60)).toBeCloseTo(30, -0.5);
    expect(rodar(60, 144)).toBeLessThanOrEqual(61); expect(rodar(60, 144)).toBeGreaterThan(55);
    expect(rodar(0, 120)).toBe(120);
  });
});
