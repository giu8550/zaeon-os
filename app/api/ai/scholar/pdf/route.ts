import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";
import { Readable } from "node:stream";
import { pdfsDaPagina, pdfDoArxiv } from "@/lib/scholar/pdfDaPagina";
import { buscarSeguro, ehInterno, enderecoBloqueado, lerTexto } from "@/lib/scholar/buscaSegura";

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
  // virava 502 e o PDF "não aparecia" ao arrastar. arXiv vai direto pro /pdf/; página HTML → os PDFs que ela anuncia
  // (tenta um por um, até 3). Toda busca passa pelo buscarSeguro: o IP de verdade é conferido (revisão do #414).
  let r = await baixar(pdfDoArxiv(target) ?? target);
  if (r === "bloqueado") return new Response("Blocked redirect to private host", { status: 403 });
  if (r && ok(r) && !ehPdf(r) && /html/.test(r.tipo)) {
    const pagina = r.final;
    const html = await lerTexto(r.corpo).catch((e) => { console.warn("[pdf] não li a página do artigo:", host(pagina), msg(e)); return ""; });
    r = null;
    for (const achado of pdfsDaPagina(html, pagina).slice(0, 3)) {
      const r2 = await baixar(achado);
      if (r2 === "bloqueado") continue;          // anunciado em host interno: nem tenta (e não para os outros)
      if (r2 && ok(r2) && ehPdf(r2)) { r = r2; break; }
      r2?.corpo.destroy();
    }
  }
  if (!r || !ok(r) || !ehPdf(r)) {
    if (r) { console.warn("[pdf] a fonte não entregou um PDF:", host(r.final), r.status, r.tipo || "sem content-type"); r.corpo.destroy(); }
    return new Response("Upstream error", { status: 502 });
  }
  return new Response(Readable.toWeb(r.corpo) as unknown as ReadableStream, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" },
  });
}

type Baixado = { status: number; tipo: string; corpo: Readable; final: string };

const CABECALHOS = {
  // Muitos hosts acadêmicos (arXiv, journals) bloqueiam fetch "cru" sem User-Agent de browser → 403/502.
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/pdf,application/octet-stream,text/html;q=0.8,*/*;q=0.5",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

/** Segue os redirects À MÃO, cada salto conferido (a string e o IP de verdade). Host interno no caminho → "bloqueado";
 *  falha de rede/timeout → null (com o motivo no log, pra dar pra diferenciar no servidor). */
async function baixar(inicio: string): Promise<Baixado | "bloqueado" | null> {
  let current = inicio;
  for (let hop = 0; hop < 5; hop++) {
    if (enderecoBloqueado(current)) return "bloqueado";
    let res;
    try { res = await buscarSeguro(current, CABECALHOS); } catch (e) {
      if (ehInterno(e)) return "bloqueado";
      console.warn("[pdf] a fonte não respondeu:", host(current), msg(e));
      return null;
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      res.corpo.destroy();
      try { current = new URL(res.location, current).toString(); } catch { return null; }
      continue;
    }
    return { status: res.status, tipo: res.tipo, corpo: res.corpo, final: current };
  }
  return null;
}

const ok = (r: Baixado) => r.status >= 200 && r.status < 300;
// Muitos hosts servem PDF como octet-stream/binary (ou sem content-type) — aceitamos esses casos e os .pdf na URL.
const ehPdf = (r: Baixado) => /pdf|octet-stream|binary|force-download/.test(r.tipo) || /\.pdf(\?|#|$)/i.test(r.final);
const host = (u: string) => { try { return new URL(u).host; } catch { return "?"; } };
const msg = (e: unknown) => (e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? String(e);
