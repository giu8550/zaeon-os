/**
 * Núcleo de REDE do Studio (gerar artefato + acompanhar) — o mesmo no desktop
 * (StudyCoworkChat.runStudioAction) e no mobile (MobileChat). Sem React.
 *
 * Cada tipo tem o seu caminho no servidor, e isto preserva exatamente o que o desktop fazia:
 *  - podcast/vídeo: POST → polla /api/studio/:id (2,5s / 3s; teto 10 / 12 min); falha CALADA
 *  - molécula: síncrono (PubChem), precisa de meta.sdf
 *  - imagem: síncrono (Imagen), precisa de dataUrl
 *  - texto (mindmap/guide/faq/flashcards/timeline): fire-and-forget → polla 2s até 5 min
 */
export type BlocoStudio = { studioKind: string; title?: string; data?: any; artifactId?: string; dataUrl?: string };

export type ResultadoStudio =
  | { tipo: "pronto"; bloco: BlocoStudio }
  | { tipo: "erro"; mensagem?: string; silencioso?: boolean }
  | { tipo: "cancelado" };

export const KINDS_TEXTO = ["mindmap", "guide", "faq", "flashcards", "timeline"] as const;

type Deps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  agora?: () => number;
  cancelado?: () => boolean;
};

const H = { "Content-Type": "application/json" };

/** Cria um estudo novo pelo tópico (fonte da geração quando não há estudo em foco). */
export async function criarEstudo(titulo: string, d: Deps = {}): Promise<{ id: string; title?: string } | null> {
  try {
    const r = await (d.fetch ?? fetch)("/api/study/spaces", { method: "POST", headers: H, body: JSON.stringify({ title: titulo || "Estudo" }) });
    if (!r.ok) return null;
    const s = await r.json();
    return s?.id ? s : null;
  } catch {
    return null;
  }
}

async function json(r: Response): Promise<any> { return r.json().catch(() => null); }

export async function gerarArtefato(kind: string, o: { spaceId: string; topic: string } & Deps): Promise<ResultadoStudio> {
  const f = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const agora = o.agora ?? (() => Date.now());
  const { spaceId, topic } = o;

  const acompanhar = async (id: string, intervalo: number, teto: number, silencioso: boolean, comArtifactId: boolean): Promise<ResultadoStudio> => {
    const inicio = agora();
    while (agora() - inicio < teto) {
      await sleep(intervalo);
      if (o.cancelado?.()) return { tipo: "cancelado" };
      const d = await f(`/api/studio/${id}`).then(json).catch(() => null);
      if (!d) continue;
      if (d.status === "done") return { tipo: "pronto", bloco: { studioKind: kind, title: d.title, data: d.meta, ...(comArtifactId ? { artifactId: d.id } : {}) } };
      if (d.status === "error") return { tipo: "erro", mensagem: d?.error, silencioso };
    }
    // teto: o desktop sempre parou CALADO aqui (todas as categorias) — preservado
    return { tipo: "erro", mensagem: "Demorou demais pra gerar.", silencioso: true };
  };

  try {
    if (kind === "podcast" || kind === "video") {
      const res = await f(`/api/studio/${kind}`, { method: "POST", headers: H, body: JSON.stringify({ spaceId }) });
      const data = await json(res);
      if (!res.ok || !data?.id) return { tipo: "erro", silencioso: true };
      if (data.status === "done") return { tipo: "pronto", bloco: { studioKind: kind, title: data.title, data: data.meta, artifactId: data.id } };
      return acompanhar(data.id, kind === "video" ? 3000 : 2500, kind === "video" ? 12 * 60_000 : 10 * 60_000, true, true);
    }
    if (kind === "molecule") {
      // Não passa pelo pipeline de texto: a estrutura vem do PubChem, não de LLM.
      const res = await f("/api/studio/molecule", { method: "POST", headers: H, body: JSON.stringify({ spaceId, topic }) });
      const data = await json(res);
      return res.ok && data?.meta?.sdf
        ? { tipo: "pronto", bloco: { studioKind: "molecule", title: data.title, data: data.meta, artifactId: data.id } }
        : { tipo: "erro", mensagem: data?.error };
    }
    if (kind === "image") {
      const res = await f("/api/studio/image", { method: "POST", headers: H, body: JSON.stringify({ spaceId, topic }) });
      const data = await json(res);
      return res.ok && data?.dataUrl
        ? { tipo: "pronto", bloco: { studioKind: "image", title: data.title || "Imagem", data: data.meta, dataUrl: data.dataUrl } }
        : { tipo: "erro", mensagem: data?.error };
    }
    // Texto: roda em BACKGROUND no servidor (fire-and-forget) → "queued" e polling até "done".
    // Cache hit já volta "done" com meta na hora.
    const res = await f(`/api/studio/${kind}`, { method: "POST", headers: H, body: JSON.stringify({ spaceId, topic, force: true }) });
    const data = await json(res);
    if (!res.ok || !data?.id) return { tipo: "erro", mensagem: data?.error };
    if (data.status === "done" && data.meta) return { tipo: "pronto", bloco: { studioKind: kind, title: data.title, data: data.meta } };
    return acompanhar(data.id, 2000, 5 * 60_000, false, false);
  } catch {
    return { tipo: "erro" };
  }
}
