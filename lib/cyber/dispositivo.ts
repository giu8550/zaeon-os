/**
 * Cyberespaço — ONDE está rodando (celular × desktop, aparelho fraco) e a QUALIDADE que cabe. PURO: recebe os sinais
 * do navegador (o componente lê `matchMedia`, `navigator`, `screen`) e devolve um perfil + as capas de efeito.
 *  - celular: ponteiro grosso (toque), user-agent móvel, ou toque + tela pequena;
 *  - leve: todo celular, e também desktop fraco (pouca memória/núcleos) ou janela minúscula;
 *  - fraco: memória ≤ 3 GB ou ≤ 4 núcleos → além de leve, limita os quadros por segundo.
 * No celular o cyberespaço roda NA HORIZONTAL: em pé (retrato) mostra "gire o celular" e pausa a cena.
 */
export type SinaisDispositivo = {
  coarse: boolean;          // matchMedia("(pointer: coarse)")
  toques: number;           // navigator.maxTouchPoints
  ua: string;               // navigator.userAgent
  largura: number; altura: number;   // innerWidth/innerHeight (CSS px)
  memoriaGB?: number;       // navigator.deviceMemory (Chrome/Android; ausente no Safari)
  nucleos?: number;         // navigator.hardwareConcurrency
};
export type PerfilDispositivo = { movel: boolean; leve: boolean; fraco: boolean };

const UA_MOVEL = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i;

export function detectarPerfil(s: SinaisDispositivo): PerfilDispositivo {
  const menor = Math.min(s.largura, s.altura);
  const movel = s.coarse || UA_MOVEL.test(s.ua) || (s.toques > 1 && menor < 900);
  const fraco = (s.memoriaGB !== undefined && s.memoriaGB <= 3) || (s.nucleos !== undefined && s.nucleos <= 4);
  const leve = movel || fraco || menor < 520;
  return { movel, leve, fraco };
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
  return { leve: true, pixelRatioMax: p.movel ? 1 : 1.25, antialias: false, fpsMax: p.fraco ? 30 : p.movel ? 45 : 0 };
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
