/**
 * lib/octa/secoes/tipos.ts — vocabulário das seções da landing do aluno.
 *
 * As 39 seções vêm do `site-builder` do sitecrm (preview/**, registro do RenderEngine), com os
 * mesmos nomes de tipo e de props para o agente reaproveitar o que já sabe. `hero_gradient`
 * nunca foi registrado lá e fica de fora. Módulo puro (sem React): serve ao validador e aos testes.
 */

export const TIPOS_SECAO = [
  // heros
  "hero", "hero_modern", "hero_visual", "hero_split", "hero_saas", "hero_minimal", "hero_lead", "hero_video", "hero_diagonal",
  // features
  "features", "features_list", "features_cards", "features_dark", "features_bento", "features_minimal", "features_steps", "features_mosaic", "features_highlight", "features_glass",
  // sobre
  "about", "about_minimal", "about_profile", "about_stats", "about_grid",
  // depoimentos
  "reviews", "reviews_minimal", "reviews_dark", "reviews_spotlight", "reviews_masonry",
  // localização
  "location", "location_float", "location_visual", "location_grid", "location_dark",
  // chamada final
  "cta", "cta_image", "cta_minimal", "cta_whatsapp", "cta_gradient",
] as const;

export type TipoSecao = (typeof TIPOS_SECAO)[number];

export type ItemFeature = { icon?: string; title?: string; description?: string };
export type ItemReview = { name?: string; role?: string; content?: string; avatar?: string; rating?: number };
export type ItemStat = { valor?: string; rotulo?: string };

/** Props de qualquer seção. Tudo opcional: o renderizador omite o que faltar em vez de quebrar. */
export type PropsSecao = {
  title?: string;
  subtitle?: string;
  description?: string;
  /** Rótulo pequeno acima do título ("Sobre nós", "Diferenciais"…). */
  eyebrow?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaSecondaryText?: string;
  ctaSecondaryLink?: string;
  /** URLs de imagem opcionais. Sem elas a seção desenha um placeholder em CSS. */
  backgroundImage?: string;
  image?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  /** URL de incorporação do mapa (https). Sem ela, a seção mostra um cartão com link pro mapa. */
  mapUrl?: string;
  /** hero_video: link do vídeo ao clicar no play. */
  videoUrl?: string;
  /** hero_lead: endpoint do formulário de e-mail. Sem ele, só o botão. */
  formAction?: string;
  placeholder?: string;
  /** Linha de apoio sob o formulário/botão ou o selo de nota ("4,9/5 · 500 avaliações"). */
  nota?: string;
  items?: Array<ItemFeature & ItemReview>;
  stats?: ItemStat[];
  bullets?: string[];
};

export type Secao = { id: string; type: TipoSecao; props: Record<string, unknown> };

export const PROPS_TEXTO = [
  "title", "subtitle", "description", "eyebrow", "ctaText", "ctaLink", "ctaSecondaryText", "ctaSecondaryLink",
  "backgroundImage", "image", "address", "phone", "email", "hours", "mapUrl", "videoUrl", "formAction", "placeholder", "nota",
] as const;

export const CAMPOS_ITEM_TEXTO = ["icon", "title", "description", "name", "role", "content", "avatar"] as const;
export const CAMPOS_STAT = ["valor", "rotulo"] as const;

const ITENS_FEATURE: PropsSecao["items"] = [
  { icon: "zap", title: "Rápido", description: "Resultado no mesmo dia." },
  { icon: "shield", title: "Seguro", description: "Seus dados protegidos." },
  { icon: "users", title: "Próximo", description: "Atendimento de gente de verdade." },
  { icon: "chart", title: "Mensurável", description: "Números que você acompanha." },
];
const ITENS_REVIEW: PropsSecao["items"] = [
  { name: "Marina Alves", role: "Cliente", content: "Atendimento excelente e entrega no prazo.", rating: 5 },
  { name: "João Pereira", role: "Cliente", content: "Recomendo para qualquer pessoa.", rating: 4 },
  { name: "Ana Souza", role: "Cliente", content: "Superou o que eu esperava.", rating: 5 },
];

