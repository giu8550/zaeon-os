/**
 * Cyberespaço — ONDE está rodando (celular × desktop, aparelho fraco) e a QUALIDADE que cabe. PURO: recebe os sinais
 * do navegador (o componente lê `matchMedia`, `navigator`, `screen`) e devolve um perfil + as capas de efeito.
 *  - celular: ponteiro grosso (toque), user-agent móvel, ou toque + tela pequena;
 *  - leve: todo celular, e também desktop fraco (pouca memória/núcleos) ou janela minúscula;
 *  - fraco: memória ≤ 3 GB ou ≤ 4 núcleos → além de leve, limita os quadros por segundo;
 *  - a PLACA DE VÍDEO (out/2026): integrada (Intel UHD/Iris, Radeon de APU, Mali/Adreno) também é leve — antes um
 *    notebook Intel com 8 GB e 8 núcleos caía no perfil cheio e travava; "software" (SwiftShader/llvmpipe) = a
 *    aceleração de hardware está desligada no navegador (desenha na CPU) → leve + fraco + aviso.
 * A pessoa ainda escolhe nas configurações (PREF_GRAFICOS): automático, leve ou completo.
 * No celular o cyberespaço roda NA HORIZONTAL: em pé (retrato) mostra "gire o celular" e pausa a cena.
 */
export type SinaisDispositivo = {
  coarse: boolean;          // matchMedia("(pointer: coarse)")
  toques: number;           // navigator.maxTouchPoints
  ua: string;               // navigator.userAgent
  largura: number; altura: number;   // innerWidth/innerHeight (CSS px)
  memoriaGB?: number;       // navigator.deviceMemory (Chrome/Android; ausente no Safari)
  nucleos?: number;         // navigator.hardwareConcurrency
  gpu?: string;             // o RENDERER do WebGL (WEBGL_debug_renderer_info) — `lerGpu()`
};
export type ClasseGpu = "dedicada" | "integrada" | "software" | "desconhecida";
export type PerfilDispositivo = { movel: boolean; leve: boolean; fraco: boolean; gpu?: ClasseGpu };

/** a classe da placa pelo nome que o navegador dá (ex.: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 …)") */
export function classificarGpu(nome?: string): ClasseGpu {
  if (!nome) return "desconhecida";
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(nome)) return "software";
  if (/nvidia|geforce|quadro|rtx|gtx|radeon\s*(rx|pro)|\brx\s*\d{3,4}|\barc(\(tm\))?\s*a\d/i.test(nome)) return "dedicada";   // (a Intel Arc é dedicada)
  if (/apple\s*m\d|apple gpu/i.test(nome)) return "dedicada";   // (Apple Silicon aguenta o perfil cheio)
  if (/intel|iris|uhd|hd graphics|radeon\(tm\)\s*graphics|radeon graphics|vega\s*\d+\s*graphics|mali|adreno|powervr/i.test(nome)) return "integrada";
  return "desconhecida";
}

/** a escolha nas configurações: automático (pela detecção), leve ou completo */
export type PreferenciaGraficos = "auto" | "leve" | "cheio";
export const PREF_GRAFICOS = "zaeon.cyber.graficos";
/** o contador de FPS (com o nome da placa) no canto da tela — pra quem estiver com o cyberespaço lento mandar um print */
export const PREF_MOSTRAR_FPS = "zaeon.cyber.mostrarFps";
export const lerPreferencia = (v: string | null | undefined): PreferenciaGraficos => (v === "leve" || v === "cheio" ? v : "auto");

const UA_MOVEL = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i;

export function detectarPerfil(s: SinaisDispositivo): PerfilDispositivo {
  const menor = Math.min(s.largura, s.altura);
  const movel = s.coarse || UA_MOVEL.test(s.ua) || (s.toques > 1 && menor < 900);
  const gpu = classificarGpu(s.gpu);
  const fraco = (s.memoriaGB !== undefined && s.memoriaGB <= 3) || (s.nucleos !== undefined && s.nucleos <= 4) || gpu === "software";
  const leve = movel || fraco || menor < 520 || gpu === "integrada";
  return { movel, leve, fraco, gpu };
}
/** a escolha da pessoa por cima da detecção: "leve" força o leve; "cheio" tira o leve e o limite de quadros */
export function comPreferencia(p: PerfilDispositivo, pref: PreferenciaGraficos): PerfilDispositivo {
  if (pref === "leve") return { ...p, leve: true };
  if (pref === "cheio") return { ...p, leve: p.movel, fraco: false };   // (no celular o leve continua: é a tela pequena)
  return p;
}

/** o nome da placa de vídeo (navegador): um contexto WebGL de 1 px, lido e descartado na hora */
export function lerGpu(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const c = document.createElement("canvas"), gl = (c.getContext("webgl") ?? c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "software (sem WebGL)";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const nome = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return nome;
  } catch { return undefined; }
}

/** as capas de efeito por perfil (o engine e os builders leem daqui) */
export type Qualidade = {
  /** `low` dos builders: menos partículas/segmentos, sem luzes pontuais por base, sem aura duplicada no avatar… */
  leve: boolean;
  pixelRatioMax: number;
  antialias: boolean;
  /** 0 = sem limite */
  fpsMax: number;
};
export function qualidadeDe(p: PerfilDispositivo): Qualidade {
  if (!p.leve) return { leve: false, pixelRatioMax: 1.5, antialias: true, fpsMax: 60 };   // tela de 120/144 Hz não desenha o dobro
  if (p.movel) return { leve: true, pixelRatioMax: 1, antialias: false, fpsMax: p.fraco ? 30 : 45 };
  // DESKTOP leve (placa integrada, aparelho fraco, ou escolhido): resolução da tela (×1) COM antialias — o dono não quer o
  // serrilhado no talo — e 30 fps cravados (mais liso que oscilar entre 20 e 50)
  return { leve: true, pixelRatioMax: 1, antialias: true, fpsMax: 30 };
}

/** celular em pé → pede pra girar (a cena pausa até ficar na horizontal) */
export const precisaGirar = (p: PerfilDispositivo, largura: number, altura: number) => p.movel && altura > largura;

/**
 * limitador com COMPASSO (`agora`/`ultimo` em ms): pula o quadro se ainda não deu o intervalo; quando desenha, o novo
 * `ultimo` anda em múltiplos do intervalo (fica no compasso) — `ultimo = agora` fazia 45 fps num monitor de 60 Hz virar 30.
 */
export function proximoQuadro(fpsMax: number, agora: number, ultimo: number): { pular: boolean; ultimo: number } {
  if (fpsMax <= 0) return { pular: false, ultimo: agora };
  const intervalo = 1000 / fpsMax, passou = agora - ultimo;
  if (passou < intervalo - 1) return { pular: true, ultimo };
  if (passou > intervalo * 3) return { pular: false, ultimo: agora };   // parado muito tempo: recomeça o compasso
  return { pular: false, ultimo: ultimo + Math.max(1, Math.floor((passou + 1) / intervalo)) * intervalo };
}
