/**
 * Pré-carga do cyberespaço — começa na PÁGINA INICIAL, pra entrada ser imediata.
 *
 * O que baixa (e fica no cache HTTP do navegador, de onde o engine lê depois sem baixar de novo):
 *   - o CÓDIGO do cyberespaço (chunk do CosmicLounge: three + engine), via import dinâmico;
 *   - os SONS com arquivo (lib/cyber/audio.SONS, sem os sintetizados) e as TEXTURAS (Terra, logos);
 *   - os CORPOS VRM dos personagens (lib/cyber/estiloAvatar) — PESADOS (~166 MB no total): só em tela grande,
 *     sem `saveData` e fora de 2g/3g. No celular/economia de dados a barra cobre só o essencial.
 *
 * Singleton por aba: começa uma vez, quem chamar depois recebe o mesmo estado (a seção do cyberespaço, o CTA do
 * hero e a navbar podem perguntar "quanto falta?" sem reiniciar nada). Nunca lança: falha de um arquivo conta
 * como concluído (o engine tenta de novo na hora de entrar) — a barra sempre chega ao fim.
 *
 * Progresso ponderado por BYTES: cada arquivo pesa o `content-length` (ou uma estimativa pelo tipo até a resposta
 * chegar), então a barra anda no ritmo da rede, não "um arquivo = um passo".
 */
import { PASTA_SONS, SONS } from "./audio";
import { CORPOS_VRM, CORPO_DO_FUNDADOR } from "./estiloAvatar";

export type TipoItem = "codigo" | "som" | "textura" | "corpo";
export type ItemPrecarga = { url: string; tipo: TipoItem };

/** estimativa de bytes por tipo, usada só até o `content-length` chegar */
export const ESTIMATIVA: Record<TipoItem, number> = { codigo: 2_500_000, som: 250_000, textura: 900_000, corpo: 11_000_000 };

export const TEXTURAS = ["/assets/cyber/terra-blue-marble.jpg", "/assets/cyber/logo-unilab.png", "/assets/cyber/logo-uece.png", "/assets/cyber/logo-superteam-br.png"] as const;

/** os sons com ARQUIVO (os sintetizados nascem no navegador, não baixam nada) */
export function urlsDosSons(): string[] {
  return (Object.keys(SONS) as (keyof typeof SONS)[])
    .filter((n) => !SONS[n].sintetico)
    .map((n) => `${PASTA_SONS}${n}.${SONS[n].ext ?? "ogg"}`);
}

/** os corpos VRM (personagens + o do founder), sem repetir */
export function urlsDosCorpos(): string[] {
  return [...new Set([...Object.values(CORPOS_VRM).map((c) => c.url), CORPO_DO_FUNDADOR.url])];
}

/** o manifesto desta máquina: `pesados` liga os VRMs */
export function manifesto(pesados: boolean): ItemPrecarga[] {
  const itens: ItemPrecarga[] = [
    ...urlsDosSons().map((url) => ({ url, tipo: "som" as const })),
    ...TEXTURAS.map((url) => ({ url, tipo: "textura" as const })),
  ];
  if (pesados) itens.push(...urlsDosCorpos().map((url) => ({ url, tipo: "corpo" as const })));
  return itens;
}

/** esta máquina aguenta os corpos agora? (tela grande, sem economia de dados, rede boa) — PURO, testável */
export function aguentaPesados(a: { largura: number; saveData?: boolean; effectiveType?: string }): boolean {
  if (a.largura < 1024) return false;
  if (a.saveData) return false;
  if (a.effectiveType && /(^|-)2g$|3g/.test(a.effectiveType)) return false;
  return true;
}

export type EstadoPrecarga = {
  /** 0..1 */
  progresso: number;
  pronto: boolean;
  /** o que está baixando agora (rótulo curto) */
  etapa: string;
  /** os corpos entraram nesta pré-carga? */
  comCorpos: boolean;
  bytes: number;
  total: number;
};

type Ouvinte = (e: EstadoPrecarga) => void;

let estado: EstadoPrecarga = { progresso: 0, pronto: false, etapa: "", comCorpos: false, bytes: 0, total: 0 };
const ouvintes = new Set<Ouvinte>();
let iniciada = false;

export const estadoPrecarga = (): EstadoPrecarga => estado;
export function ouvirPrecarga(f: Ouvinte): () => void {
  ouvintes.add(f);
  f(estado);
  return () => { ouvintes.delete(f); };
}
function emitir(parcial: Partial<EstadoPrecarga>) {
  estado = { ...estado, ...parcial };
  // espelho pra inspeção no console (`window.__precarga`) — só leitura, sem efeito no app
  if (typeof window !== "undefined") (window as unknown as { __precarga?: EstadoPrecarga }).__precarga = estado;
  ouvintes.forEach((f) => f(estado));
}

