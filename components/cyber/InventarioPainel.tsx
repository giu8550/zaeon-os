"use client";

/**
 * InventarioPainel — o INVENTÁRIO do cyberespaço (tecla I), como num RPG de verdade (out/2026) com a identidade da
 * Zaeon: à esquerda a FICHA do viajante (a arma equipada e o que ele já criou), no meio a MOCHILA (a grade de espaços,
 * cada item com a moldura da raridade), à direita o INSPETOR do item escolhido — com o HOLOGRAMA 3D quando é um livro.
 * O que entra:
 *  - as ARMAS (lib/cyber/inventario — equipar/desequipar é com o engine);
 *  - os LIVROS DOS ESTUDOS (lib/estudos/itens — evoluem com o blueprint do board de Meus Estudos);
 *  - as PESQUISAS (ResearchWork): livros-holograma com as páginas que a pessoa escreveu — sem base de estudos ainda não
 *    têm valor (o veredito do Droid no tutorial). `destaque` = a pesquisa recém-criada (vem escolhida e com o selo NOVO).
 * O MODO DE ENTREGA (`encaixe.ativo`, o Relicário do Saber — lib/cyber/relicario): o cabeçalho vira a faixa dourada, os
 * itens que CABEM (estudos e pesquisas) ganham o ▶ e as armas apagam; a pesquisa ainda local (sem id do servidor) não
 * tem ▶ — "sincronizando…". O ▶ (ou o botão do inspetor) chama `onEntregar`; quem fala com o servidor é o chamador.
 * A CARTEIRA (components/cyber/CarteiraInventario): a aba das MOEDAS — a AURA e as da Solana, cada uma um item; a
 * bolsa no cabeçalho mostra a AURA e o total em dólar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { COMBO, danoDoGolpe } from "@/lib/cyber/combate";
import { ITENS, type IdItem, type Inventario } from "@/lib/cyber/inventario";
import { encaixaNoRelicario, type ItemEncaixe } from "@/lib/cyber/relicario";
import type { ItemEstudo, ItemPesquisa } from "@/lib/estudos/itens";
import { VALOR_PESQUISA_SEM_BASE } from "@/lib/cyber/livroHolograma";
import { paginasDe } from "@/lib/onboarding/tutorialLab";
import type { PesquisaSalva } from "@/lib/ui/loungeHub";
import LivroHolograma from "./LivroHolograma";
import { BolsaCabecalho, ColdWallet, GradeCarteira, InspetorMoeda, useCarteira } from "./CarteiraInventario";

/** o acabamento das peças (out/2026, o dono: "o inventário poderia seguir uma estética mais detalhada"): o espaço com
 *  chanfro, o vidro escuro por dentro, o brilho da raridade (`--c`) subindo do fundo e os cantos marcados; a moeda do
 *  inspetor gira no eixo */
const ESTILO = `
.tile-inv{border-width:2px;border-style:solid;background:
  radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--c) 26%, transparent), transparent 62%),
  linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.42) 46%, rgba(0,0,0,.6));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 -10px 18px -10px color-mix(in srgb, var(--c) 55%, transparent), inset 0 0 0 1px rgba(0,0,0,.6);
  clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)}
.tile-inv::before,.tile-inv::after{content:"";position:absolute;width:9px;height:9px;border-color:var(--c);opacity:.85;pointer-events:none}
.tile-inv::before{left:3px;top:3px;border-left:1.5px solid;border-top:1.5px solid}
.tile-inv::after{right:3px;bottom:3px;border-right:1.5px solid;border-bottom:1.5px solid}
.vaga-inv{clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)}
@keyframes moeda-gira{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}
.moeda-gira{animation:moeda-gira 7s linear infinite}
@media (prefers-reduced-motion: reduce){.moeda-gira{animation:none}}`;

