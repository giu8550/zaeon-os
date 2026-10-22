/**
 * GET /api/octa/design/[id]/previa — a prévia de UM estilo da galeria: a página de exemplo montada por renderPagina
 * com seções FIXAS e os tokens do estilo (não a prévia da coleção). HTML autossuficiente (CSS inline, sem script)
 * para a IDE pôr num `<iframe sandbox="" srcDoc>`. O texto de exemplo é neutro e passa pela regra anti-marca
 * (marcaProibida): a prévia nunca mostra o nome da marca de origem.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { carregarIndice } from "@/lib/octa/design/indice";
import { renderPagina } from "@/lib/octa/secoes/render";
import type { Secao } from "@/lib/octa/secoes/tipos";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

/** Seções de exemplo (as mesmas pra todo estilo: o que muda é só o visual). Texto sem nome de marca. */
const SECOES: Secao[] = [
  { id: "inicio", type: "hero_split", props: { eyebrow: "Novidade", title: "Seu negócio com cara de grande", subtitle: "Uma página simples, rápida e bonita para apresentar o que você faz.", ctaText: "Quero conhecer", ctaSecondaryText: "Saiba mais" } },
  { id: "diferenciais", type: "features_cards", props: { title: "Por que escolher a gente", items: [
    { icon: "zap", title: "Entrega rápida", description: "Pedido pronto no mesmo dia." },
    { icon: "shield", title: "Qualidade garantida", description: "Cada detalhe conferido." },
    { icon: "users", title: "Atendimento próximo", description: "Gente de verdade do outro lado." },
  ] } },
  { id: "depoimentos", type: "reviews", props: { title: "Quem conhece recomenda", items: [
    { name: "Marina Alves", role: "Cliente", content: "Atendimento excelente e entrega no prazo.", rating: 5 },
    { name: "João Pereira", role: "Cliente", content: "Recomendo para todo mundo.", rating: 5 },
  ] } },
  { id: "contato", type: "cta", props: { title: "Vamos conversar?", subtitle: "Fale com a gente e tire suas dúvidas.", ctaText: "Falar agora" } },
];

/** `</` dentro do CSS não pode fechar o <style> da prévia. */
const cssSeguro = (css: string) => css.replace(/<\//g, "<\\/");

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  const e = carregarIndice().find((x) => x.id === params.id);
  if (!e) return new Response(JSON.stringify({ error: "Estilo não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });

  const pagina = renderPagina({
    titulo: "Prévia do estilo",
    descricao: "Página de exemplo com o visual deste estilo.",
    secoes: SECOES,
    tokens: e.tokens,
    marcaProibida: e.marca,
  });
  const html = pagina["index.html"].replace('<link rel="stylesheet" href="styles.css">', `<style>${cssSeguro(pagina["styles.css"])}</style>`);
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, max-age=3600" } });
}
