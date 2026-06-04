import { retrievePapers } from "@/lib/scholar/retrieve";

export const runtime = "nodejs";
export const maxDuration = 60;

// Busca leve de literatura existente (sem síntese/Gemini), para "Pesquisas relacionadas".
// Pública e read-only (só consulta fontes científicas externas; nenhum dado do usuário),
// com cache em memória para não martelar as APIs externas a cada tecla.
interface CacheEntry { at: number; body: string }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 30; // 30 min

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 3) {
    return new Response(JSON.stringify({ papers: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const key = q.toLowerCase().slice(0, 200);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return new Response(hit.body, { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    const { papers } = await retrievePapers(q, { minResults: 12 });
    const out = papers.slice(0, 12).map((p) => ({
      id: p.id,
      title: p.title,
      authors:
        p.authors.length > 0
          ? p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : "")
          : "",
      year: p.year ?? null,
      venue: p.venue ?? "",
      source: p.sources?.[0] ?? "",
      url: p.url ?? (p.doi ? `https://doi.org/${p.doi}` : null),
      doi: p.doi ?? null,
      citationCount: p.citationCount ?? null,
    }));
    const body = JSON.stringify({ papers: out });
    CACHE.set(key, { at: Date.now(), body });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    // Degradação graciosa: sem resultados em vez de erro (a UI apenas não mostra a seção).
    return new Response(JSON.stringify({ papers: [], error: e?.message ?? "search failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
