/**
 * lib/avatars/looks.ts — o VISUAL de cada persona do roster (lib/ai/personas.ts), em texto pro
 * gerador de imagem. Módulo PURO.
 *
 * Coerência: as cores são as mesmas dos placeholders antigos (public/agents/*.png — Aura roxo,
 * Nina rosa, Caio azul, Téo verde, Zaeon ciano), a roupa/acessório conta o papel do agente.
 * Todos adultos, roupa discreta. Mudar o texto aqui = gerar de novo (scripts/avatars/gerar.ts).
 */

export type AvatarLook = {
  agentId: string;
  nome: string;
  /** Degradê do fundo [topo, base] — também vira a cor do anel/placeholder do card. */
  cor: readonly [string, string];
  /** Quem é o personagem (aparência + roupa + expressão neutra), em inglês pro modelo. */
  personagem: string;
};

export const AVATAR_LOOKS: Record<string, AvatarLook> = {
  zaeon: {
    agentId: "zaeon",
    nome: "Zaeon",
    cor: ["#38bdf8", "#2563eb"],
    personagem:
      "Zaeon, the warm hostess of the platform: a young woman with long flowing hair that fades from bright cyan at the roots to white at the tips, styled half-up, luminous cyan eyes, a small glowing cyan triangle pendant on a thin necklace, wearing a sleek white high-collar jacket with thin cyan light lines; kind welcoming expression.",
  },
  aura: {
    agentId: "aura",
    nome: "Aura",
    cor: ["#a78bfa", "#6d28d9"],
    personagem:
      "Aura, a warm and confident young academic researcher: a young woman with long straight lavender-violet hair with soft bangs and a small silver star hairpin on the left side, violet eyes, thin round gold-rimmed glasses, wearing a cream white collared blouse under a soft violet cardigan; gentle closed-mouth smile.",
  },
  nina: {
    agentId: "nina",
    nome: "Nina",
    cor: ["#f472b6", "#db2777"],
    personagem:
      "Nina, a cheerful and energetic study buddy: a young woman with a shoulder-length pink bob haircut with blunt bangs and a small yellow pencil-shaped hair clip, bright rose-pink eyes, wearing an oversized pastel pink hoodie with white drawstrings and white over-ear headphones resting around her neck; bright friendly closed-mouth smile.",
  },
  caio: {
    agentId: "caio",
    nome: "Caio",
    cor: ["#60a5fa", "#1d4ed8"],
    personagem:
      "Caio, a calm and thoughtful academic writer: a young man with neat dark navy-blue hair, slightly tousled with a side part, deep blue eyes, wearing a crisp white shirt with a navy knit vest and a loosened thin blue tie, a silver fountain pen clipped to the vest; composed gentle closed-mouth smile.",
  },
  teo: {
    agentId: "teo",
    nome: "Téo",
    cor: ["#34d399", "#047857"],
    personagem:
      "Téo, a playful and clever programmer: a young man with messy black hair with dark green highlights and a few spiky strands, emerald green eyes, black rectangular glasses, wearing a dark charcoal hoodie with thin emerald green circuit lines along the hood edge; confident lopsided closed-mouth grin.",
  },
  zenita: {
    agentId: "zenita",
    nome: "Zenita",
    cor: ["#fcd34d", "#d97706"],
    personagem:
      "Zenita, an organized and cheerful schedule assistant: a young woman with warm golden-blonde hair in a neat high ponytail with a small round clock-shaped hair ornament, golden amber eyes, wearing a cream turtleneck under a tan blazer; friendly composed closed-mouth smile.",
  },
  core_active: {
    agentId: "core_active",
    nome: "Davi",
    cor: ["#fb923c", "#c2410c"],
    personagem:
      "Davi, the reliable guardian of the class schedule: a young man with short wavy dark brown hair, warm brown eyes, wearing an olive green bomber jacket over a white t-shirt with a small silver shield pin on the collar; calm reassuring closed-mouth smile.",
  },
  scholar: {
    agentId: "scholar",
    nome: "Scholar",
    cor: ["#94a3b8", "#334155"],
    personagem:
      "Scholar, a meticulous citation expert: a young man with neat silver-gray hair combed back, sharp gray eyes, a thin gold monocle chain, wearing a dark slate-gray academic blazer over a light gray waistcoat and a white shirt; serious but polite closed-mouth expression.",
  },
  examiner: {
    agentId: "examiner",
    nome: "Examiner",
    cor: ["#f87171", "#b91c1c"],
    personagem:
      "Examiner, a rigorous but fair quiz master: a young woman with a sharp black bob haircut with a single crimson streak, crimson red eyes, wearing a black blazer with a crimson red tie and a small silver badge; confident slightly challenging closed-mouth smile.",
  },
};

export const lookDe = (agentId: string): AvatarLook | null => AVATAR_LOOKS[agentId] ?? null;
