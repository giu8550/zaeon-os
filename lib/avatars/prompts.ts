/**
 * lib/avatars/prompts.ts — o PROMPT-BASE DE CONSISTÊNCIA dos avatares (módulo PURO).
 *
 * Duas etapas, o mesmo modelo de imagem (Gemini image no Vertex):
 *   1. BASE (texto → imagem): estilo + personagem + enquadramento + fundo — o quadro `idle`.
 *   2. EXPRESSÕES (imagem → imagem): a partir da BASE, muda SÓ olhos/boca/sobrancelha. É isso que
 *      faz os quadros "casarem" (mesma pose/escala/fundo); o pipeline ainda recorta a diferença e
 *      cola sobre a base (lib/avatars/composite.ts), então o que sobrar de ruído some.
 * Mesmo texto no Claude Code (Etapa A) e na tool do admin (Etapa B).
 */
import type { EstadoSprite } from "./estados";

const ESTILO =
  "Japanese ANIME character portrait (2D anime illustration, like a modern anime TV series or gacha game character art) in a polished anime key-visual style: clean confident line art, soft cel shading with gentle gradients, large luminous expressive anime eyes with catchlights, small simplified anime nose and mouth, smooth skin shading, subtle blush, glossy anime hair highlights. High quality VTuber-style avatar. NOT realistic, NOT semi-realistic, NOT 3D render, NOT western cartoon.";

const ENQUADRAMENTO =
  "Framing: close-up bust portrait, head and upper shoulders only. The face is large and centered, filling roughly the middle half of the image; the top of the hair is just inside the top edge. Facing the viewer directly, looking straight at the viewer, both eyes open and clearly visible, mouth closed, relaxed neutral expression. Symmetrical front view.";

const SEGURO = "Single adult character, modest clothing. No text, no watermark, no signature, no frame, no border.";

/**
 * Com IMAGEM DE REFERÊNCIA (um avatar já aprovado): trava o ESTILO — personagem novo, mesmo traço,
 * mesma sombra, mesmo olho anime, mesmo enquadramento e tipo de fundo. Sem isso o modelo derivava
 * pro semi-realista em descrições "adultas" (homem de 30 e poucos, barba…).
 */
export const PREFIXO_REFERENCIA =
  "The attached image is a STYLE REFERENCE ONLY. Create a completely NEW and DIFFERENT character drawn in EXACTLY the same anime art style as the reference: same line art weight, same cel shading, same large anime eye style, same simplified nose and mouth, same hair rendering, same bust framing with the face at the same size and position, and the same kind of plain smooth gradient background. Do NOT copy the reference character's face, hair, clothes or colors — only the art style.";

/** Prompt da BASE. `personagem` vem do look (persona da casa) ou da descrição do admin. */
export function promptBase(personagem: string, cor: readonly [string, string]): string {
  const p = personagem.trim().replace(/\s+/g, " ").slice(0, 900);
  return [
    ESTILO,
    `Character: ${p}`,
    ENQUADRAMENTO,
    `Background: plain smooth vertical gradient from ${cor[0]} at the top to ${cor[1]} at the bottom, no objects, no patterns, no scenery.`,
    SEGURO,
  ].join("\n");
}

const MANTER =
  "Keep EVERYTHING else exactly identical: same character, same face shape, same hair, same accessories, same clothes, same pose, same framing, same position and scale, same background, same colors and line art. Do not crop, zoom, shift, rotate or redraw anything else.";

/** A ÚNICA mudança de cada quadro (o resto é o MANTER). `idle` é a própria base — sem edição. */
const MUDANCA: Record<Exclude<EstadoSprite, "idle">, string> = {
  blink: "Change ONLY the eyes: both eyes closed mid-blink — the upper eyelids lowered all the way, drawn as a relaxed lash line that curves gently DOWNWARD (like calm sleeping eyes), NOT an upward happy squint, cheeks not raised. The eyebrows and the mouth stay exactly as they are.",
  talk: "Change ONLY the mouth: mouth clearly open mid-speech, a relaxed open \"ah\" shape showing a little of the inside of the mouth, like an anime talking frame. The eyes stay open and unchanged.",
  talk_half: "Change ONLY the mouth: mouth slightly open mid-word, a small soft \"eh\" shape, about half as open as a full \"ah\". The eyes stay open and unchanged.",
  smile: "Change ONLY the facial expression: a bright warm open smile showing a little of the upper teeth, cheeks slightly raised, eyes still open and sparkling, eyebrows relaxed.",
  happy: "Change ONLY the facial expression: an overjoyed anime smile — both eyes closed into happy upward-curved arcs (^ ^), a wide open happy smile, light blush on the cheeks.",
  think: "Change ONLY the facial expression: thinking — eyes open and glancing up and to one side, eyebrows slightly raised, mouth a small closed pout pushed to one side. The head does not move.",
  confused: "Change ONLY the facial expression: confused and a little worried — eyebrows knit and tilted, eyes open, a small wavy uneven closed mouth, and a single small classic anime sweat drop on the side of the forehead.",
};

/** `ajuste` = o "ajustar prompt" do estúdio (ex.: "sorriso mais discreto"), somado à mudança. */
export function promptEdicao(estado: Exclude<EstadoSprite, "idle">, ajuste?: string): string {
  const extra = (ajuste || "").trim().replace(/\s+/g, " ").slice(0, 300);
  return `Edit this exact image. ${MUDANCA[estado]}${extra ? ` Extra direction for this expression: ${extra}.` : ""} ${MANTER}`;
}

/** Ordem de geração: o essencial primeiro (se a cota acabar no meio, o card já vive). */
export const ORDEM_GERACAO: readonly Exclude<EstadoSprite, "idle">[] = ["blink", "talk", "smile", "happy", "think", "talk_half", "confused"];