const ROTULO: Record<TipoItem, string> = { codigo: "carregando o motor do cyberespaço", som: "afinando os sons", textura: "baixando a Terra", corpo: "despertando os avatares" };

/** lê o corpo inteiro contando bytes (pra barra); devolve os bytes lidos. Nunca lança. */
async function baixar(url: string, aoAvancar: (delta: number) => void, aoSaberTamanho: (n: number) => void): Promise<number> {
  try {
    const res = await fetch(url, { cache: "force-cache", ...( { priority: "low" } as RequestInit) });
    const len = Number(res.headers.get("content-length") || 0);
    if (len > 0) aoSaberTamanho(len);
    if (!res.ok) return 0;
    if (!res.body) { const b = await res.arrayBuffer(); aoAvancar(b.byteLength); return b.byteLength; }
    const reader = res.body.getReader();
    let lidos = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      lidos += value.byteLength; aoAvancar(value.byteLength);
    }
    return lidos;
  } catch { return 0; }
}

/**
 * Começa (uma vez) a pré-carga. `importarCodigo` é o import dinâmico do chunk (injetável nos testes).
 * `ambiente` decide se os corpos entram; por padrão lê a janela.
 */
export function precarregarCyber(opts: {
  importarCodigo?: () => Promise<unknown>;
  ambiente?: { largura: number; saveData?: boolean; effectiveType?: string };
  concorrencia?: number;
  baixarImpl?: typeof baixar;
} = {}): EstadoPrecarga {
  if (iniciada) return estado;
  iniciada = true;
  const amb = opts.ambiente ?? lerAmbiente();
  const pesados = aguentaPesados(amb);
  const itens = manifesto(pesados);
  const baixarFn = opts.baixarImpl ?? baixar;
  const importar = opts.importarCodigo ?? (() => import("@/components/cyber/CosmicLounge"));

  // pesos: começa com a estimativa; vira o tamanho real quando o cabeçalho chega
  const peso = new Map<string, number>();
  itens.forEach((i) => peso.set(i.url, ESTIMATIVA[i.tipo]));
  peso.set("__codigo", ESTIMATIVA.codigo);
  const feito = new Map<string, number>();
  const total = () => [...peso.values()].reduce((s, n) => s + n, 0);
  const bytes = () => [...feito.values()].reduce((s, n) => s + n, 0);
  // a barra NUNCA volta: se um arquivo vem maior que a estimativa, o total cresce e ela só espera
  const atualizar = (etapa?: string) => {
    const t = total(), b = Math.min(bytes(), t);
    emitir({ progresso: Math.max(estado.progresso, t > 0 ? b / t : 1), bytes: b, total: t, etapa: etapa ?? estado.etapa, comCorpos: pesados });
  };
  atualizar(ROTULO.codigo);

  void (async () => {
    // 1) o código primeiro (é o que mais demora a "aparecer" na entrada)
    try { await importar(); } catch { /* o engine importa de novo ao entrar */ }
    feito.set("__codigo", peso.get("__codigo")!);
    atualizar();

    // 2) sons + texturas + (corpos), em fila com concorrência limitada — não disputa a página inteira
    const fila = [...itens];
    const n = Math.max(1, Math.min(opts.concorrencia ?? 3, fila.length));
    const trabalhador = async () => {
      for (;;) {
        const item = fila.shift();
        if (!item) return;
        atualizar(ROTULO[item.tipo]);
        await baixarFn(
          item.url,
          (delta) => { feito.set(item.url, (feito.get(item.url) ?? 0) + delta); atualizar(); },
          (len) => { peso.set(item.url, len); atualizar(); },
        );
        // falhou ou veio sem corpo: conta como concluído (o engine tenta de novo ao entrar)
        feito.set(item.url, Math.max(feito.get(item.url) ?? 0, peso.get(item.url) ?? 0));
        atualizar();
      }
    };
    await Promise.all(Array.from({ length: n }, trabalhador));
    emitir({ progresso: 1, pronto: true, etapa: "pronto", bytes: total(), total: total() });
  })();

  return estado;
}

function lerAmbiente(): { largura: number; saveData?: boolean; effectiveType?: string } {
  if (typeof window === "undefined") return { largura: 0 };
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return { largura: window.innerWidth, saveData: c?.saveData, effectiveType: c?.effectiveType };
}

/** só pra testes */
export function _reiniciarPrecarga() {
  iniciada = false;
  estado = { progresso: 0, pronto: false, etapa: "", comCorpos: false, bytes: 0, total: 0 };
  ouvintes.clear();
}