/** Props mínimas que cada tipo renderiza sem lançar (usado pelos testes e como exemplo pro agente). */
export const PROPS_MINIMAS: Record<TipoSecao, PropsSecao> = Object.fromEntries(
  TIPOS_SECAO.map((t) => {
    const familia = t.split("_")[0];
    const base: PropsSecao =
      familia === "hero" ? { title: "Título", subtitle: "Subtítulo", ctaText: "Começar" }
      : familia === "features" ? { title: "Por que nós", items: ITENS_FEATURE }
      : familia === "about" ? { title: "Quem somos", description: "Primeiro parágrafo.\nSegundo parágrafo." }
      : familia === "reviews" ? { title: "Quem usa recomenda", items: ITENS_REVIEW }
      : familia === "location" ? { title: "Onde estamos", address: "Rua das Flores, 100 — Fortaleza" }
      : { title: "Vamos conversar?", subtitle: "Fale com a gente.", ctaText: "Falar agora" };
    return [t, base];
  }),
) as Record<TipoSecao, PropsSecao>;

/**
 * Variantes que combinam com cada clima de DESIGN.md (mesmos rótulos de `extrairClima`).
 * Ideia do `page_maker/config.py` do sitecrm: o agente parte do clima e troca só o que precisar.
 */
export const VARIANTES_POR_CLIMA: Record<string, TipoSecao[]> = {
  claro: ["hero_split", "hero_saas", "hero_minimal", "features", "features_list", "about", "reviews", "location", "cta_minimal"],
  escuro: ["hero_visual", "hero_diagonal", "hero_lead", "features_dark", "features_glass", "reviews_dark", "location_dark", "cta_gradient"],
  minimalista: ["hero_minimal", "features_minimal", "features_mosaic", "about_minimal", "reviews_minimal", "location", "cta_minimal"],
  divertido: ["hero_modern", "features_cards", "features_bento", "about_profile", "reviews_masonry", "location_grid", "cta_whatsapp", "cta_gradient"],
  ousado: ["hero_visual", "hero_diagonal", "features_dark", "features_highlight", "about_stats", "reviews_spotlight", "location_dark", "cta_gradient"],
  corporativo: ["hero_split", "hero_saas", "features", "features_list", "about", "reviews", "location_grid", "cta"],
  luxuoso: ["hero_modern", "hero_visual", "features_glass", "about_minimal", "reviews_spotlight", "location_visual", "cta_image"],
  tecnico: ["hero_saas", "hero_lead", "features_steps", "features_bento", "features_dark", "reviews_dark", "location_dark", "cta_minimal"],
};

const EH_TIPO = new Set<string>(TIPOS_SECAO);
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Mantém só as chaves da lista cujo valor é string; o resto é descartado. */
function soTexto(o: Record<string, unknown>, chaves: readonly string[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (const k of chaves) if (typeof o[k] === "string") r[k] = o[k] as string;
  return r;
}

/**
 * Valida o JSON de seções vindo do agente: descarta tipo desconhecido, prop desconhecida e prop
 * que devia ser texto e não é. Itens malformados somem; `rating` só passa como número 1–5.
 * Não lança: sempre devolve uma lista renderizável.
 */
export function validarSecoes(entrada: unknown): Secao[] {
  if (!Array.isArray(entrada)) return [];
  const out: Secao[] = [];
  entrada.forEach((s, i) => {
    if (!ehObjeto(s) || typeof s.type !== "string" || !EH_TIPO.has(s.type)) return;
    const bruto = ehObjeto(s.props) ? s.props : {};
    const props: Record<string, unknown> = soTexto(bruto, PROPS_TEXTO);
    if (Array.isArray(bruto.items)) {
      props.items = bruto.items.filter(ehObjeto).map((it) => {
        const item: Record<string, unknown> = soTexto(it, CAMPOS_ITEM_TEXTO);
        if (typeof it.rating === "number" && it.rating >= 1 && it.rating <= 5) item.rating = Math.round(it.rating);
        return item;
      });
    }
    if (Array.isArray(bruto.stats)) props.stats = bruto.stats.filter(ehObjeto).map((st) => soTexto(st, CAMPOS_STAT));
    if (Array.isArray(bruto.bullets)) props.bullets = bruto.bullets.filter((b): b is string => typeof b === "string");
    out.push({ id: typeof s.id === "string" && s.id ? s.id : `s${i + 1}`, type: s.type as TipoSecao, props });
  });
  return out;
}
