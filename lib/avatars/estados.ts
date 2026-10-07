/**
 * lib/avatars/estados.ts — o CONTRATO dos avatares vivos (módulo PURO, sem rede/DOM).
 *
 * Um avatar vivo é um SET de quadros (sprites) do MESMO personagem, um por expressão:
 * idle (base), blink (olhos fechados), talk/talk_half (boca), smile, happy (^ ^), think, confused.
 * O app não fala em quadros — fala em SINAIS que já conhece (o chat está pensando, streamando,
 * terminou, deu erro; o mouse está em cima). Aqui mora o mapa sinal → quadro, que vale igual pro
 * motor de sprites e (no futuro) pro Live2D.
 *
 * Quem consome: components/agents/avatar/* (motor), lib/avatars/pipeline.ts (geração),
 * app/api/agents/avatars (manifestos) e scripts/avatars/gerar.ts (Etapa A, no Claude Code).
 */

export const ESTADOS_SPRITE = ["idle", "blink", "talk", "talk_half", "smile", "happy", "think", "confused"] as const;
export type EstadoSprite = (typeof ESTADOS_SPRITE)[number];

/** Sem esses dois não há "vida" (respira + pisca); o resto é bônus e cai no idle. */
export const ESTADOS_OBRIGATORIOS: readonly EstadoSprite[] = ["idle", "blink"];

/**
 * O que o app sabe do agente. `ouvindo` = o usuário está digitando pra ele (olha pro composer).
 * `hover` não é sinal: é interação local do card.
 */
export type SinalAvatar = "idle" | "ouvindo" | "falando" | "pensando" | "feliz" | "erro";

export type MotorAvatar = "sprite" | "live2d";

export type AvatarManifest = {
  agentId: string;
  /** Muda a cada geração → entra na URL (?v=) pra furar cache imutável. */
  versao: string;
  motor: MotorAvatar;
  /** URL de cada quadro em tamanho cheio (512) e em miniatura (160, cards/pílulas). */
  estados: Partial<Record<EstadoSprite, string>>;
  pequeno: Partial<Record<EstadoSprite, string>>;
  /** Cor de fundo do personagem (borda/anel/placeholder enquanto carrega). */
  cor?: string;
  /**
   * Upgrade futuro: modelo Live2D PRÓPRIO (.model3.json — nunca os modelos de amostra da Live2D).
   * `expressoes` mapeia sinal/hover → nome da expressão do rig. Sem isto o motor live2d cai no sprite.
   */
  live2d?: { model: string; expressoes?: Partial<Record<SinalAvatar | "hover", string>> };
};

export const isEstadoSprite = (v: unknown): v is EstadoSprite =>
  typeof v === "string" && (ESTADOS_SPRITE as readonly string[]).includes(v);

const urlOk = (u: unknown): u is string =>
  typeof u === "string" && u.length > 0 && u.length < 600 && (u.startsWith("/") || u.startsWith("https://"));

/**
 * Valida/normaliza um manifesto vindo de JSON (arquivo estático ou API). Descarta quadros com
 * URL inválida; sem idle+blink devolve null (não dá pra animar — o card fica na foto estática).
 */
export function normalizarManifest(raw: unknown): AvatarManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const agentId = typeof r.agentId === "string" ? r.agentId.trim().toLowerCase() : "";
  if (!agentId) return null;
  const pegar = (obj: unknown): Partial<Record<EstadoSprite, string>> => {
    const out: Partial<Record<EstadoSprite, string>> = {};
    if (!obj || typeof obj !== "object") return out;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) if (isEstadoSprite(k) && urlOk(v)) out[k] = v;
    return out;
  };
  const estados = pegar(r.estados);
  if (!ESTADOS_OBRIGATORIOS.every((e) => estados[e])) return null;
  const pequenoBruto = pegar(r.pequeno);
  // miniatura ausente cai no tamanho cheio (nunca um quadro sem imagem)
  const pequeno: Partial<Record<EstadoSprite, string>> = {};
  for (const e of Object.keys(estados) as EstadoSprite[]) pequeno[e] = pequenoBruto[e] ?? estados[e];
  const l2d = (r.live2d ?? {}) as { model?: unknown; expressoes?: unknown };
  const expressoes: Partial<Record<SinalAvatar | "hover", string>> = {};
  if (l2d.expressoes && typeof l2d.expressoes === "object") {
    for (const [k, v] of Object.entries(l2d.expressoes as Record<string, unknown>)) {
      if (["idle", "ouvindo", "falando", "pensando", "feliz", "erro", "hover"].includes(k) && typeof v === "string" && v.length < 80) expressoes[k as SinalAvatar | "hover"] = v;
    }
  }
  return {
    agentId,
    versao: typeof r.versao === "string" || typeof r.versao === "number" ? String(r.versao) : "0",
    motor: r.motor === "live2d" ? "live2d" : "sprite",
    estados,
    pequeno,
    cor: typeof r.cor === "string" && /^#[0-9a-f]{6}$/i.test(r.cor) ? r.cor : undefined,
    live2d: urlOk(l2d.model) ? { model: l2d.model, ...(Object.keys(expressoes).length ? { expressoes } : {}) } : undefined,
  };
}

/** Quadro "de repouso" pra um sinal (o que fica na tela entre piscadas/falas). */
export function quadroDoSinal(
  sinal: SinalAvatar,
  hover: boolean,
  tem: (e: EstadoSprite) => boolean,
): EstadoSprite {
  const primeiro = (...cands: EstadoSprite[]): EstadoSprite => cands.find(tem) ?? "idle";
  switch (sinal) {
    case "pensando": return primeiro("think");
    case "feliz": return primeiro("happy", "smile");
    case "erro": return primeiro("confused");
    case "falando": return "idle"; // a boca anima por cima (quadrosDeFala)
    case "ouvindo": return "idle"; // atenta: o olhar desce pro composer (motor), sem mudar a cara
    default: return hover ? primeiro("smile") : "idle";
  }
}

/** Ciclo da boca enquanto fala: fechada → meia → aberta → meia… (só com os quadros que existem). */
export function quadrosDeFala(tem: (e: EstadoSprite) => boolean): EstadoSprite[] {
  if (tem("talk")) return tem("talk_half") ? ["idle", "talk_half", "talk", "talk_half"] : ["idle", "talk"];
  return tem("talk_half") ? ["idle", "talk_half"] : ["idle"];
}

/** Piscar humano: 2,4–6 s entre piscadas; ~18% das vezes é piscada dupla. `rand` injetável (teste). */
export function proximaPiscada(rand: () => number = Math.random): { esperaMs: number; dupla: boolean } {
  return { esperaMs: Math.round(2400 + rand() * 3600), dupla: rand() < 0.18 };
}

/** Quanto dura um quadro de boca: 90–170 ms (fala irregular parece fala; metrônomo parece robô). */
export function duracaoSilaba(rand: () => number = Math.random): number {
  return Math.round(90 + rand() * 80);
}

/** Modo voz: nível do áudio (0..1) → quadro da boca. */
export function quadroDaBoca(nivel: number, tem: (e: EstadoSprite) => boolean): EstadoSprite {
  if (nivel >= 0.45 && tem("talk")) return "talk";
  if (nivel >= 0.15) return tem("talk_half") ? "talk_half" : tem("talk") ? "talk" : "idle";
  return "idle";
}

/** Miniatura acima disso fica borrada → usa o quadro cheio. */
export const LIMIAR_PEQUENO_PX = 96;
