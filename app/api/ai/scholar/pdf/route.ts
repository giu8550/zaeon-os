import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";
import { pdfDaPagina, pdfDoArxiv } from "@/lib/scholar/pdfDaPagina";

export const runtime = "nodejs";
// Sem isto, a Vercel mata a função em ~10s e o download do PDF (host acadêmico lento)
// fica preso em "Baixando documento". 60s cobre o fetch (timeout de 20s/hop) + o stream.
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const target = new URL(req.url).searchParams.get("url") ?? "";
  if (!isSafePublicHttpUrl(target)) return new Response("Bad URL", { status: 400 });

  // Autorização: basta o usuário estar logado + a URL ser um host PÚBLICO (SSRF guard,
  // revalidado a cada redirect). Antes exigia que a URL estivesse em `references` de alguma
  // ScholarSession — o que dava 403 nos PDFs salvos pela aba RESULTADOS (campo `results`) e em
  // links/uploads antigos: a biblioteca vive em localStorage (permanente) e as sessões rotacionam.
  // O guard anti-SSRF abaixo continua sendo a proteção contra abuso (nada de host privado/interno).

  // #414: o endereço salvo às vezes é a PÁGINA do artigo (arXiv /abs/, doi.org → editora), não o PDF. Antes isso
  // virava 502 e o PDF "não aparecia" ao arrastar. arXiv vai direto pro /pdf/; página HTML → o PDF que ela anuncia.
  let r = await baixar(pdfDoArxiv(target) ?? target);
  if (r === "bloqueado") return new Response("Blocked redirect to private host", { status: 403 });
  if (r && r.upstream.ok && !ehPdf(r) && /html/.test(tipo(r))) {
    const html = await r.upstream.text().catch(() => "");
    const achado = pdfDaPagina(html, r.final);
    if (achado && isSafePublicHttpUrl(achado)) {
      const r2 = await baixar(achado);
      if (r2 === "bloqueado") return new Response("Blocked redirect to private host", { status: 403 });
      r = r2;
    }
  }
  if (!r || !r.upstream.ok || !ehPdf(r)) {
    return new Response("Upstream error", { status: 502 });
  }
  const upstream = r.upstream;
  return new Response(upstream.body, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" },
  });
}

type Baixado = { upstream: Response; final: string };

/** Segue os redirects À MÃO, revalidando cada salto contra o guard anti-SSRF. Host privado no caminho → "bloqueado". */
async function baixar(inicio: string): Promise<Baixado | "bloqueado" | null> {
  let current = inicio;
  let upstream: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    if (!isSafePublicHttpUrl(current)) return "bloqueado";
    // Muitos hosts acadêmicos (arXiv, journals) bloqueiam fetch "cru" sem User-Agent de browser → 403/502.
    upstream = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/pdf,application/octet-stream,text/html;q=0.8,*/*;q=0.5",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    }).catch(() => null);
    if (!upstream) return null;
    const loc = upstream.headers.get("location");
    if (upstream.status >= 300 && upstream.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }
  return upstream ? { upstream, final: current } : null;
}

const tipo = (r: Baixado) => (r.upstream.headers.get("content-type") ?? "").toLowerCase();
// Muitos hosts servem PDF como octet-stream/binary (ou sem content-type) — aceitamos esses casos e os .pdf na URL.
const ehPdf = (r: Baixado) => /pdf|octet-stream|binary|force-download/.test(tipo(r)) || /\.pdf(\?|#|$)/i.test(r.final);