const COR_RARIDADE: Record<string, string> = { comum: "#c9d4dc", rara: "#5fb8ff", epica: "#b98cff", lendaria: "#ffc46b" };
const NOME_RARIDADE: Record<string, string> = { comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária" };
const COR_PESQUISA = "#7fe8ff";
const MIN_ESPACOS = 20;
/** o ouro do Relicário (o mesmo do selo NOVO e dos cantos ◆) */
const OURO = "#ffc46b", OURO_TEXTO = "#1a1004", OURO_BORDA = "#fff1cf";

/** o ícone de um LIVRO (aberto, na cor da raridade) */
function IconeLivro({ cor, tam = 40 }: { cor: string; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden>
      <path d="M5 11 L19 8 L19 31 L5 34 Z" fill="#0b1f33" stroke={cor} strokeWidth="1.2" />
      <path d="M35 11 L21 8 L21 31 L35 34 Z" fill="#0b1f33" stroke={cor} strokeWidth="1.2" />
      {[14, 18, 22, 26].map((y) => <g key={y}><path d={`M8 ${y} L17 ${y - 2}`} stroke={cor} strokeOpacity=".5" strokeWidth=".8" /><path d={`M32 ${y} L23 ${y - 2}`} stroke={cor} strokeOpacity=".5" strokeWidth=".8" /></g>)}
    </svg>
  );
}
/** o ícone de uma PESQUISA (o livro-holograma fechado, com o brilho ciano) */
function IconePesquisa({ tam = 40 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden style={{ filter: `drop-shadow(0 0 4px ${COR_PESQUISA}88)` }}>
      <rect x="9" y="6" width="22" height="28" rx="2" fill="#071a2c" stroke={COR_PESQUISA} strokeWidth="1.3" />
      <rect x="12" y="9" width="16" height="22" rx="1" fill="none" stroke={COR_PESQUISA} strokeOpacity=".45" strokeWidth=".8" />
      <circle cx="20" cy="17" r="3.4" fill="none" stroke={COR_PESQUISA} strokeWidth=".9" />
      {[23, 26].map((y) => <path key={y} d={`M14 ${y} H26`} stroke={COR_PESQUISA} strokeOpacity=".55" strokeWidth=".8" />)}
    </svg>
  );
}
/** o ícone da Espada Espiritual (lâmina escura, linha central acesa, guarda em asa) */
function IconeEspada({ tam = 40 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 3 L23 8 L23 27 L17 27 L17 8 Z" fill="#0f1a17" stroke="#1d3a33" strokeWidth="0.6" />
      <line x1="20" y1="5" x2="20" y2="26.5" stroke="#35ffd0" strokeWidth="1.2" style={{ filter: "drop-shadow(0 0 2px #35ffd0)" }} />
      <path d="M9 28 Q15 26 20 27.5 Q25 26 31 28 L29 29.5 Q24 28.8 20 30 Q16 28.8 11 29.5 Z" fill="#16231f" stroke="#2c5a4f" strokeWidth="0.5" />
      <rect x="18.8" y="30" width="2.4" height="6" rx="0.8" fill="#1a2024" />
      <path d="M20 36 L21.4 38.6 L18.6 38.6 Z" fill="#16231f" />
    </svg>
  );
}

/** o ícone da ARMADURA (o peitoral com as ombreiras, na cor do traje) */
function IconeArmadura({ cor, tam = 40 }: { cor: string; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden style={{ filter: `drop-shadow(0 0 4px ${cor}77)` }}>
      <path d="M8 9 Q13 6 16 8 L20 11 L24 8 Q27 6 32 9 L35 15 L30 17 L30 33 Q20 37 10 33 L10 17 L5 15 Z" fill="#0d1118" stroke={cor} strokeWidth="1.3" />
      <path d="M14 14 L20 17 L26 14 M14 21 H26 M15 27 H25" stroke={cor} strokeOpacity=".6" strokeWidth=".9" fill="none" />
      <circle cx="20" cy="22.5" r="1.6" fill={cor} />
    </svg>
  );
}
export type ArmaduraItem = { nome: string; cor: string; raridade: "comum" | "rara" | "epica" | "lendaria"; descricao: string };

type Entrada =
  | { tipo: "arma"; key: string; id: IdItem; cor: string }
  | { tipo: "livro"; key: string; it: ItemEstudo; cor: string }
  | { tipo: "pesquisa"; key: string; it: ItemPesquisa; cor: string; nova: boolean }
  | { tipo: "armadura"; key: string; it: ArmaduraItem; cor: string };
type Aba = "tudo" | "arma" | "livro" | "pesquisa" | "carteira";
const ABAS: { id: Aba; nome: string }[] = [{ id: "tudo", nome: "Tudo" }, { id: "arma", nome: "Equipamento" }, { id: "livro", nome: "Estudos" }, { id: "pesquisa", nome: "Pesquisas" }, { id: "carteira", nome: "Carteira" }];

/** a pesquisa do tutorial como item (antes do servidor listar, ou sem id): as páginas pelas palavras */
const pesquisaLocal = (p: PesquisaSalva): ItemPesquisa => ({ id: p.workId ?? `local:${p.titulo}`, titulo: p.titulo, paginas: paginasDe(p.palavras), palavras: p.palavras, atualizadoEm: null });

/** o MODO DE ENTREGA: `enviando` = o id do item indo pro servidor agora (ou null); `erro` = o texto do servidor/rede pra mostrar */
export type EncaixeInventario = { ativo: boolean; onEntregar: (it: ItemEncaixe) => void; enviando?: string | null; erro?: string | null };
/** a entrada como item de encaixe (null = não cabe no Relicário: as armas) */
const itemDeEncaixe = (e: Entrada): ItemEncaixe | null => ((e.tipo === "livro" || e.tipo === "pesquisa") && encaixaNoRelicario(e.tipo) ? { tipo: e.tipo, id: e.it.id, titulo: e.it.titulo } : null);
/** a pesquisa que ainda não tem id do servidor (o tutorial, antes de sincronizar) — não dá pra entregar */
const aindaLocal = (it: ItemEncaixe) => it.tipo === "pesquisa" && it.id.startsWith("local:");

/** o botão dourado do INSPETOR no modo de entrega (desligado enquanto o item vai pro servidor ou ainda é local) */
function BotaoEntregar({ it, encaixe }: { it: ItemEncaixe; encaixe: EncaixeInventario }) {
  const enviando = encaixe.enviando === it.id, local = aindaLocal(it);
  return (
    <>
      <button type="button" disabled={enviando || local} onClick={() => encaixe.onEntregar(it)}
        className="mt-3 min-h-[40px] w-full rounded-full text-xs font-black uppercase tracking-widest transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
        style={{ background: `linear-gradient(180deg,${OURO_BORDA},${OURO})`, color: OURO_TEXTO, boxShadow: `0 0 22px -6px ${OURO}` }}>
        {enviando ? "Enviando…" : local ? "Sincronizando…" : "Entregar no Relicário ▶"}
      </button>
      {encaixe.erro && <p role="alert" className="mt-1.5 text-[12px] leading-snug text-rose-300">{encaixe.erro}</p>}
    </>
  );
}

export default function InventarioPainel({ aberto, onFechar, ler, equipar, destaque, encaixe, armadura, aoEnquadrar }: { aberto: boolean; onFechar: () => void; ler: () => Inventario | null; equipar: (id: IdItem | null) => Inventario | null; destaque?: PesquisaSalva | null; encaixe?: EncaixeInventario; /** a armadura que estou vestindo (o engine) */ armadura?: () => ArmaduraItem | null; /** onde o personagem deve ficar na tela (0..1 da largura) — o meio da vitrine */ aoEnquadrar?: (cx: number) => void }) {
  const [inv, setInv] = useState<Inventario | null>(null);
  const [arm, setArm] = useState<ArmaduraItem | null>(null);
  useEffect(() => { if (aberto) setArm(armadura?.() ?? null); }, [aberto, armadura]);
  // o ENQUADRAMENTO: o personagem no meio da área livre entre os espaços equipados e a cold wallet
  const vitrineRef = useRef<HTMLElement | null>(null), equipRef = useRef<HTMLDivElement | null>(null), walletRef = useRef<HTMLDivElement | null>(null);
  const prontoPraMedir = aberto && !!inv;
  useEffect(() => {
    if (!prontoPraMedir || !aoEnquadrar) return;
    const medir = () => {
      const v = vitrineRef.current?.getBoundingClientRect(), a = equipRef.current?.getBoundingClientRect(), b = walletRef.current?.getBoundingClientRect();
      if (!v || v.width <= 0) { aoEnquadrar(0.5); return; }   // (no celular a vitrine some: o personagem no meio)
      aoEnquadrar(((a ? a.right : v.left) + (b ? b.left : v.right)) / 2 / window.innerWidth);
    };
    const id = requestAnimationFrame(medir), t = setTimeout(medir, 350); window.addEventListener("resize", medir);   // (de novo depois do layout assentar)
    return () => { cancelAnimationFrame(id); clearTimeout(t); window.removeEventListener("resize", medir); };
  }, [prontoPraMedir, aoEnquadrar]);
  const [livros, setLivros] = useState<ItemEstudo[] | null>(null), [pesquisas, setPesquisas] = useState<ItemPesquisa[] | null>(null);
  const [aba, setAba] = useState<Aba>("tudo"), [sel, setSel] = useState<string | null>(null), [selMoeda, setSelMoeda] = useState<string | null>(null);
  const carteira = useCarteira(aberto);
  const moedas = useMemo(() => [...(carteira.aura ? [carteira.aura] : []), ...carteira.carteiras.flatMap((c) => c.moedas.map((m) => ({ ...m, id: `${c.tipo}:${m.id}` })))], [carteira.aura, carteira.carteiras]);
  const moedaAtual = moedas.find((m) => m.id === selMoeda) ?? moedas[0] ?? null;
  const enderecoDa = (id: string) => carteira.carteiras.find((c) => id.startsWith(`${c.tipo}:`))?.endereco ?? null;
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    fetch("/api/estudos/itens", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).then((j: { itens?: ItemEstudo[]; pesquisas?: ItemPesquisa[] }) => { if (vivo) { setLivros(j.itens ?? []); setPesquisas(j.pesquisas ?? []); } }).catch(() => { if (vivo) { setLivros([]); setPesquisas([]); } });
    return () => { vivo = false; };
  }, [aberto]);
  useEffect(() => { if (aberto) setInv(ler()); }, [aberto, ler]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key.toLowerCase() === "i") { e.preventDefault(); onFechar(); } };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);

  // tudo o que a pessoa tem, numa lista só (a pesquisa nova primeiro)
  const entradas = useMemo<Entrada[]>(() => {
    const out: Entrada[] = [];
    const ps = [...(pesquisas ?? [])];
    if (destaque) { const local = pesquisaLocal(destaque); const i = ps.findIndex((p) => p.id === local.id); if (i >= 0) ps.splice(i, 1); ps.unshift(i >= 0 ? { ...(pesquisas ?? [])[i]!, paginas: Math.max((pesquisas ?? [])[i]!.paginas, local.paginas) } : local); }
    ps.forEach((it, i) => out.push({ tipo: "pesquisa", key: `p:${it.id}`, it, cor: COR_PESQUISA, nova: !!destaque && i === 0 }));
    if (arm) out.push({ tipo: "armadura", key: "t:armadura", it: arm, cor: COR_RARIDADE[arm.raridade]! });   // (a armadura vestida: sempre a 1ª do equipamento)
    for (const id of inv?.espacos ?? []) if (id) out.push({ tipo: "arma", key: `a:${id}`, id, cor: COR_RARIDADE[ITENS[id].raridade]! });
    for (const it of livros ?? []) out.push({ tipo: "livro", key: `l:${it.id}`, it, cor: COR_RARIDADE[it.raridade]! });
    return out;
  }, [inv, livros, pesquisas, destaque, arm]);
  const visiveis = aba === "tudo" ? entradas : aba === "carteira" ? [] : entradas.filter((e) => e.tipo === aba || (aba === "arma" && e.tipo === "armadura"));
  const atual = visiveis.find((e) => e.key === sel) ?? visiveis[0] ?? null;
  useEffect(() => { if (aberto && destaque) { setAba("tudo"); setSel(`p:${pesquisaLocal(destaque).id}`); } }, [aberto, destaque]);

  if (!aberto || !inv) return null;
  const nPesq = entradas.filter((e) => e.tipo === "pesquisa").length, nLivros = entradas.filter((e) => e.tipo === "livro").length;
  const paginasTotais = entradas.reduce((s, e) => s + (e.tipo === "pesquisa" ? e.it.paginas : 0), 0);
  const armaEquipada = inv.equipado ? ITENS[inv.equipado] : null;
  const vagas = Math.max(MIN_ESPACOS, Math.ceil(visiveis.length / 5) * 5);
  const entrega = encaixe?.ativo ? encaixe : null;

  return (
    <div role="dialog" aria-label="Inventário" onPointerDown={(e) => e.stopPropagation()} className="absolute inset-0 z-40 flex items-center gap-4 p-3 text-sky-50 md:p-5">
      <style>{ESTILO}</style>
      {/* a VITRINE (out/2026, o dono: "ao apertar I a câmera se aproxima do personagem de frente, e mostra a armadura
          dele e a carteira"): transparente — o personagem aparece aqui, de frente (a câmera do engine); em volta, o que
          ele veste e a COLD WALLET do lado direito dele */}
      <section ref={vitrineRef} aria-label="O viajante" className="pointer-events-none relative hidden h-full flex-1 md:block" style={{ background: "radial-gradient(ellipse 46% 60% at 46% 55%, transparent 55%, rgba(2,4,12,.55))" }}>
        <div className="absolute left-2 top-14">
          <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-200/70" style={{ textShadow: "0 0 10px rgba(0,0,0,.9)" }}>Ficha do viajante</p>
        </div>
        {/* o EQUIPADO: a armadura e a arma, à esquerda do personagem */}
        <div ref={equipRef} className="pointer-events-auto absolute left-2 top-1/2 grid w-[160px] -translate-y-1/2 gap-2">
          {[
            { k: "t:armadura", rotulo: "Armadura", nome: arm?.nome ?? "—", cor: arm ? COR_RARIDADE[arm.raridade]! : "#ffffff33", icone: arm ? <IconeArmadura cor={arm.cor} tam={34} /> : null },
            { k: armaEquipada ? `a:${armaEquipada.id}` : "", rotulo: "Arma", nome: armaEquipada?.nome ?? "Nenhuma", cor: armaEquipada ? COR_RARIDADE[armaEquipada.raridade]! : "#ffffff33", icone: armaEquipada ? <IconeEspada tam={34} /> : null },
          ].map((x) => (
            <button key={x.rotulo} type="button" disabled={!x.k} onClick={() => { setAba("tudo"); setSel(x.k); }}
              className="flex items-center gap-2 rounded-lg border bg-black/55 p-2 text-left backdrop-blur-sm transition-colors hover:bg-black/70" style={{ borderColor: `${x.cor}66` }}>
              <span className="tile-inv relative grid h-11 w-11 shrink-0 place-items-center rounded-md" style={{ ["--c" as string]: x.cor, borderColor: `${x.cor}99` }}>{x.icone ?? <span className="text-[10px] text-white/30">—</span>}</span>
              <span className="min-w-0 text-[11px]"><span className="block uppercase tracking-wider text-white/45">{x.rotulo}</span><span className="block truncate font-bold">{x.nome}</span></span>
            </button>
          ))}
          <dl className="mt-1 grid gap-1 text-[11px]">
            {[["AURA", carteira.aura ? Math.round(carteira.aura.quantidade) : "—"], ["Pesquisas", nPesq], ["Livros de estudo", nLivros], ["Páginas escritas", paginasTotais]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between rounded-md bg-black/50 px-2.5 py-1 backdrop-blur-sm"><dt className="text-sky-100/60">{k}</dt><dd className="font-black tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </div>
        {/* a CARTEIRA em destaque, do lado direito do personagem */}
        <div ref={walletRef} className="absolute right-2 top-1/2 -translate-y-1/2"><ColdWallet est={carteira} ativo={aba === "carteira"} onAbrir={() => setAba("carteira")} /></div>
      </section>
      <div className="relative flex h-[min(88vh,660px)] w-full flex-col overflow-hidden rounded-[18px] border-2 md:w-[min(54vw,740px)]"
      style={{ borderColor: "#3b6fb066", background: "linear-gradient(180deg,rgba(9,14,32,.97),rgba(4,6,16,.98))", boxShadow: "0 0 0 1px #000 inset, 0 0 0 5px rgba(127,232,255,.05) inset, 0 30px 90px -20px rgba(0,0,0,.9), 0 0 60px -20px rgba(127,232,255,.45)" }}>
      {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((k) => <span key={k} aria-hidden className={`pointer-events-none absolute ${k} text-[10px] text-[#ffc46b]`}>◆</span>)}
      {/* o título e as abas */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5" style={{ background: entrega ? `linear-gradient(90deg,${OURO}24,transparent 55%,${OURO}10)` : "linear-gradient(90deg,rgba(127,232,255,.08),transparent 40%,rgba(185,140,255,.08))" }}>
        {entrega ? (
          <div className="min-w-0 rounded-md border px-3 py-1.5" style={{ borderColor: `${OURO}80`, background: `${OURO}14`, boxShadow: `0 0 18px -8px ${OURO}` }}>
            <h2 className="truncate text-[13px] font-black tracking-[0.12em]" style={{ color: OURO, textShadow: `0 0 14px ${OURO}99` }}>◆ MODO DE ENTREGA · Escolha o que vai pro Relicário do Saber</h2>
            <p className="text-[10.5px] text-[#ffe2a8]/70">Só estudos e pesquisas cabem nele. A Zaeon lê — e a sala assiste.</p>
          </div>
        ) : (
          <div>
            <h2 className="whitespace-nowrap text-[14px] font-black uppercase tracking-[0.28em] text-white" style={{ textShadow: "0 0 14px rgba(127,232,255,.6)" }}>Inventário</h2>
          </div>
        )}
        <div role="tablist" aria-label="Categorias" className="flex min-w-0 gap-1 overflow-x-auto">
          {ABAS.map((a) => {
            const n = a.id === "tudo" ? entradas.length : a.id === "carteira" ? moedas.length : entradas.filter((e) => e.tipo === a.id || (a.id === "arma" && e.tipo === "armadura")).length;
            return (
              <button key={a.id} role="tab" aria-selected={aba === a.id} type="button" onClick={() => setAba(a.id)}
                className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider transition-colors ${aba === a.id ? "border-[#ffc46b]/70 bg-[#ffc46b]/12 text-[#ffe2a8]" : "border-white/10 text-sky-100/60 hover:text-white"}`}>
                {a.nome} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto"><BolsaCabecalho aura={carteira.aura} carteiras={carteira.carteiras} /></div>
        <span className="hidden text-[10.5px] text-sky-100/40 sm:block"><kbd className="rounded border border-white/20 px-1.5 font-mono">I</kbd> fecha</span>
        <button type="button" onClick={onFechar} aria-label="Fechar o inventário" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white">✕</button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[1fr,290px]">
        {/* a MOCHILA */}
        <div className="min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
          {aba === "carteira" ? <GradeCarteira est={carteira} sel={moedaAtual?.id ?? null} onSel={setSelMoeda} conectar={carteira.conectar} desconectar={carteira.desconectar} /> : <>
          {livros === null && <p className="mb-2 text-[11px] text-sky-100/40">carregando…</p>}
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: vagas }, (_, i) => {
              const e = visiveis[i];
              if (!e) return <div key={`v${i}`} aria-hidden className="vaga-inv aspect-square rounded-lg border border-white/[0.07] bg-[repeating-linear-gradient(45deg,rgba(255,255,255,.018)_0_6px,transparent_6px_12px)] shadow-[inset_0_0_14px_rgba(0,0,0,.6)]" />;
              const on = atual?.key === e.key;
              const nome = e.tipo === "arma" ? ITENS[e.id].nome : e.tipo === "armadura" ? e.it.nome : e.it.titulo;
              // no modo de entrega: o ▶ nos que cabem (irmão do tile — botão dentro de botão não vale), as armas apagadas
              const cabe = entrega ? itemDeEncaixe(e) : null, local = !!cabe && aindaLocal(cabe), apagado = !!entrega && (e.tipo === "arma" || e.tipo === "armadura");
              return (
                <div key={e.key} className="relative">
                  <button type="button" onClick={() => setSel(e.key)} aria-pressed={on} aria-label={nome}
                    className={`tile-inv relative grid aspect-square w-full place-items-center rounded-lg transition-transform ${on ? "scale-[1.04]" : "hover:scale-[1.03]"} ${apagado ? "pointer-events-none opacity-40" : ""}`}
                    style={{ ["--c" as string]: e.cor, borderColor: `${e.cor}${on ? "ee" : "66"}`, boxShadow: on ? `0 0 18px -2px ${e.cor}, inset 0 0 14px -4px ${e.cor}` : undefined }}>
                    {e.tipo === "armadura" ? <IconeArmadura cor={e.it.cor} tam={42} /> : e.tipo === "arma" ? <IconeEspada tam={42} /> : e.tipo === "livro" ? <IconeLivro cor={e.cor} tam={42} /> : <IconePesquisa tam={42} />}
                    {e.tipo === "arma" && inv.equipado === e.id && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_6px_#35ffd0]" title="Equipado" />}
                    {e.tipo === "pesquisa" && <span className="absolute bottom-0.5 right-1 text-[9.5px] font-black tabular-nums text-sky-100/80">{e.it.paginas}p</span>}
                    {e.tipo === "livro" && <span className="absolute bottom-0.5 right-1 text-[9px] font-black text-white/70">{e.it.nivel}</span>}
                    {e.tipo === "pesquisa" && e.nova && <span className="absolute -left-1 -top-1.5 rounded-sm bg-[#ffc46b] px-1 text-[8.5px] font-black uppercase tracking-wider text-[#1a1004] motion-safe:animate-pulse">Novo</span>}
                    {local && <span className="absolute bottom-0.5 left-1 max-w-[70%] truncate text-[8px] font-bold tracking-wide" style={{ color: `${OURO}d9` }}>sincronizando…</span>}
                  </button>
                  {cabe && !local && (
                    <button type="button" aria-label={`Entregar ${cabe.titulo}`} title="Entregar no Relicário"
                      onClick={(ev) => { ev.stopPropagation(); entrega!.onEntregar(cabe); }} disabled={entrega!.enviando === cabe.id}
                      className="absolute -right-1.5 -top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border text-[10px] font-black leading-none transition-transform hover:scale-110 disabled:opacity-50 motion-safe:animate-pulse"
                      style={{ background: OURO, color: OURO_TEXTO, borderColor: OURO_BORDA, boxShadow: `0 0 10px 2px ${OURO}8c, 0 0 22px -2px ${OURO}` }}>
                      <span className="translate-x-[1px]">▶</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {!entradas.length && livros !== null && <p className="mt-3 text-[11.5px] text-sky-100/45">A mochila está vazia. O que você criar no laboratório vira item aqui.</p>}
          </>}
        </div>

        {/* o INSPETOR */}
        <section className="flex min-h-0 flex-col overflow-y-auto rounded-xl border p-3" style={{ borderColor: aba === "carteira" ? `${moedaAtual?.cor ?? "#ffffff"}44` : atual ? `${atual.cor}44` : "#ffffff1a", background: "linear-gradient(180deg,rgba(255,255,255,.03),rgba(0,0,0,.2))" }}>
          {aba === "carteira" ? (moedaAtual ? <InspetorMoeda m={moedaAtual} endereco={enderecoDa(moedaAtual.id)} /> : <p className="text-xs text-white/40">Conecte uma carteira ou estude pra ganhar AURA.</p>) : !atual ? <p className="text-xs text-white/40">Escolha um item.</p> : atual.tipo === "pesquisa" ? (
            <>
              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: atual.cor }}>Pesquisa · {NOME_RARIDADE.comum}</div>
              <h3 className="mt-0.5 text-[16px] font-black leading-snug">{atual.it.titulo}</h3>
              <div className="my-2 rounded-lg border border-sky-300/15 bg-[radial-gradient(ellipse_at_50%_70%,rgba(127,232,255,.12),transparent_70%)]">
                <LivroHolograma titulo={atual.it.titulo} paginas={atual.it.paginas} cor={atual.cor} altura={210} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Páginas</dt><dd className="text-sm font-black tabular-nums">{atual.it.paginas}</dd></div>
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Palavras</dt><dd className="text-sm font-black tabular-nums">{atual.it.palavras}</dd></div>
              </dl>
              <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/[0.07] px-2.5 py-2 text-[11.5px] leading-snug text-amber-100/90">⚠ {VALOR_PESQUISA_SEM_BASE}. Junte estudos de base pra ela ganhar valor.</p>
              {entrega && <BotaoEntregar it={{ tipo: "pesquisa", id: atual.it.id, titulo: atual.it.titulo }} encaixe={entrega} />}
            </>
          ) : atual.tipo === "livro" ? (
            <>
              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: atual.cor }}>Livro de estudo · {NOME_RARIDADE[atual.it.raridade]}</div>
              <h3 className="mt-0.5 text-[16px] font-black leading-snug">{atual.it.titulo}</h3>
              <div className="my-2 rounded-lg border border-white/10"><LivroHolograma titulo={atual.it.titulo} paginas={Math.max(1, atual.it.componentes + atual.it.fontes)} cor={atual.cor} altura={190} /></div>
              <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${atual.it.nivel}%`, background: atual.cor }} /></div>
              <p className="mt-1.5 text-[11px] text-white/60">Nível {atual.it.nivel}{atual.it.vendavel ? " · vendável" : ""}. {atual.it.proxima ? `Evolui pra ${NOME_RARIDADE[atual.it.proxima.raridade]} com mais ${atual.it.proxima.faltam} pontos.` : "Já é lendário."}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Componentes</dt><dd className="text-sm font-black">{atual.it.componentes}</dd></div>
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Fontes</dt><dd className="text-sm font-black">{atual.it.fontes}</dd></div>
              </dl>
              {entrega && <BotaoEntregar it={{ tipo: "livro", id: atual.it.id, titulo: atual.it.titulo }} encaixe={entrega} />}
              <a href={`/research-lab?tab=sala-de-estudos&board=${atual.it.boardId}`} className="mt-3 flex min-h-[40px] w-full items-center justify-center rounded-full bg-gradient-to-b from-sky-200 to-sky-400 text-xs font-black uppercase tracking-widest text-slate-950">Abrir o estudo no board</a>
            </>
          ) : atual.tipo === "armadura" ? (
            <>
              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: atual.cor }}>Armadura · {NOME_RARIDADE[atual.it.raridade]}</div>
              <h3 className="mt-0.5 text-[16px] font-black">{atual.it.nome}</h3>
              <div className="my-3 grid place-items-center rounded-lg border bg-black/30 py-4" style={{ borderColor: `${atual.it.cor}44`, background: `radial-gradient(circle at 50% 45%, ${atual.it.cor}26, transparent 65%)` }}><IconeArmadura cor={atual.it.cor} tam={110} /></div>
              <p className="text-xs leading-relaxed text-white/70">{atual.it.descricao}</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-[11.5px]"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_6px_#35ffd0]" /> Vestindo agora — é o que aparece no personagem ao lado.</div>
              {entrega && <p className="mt-2 text-center text-[11.5px] text-white/40">Armaduras não cabem no Relicário.</p>}
            </>
          ) : (() => {
            const item = ITENS[atual.id], equipado = inv.equipado === atual.id;
            return (
              <>
                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: atual.cor }}>Arma · {NOME_RARIDADE[item.raridade]} · Nível {item.nivel}</div>
                <h3 className="mt-0.5 text-[16px] font-black">{item.nome}</h3>
                <div className="my-3 grid place-items-center rounded-lg border border-emerald-300/20 bg-black/30 py-4"><IconeEspada tam={110} /></div>
                <p className="text-xs leading-relaxed text-white/70">{item.descricao}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Dano</dt><dd className="text-sm font-black">{COMBO.map((g) => danoDoGolpe(item.id, g)).join(" · ")}</dd></div>
                  <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Alcance</dt><dd className="text-sm font-black">{item.arma.alcance.toFixed(1)} m</dd></div>
                  <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Combo</dt><dd className="text-sm font-black">{COMBO.length} golpes</dd></div>
                </dl>
                <button type="button" onClick={() => { const r = equipar(equipado ? null : item.id); if (r) setInv(r); }}
                  className={`mt-3 min-h-[40px] w-full rounded-full text-xs font-black uppercase tracking-widest ${equipado ? "border border-white/20 text-white/80" : "bg-gradient-to-b from-emerald-200 to-emerald-400 text-slate-950"}`}>
                  {equipado ? "Desequipar" : "Equipar"}
                </button>
                {entrega && <p className="mt-2 text-center text-[11.5px] text-white/40">Armas não cabem no Relicário.</p>}
                {entrega?.erro && <p role="alert" className="mt-1.5 text-center text-[12px] leading-snug text-rose-300">{entrega.erro}</p>}
              </>
            );
          })()}
        </section>
      </div>
      </div>
    </div>
  );
}
