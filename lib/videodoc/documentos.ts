/**
 * VÍDEO DO DOCUMENTO — os DOCUMENTOS de um estudo (PURO). Pedido do dono (out/2026): "os documentos mais importantes
 * citados na conversa (ou os nossos) têm um vídeo gerado num card dentro da sala de estudos". O servidor não guardava
 * quais documentos cada conversa citou; agora o blueprint junta, a cada turno, o que a resposta da Aura trouxe:
 *  - ARTIGO: as fontes da busca acadêmica e das evidências (título + URL/DOI);
 *  - LIVRO: os livros com PDF livre (buscar_livro);
 *  - BASE: os documentos da base da pessoa que a resposta citou (RAG — `fontesBase`, ref = documentoId);
 *  - TRABALHO: o TCC/artigo/relatório escrito na conversa (ref = workId).
 * A CHAVE (DOI > URL > base:id > trabalho:id) evita repetir o mesmo documento — e decide o compartilhamento do vídeo.
 */
import type { StructuredAnswer } from "@/lib/agent/contracts";
import { MAX_BASE, MAX_DOCUMENTOS, sanitizarDocumento, type Documento } from "@/lib/blueprint/tipos";

const RE_DOI = /(?:doi\.org\/|^doi:)(10\.\d{4,9}\/[^\s?#]+)/i;

/** a chave do documento: doi:… | url:… | base:… | trabalho:… */
export function chaveDocumento(d: Pick<Documento, "tipo" | "url" | "ref">): string {
  if (d.tipo === "base" && d.ref) return `base:${d.ref}`;
  if (d.tipo === "trabalho" && d.ref) return `trabalho:${d.ref}`;
  const doi = d.ref && /^10\./.test(d.ref) ? d.ref : d.url ? RE_DOI.exec(decodeURIComponent(d.url))?.[1] : undefined;
  if (doi) return `doi:${doi.toLowerCase()}`;
  if (d.url) {
    try { const u = new URL(d.url); return `url:${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase(); } catch { /* cai abaixo */ }
  }
  return `ref:${(d.ref ?? "").toLowerCase()}`;
}
/** documento PÚBLICO (artigo/livro com DOI ou URL): o vídeo dele é um só pra todo mundo */
export const documentoPublico = (d: Pick<Documento, "tipo" | "url" | "ref">): boolean => (d.tipo === "artigo" || d.tipo === "livro") && /^(doi|url):/.test(chaveDocumento(d));

const idDe = (chave: string) => `d${(() => { let h = 5381; for (let i = 0; i < chave.length; i++) h = ((h << 5) + h + chave.charCodeAt(i)) >>> 0; return h.toString(36); })()}`;

type Resposta = Partial<Pick<StructuredAnswer, "sources" | "evidencia" | "fontesBase" | "livros" | "tcc">>;

/** os documentos que uma resposta da Aura trouxe (sem título, não entra) */
export function documentosDaResposta(a: Resposta | null | undefined): Documento[] {
  if (!a) return [];
  const brutos: Omit<Documento, "id">[] = [
    ...(a.sources ?? []).map((s) => ({ titulo: s.title, tipo: "artigo" as const, url: s.url, base: false })),
    ...(a.evidencia ?? []).map((e) => ({ titulo: e.source?.title, tipo: "artigo" as const, url: e.source?.url, base: false })),
    ...(a.livros ?? []).filter((l) => l.pdfUrl).map((l) => ({ titulo: l.titulo, tipo: "livro" as const, url: l.pdfUrl ?? undefined, base: false })),
    ...(a.fontesBase ?? []).map((f) => ({ titulo: f.titulo, tipo: "base" as const, ref: f.documentoId, base: false })),
    ...(a.tcc ? [{ titulo: a.tcc.titulo, tipo: "trabalho" as const, ref: a.tcc.workId, base: false }] : []),
  ].filter((d) => typeof d.titulo === "string" && d.titulo.trim()) as Omit<Documento, "id">[];
  const vistos = new Set<string>(), out: Documento[] = [];
  for (const b of brutos) {
    const k = chaveDocumento(b); if (vistos.has(k) || k === "ref:") continue; vistos.add(k);
    const d = sanitizarDocumento({ ...b, id: idDe(k) }); if (d) out.push(d);
  }
  return out;
}

/** junta os novos aos que o estudo já tem (pela chave): os antigos mantêm base/vídeo; o teto é dos mais recentes, sem
 *  nunca tirar quem é base ou tem vídeo */
export function juntarDocumentos(atual: readonly Documento[], novos: readonly Documento[]): Documento[] {
  const chaves = new Set(atual.map(chaveDocumento));
  const somados = [...atual, ...novos.filter((n) => !chaves.has(chaveDocumento(n)))];
  if (somados.length <= MAX_DOCUMENTOS) return somados;
  const fixos = somados.filter((d) => d.base || d.videoId), soltos = somados.filter((d) => !d.base && !d.videoId);
  return [...fixos, ...soltos.slice(-(MAX_DOCUMENTOS - fixos.length))].slice(0, MAX_DOCUMENTOS);
}

/** aplica a escolha da Zaeon: até MAX_BASE ids viram base; quem já tem vídeo continua base (o card não some) */
export function marcarBase(docs: readonly Documento[], escolhidos: readonly string[]): Documento[] {
  const sel = new Set(escolhidos.slice(0, MAX_BASE));
  return docs.map((d) => ({ ...d, base: !!d.videoId || sel.has(d.id) }));
}
