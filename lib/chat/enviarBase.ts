/**
 * lib/chat/enviarBase.ts — sobe um LOTE de PDFs pra "Minha base" (RAG F3): um arquivo por requisição,
 * ENVIOS_EM_PARALELO por vez, avisando o estado de cada um (a bandeja do chat mostra). Nunca lança.
 *  - 401 ⇒ para o lote e devolve "nao_logado" (o chat cai no comportamento antigo: a IA lê o primeiro PDF);
 *  - 503 (base fora do ar) ⇒ esse e os que ainda não subiram ficam "banco_indisponivel" (não adianta insistir);
 *  - acima de 25 MB nem sobe ("grande_demais"); queda de rede ⇒ "rede".
 */
import { ENVIOS_EM_PARALELO, MAX_BYTES_PDF, type ErroEnvio, type ResultadoEnvio } from "@/lib/rag/minhaBase";

export type EstadoEnvio = "na_fila" | "enviando" | "guardado" | "erro";
export type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

const ROTA = "/api/rag/minha-base";
const falha = (f: File, erro: ErroEnvio): ResultadoEnvio => ({ nomeArquivo: f.name, documentoId: "", status: "erro", erro, trechos: 0, paginas: 0 });

export async function enviarLote(
  arquivos: File[],
  o: { aoMudar?: (i: number, estado: EstadoEnvio, r?: ResultadoEnvio) => void; fetch?: Fetch; paralelo?: number } = {},
): Promise<ResultadoEnvio[] | "nao_logado"> {
  const http: Fetch = o.fetch ?? ((u, i) => fetch(u, i));
  const avisar = (i: number, e: EstadoEnvio, r?: ResultadoEnvio) => { try { o.aoMudar?.(i, e, r); } catch { /* bandeja é enfeite */ } };
  const out: ResultadoEnvio[] = new Array(arquivos.length);
  let proximo = 0;
  let parar: "nao_logado" | "banco" | null = null;

  arquivos.forEach((_, i) => avisar(i, "na_fila"));
  const fechar = (i: number, r: ResultadoEnvio) => { out[i] = r; avisar(i, r.status === "erro" ? "erro" : "guardado", r); };

  const um = async (i: number) => {
    const f = arquivos[i];
    if (parar === "banco") return fechar(i, falha(f, "banco_indisponivel"));
    if (parar) return;
    if (f.size > MAX_BYTES_PDF) return fechar(i, falha(f, "grande_demais"));
    avisar(i, "enviando");
    try {
      const fd = new FormData();
      fd.append("arquivos", f, f.name);
      const r = await http(ROTA, { method: "POST", body: fd });
      if (r.status === 401) { parar = "nao_logado"; return; }
      if (r.status === 503) { parar = "banco"; return fechar(i, falha(f, "banco_indisponivel")); }
      const j: any = await r.json().catch(() => null);
      const res: ResultadoEnvio | undefined = Array.isArray(j?.resultados) ? j.resultados[0] : undefined;
      fechar(i, r.ok && res ? { ...res, nomeArquivo: f.name } : falha(f, "leitura_falhou"));
    } catch {
      fechar(i, falha(f, "rede"));
    }
  };

  const trabalhador = async () => {
    while (proximo < arquivos.length) await um(proximo++);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.paralelo ?? ENVIOS_EM_PARALELO, arquivos.length)) }, trabalhador));
  if (parar === "nao_logado") return "nao_logado";
  return out;
}
