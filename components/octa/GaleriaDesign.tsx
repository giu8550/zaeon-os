"use client";
/**
 * GaleriaDesign — a galeria de estilos da landing (biblioteca DESIGN.md, VoltAgent/awesome-design-md, MIT).
 *   - um cartão por estilo de GET /api/octa/design; clicar = usar o estilo (PATCH /api/octa/projetos/<id> { designId },
 *     e o servidor grava o DESIGN.md no projeto — o mesmo que a tool octa_design_escolher faz);
 *   - passar o mouse/focar num cartão mostra a PRÉVIA daquele estilo: o HTML de /api/octa/design/<id>/previa
 *     (renderPagina com seções de exemplo fixas e os tokens do estilo, sem o nome da marca) num
 *     `<iframe sandbox="" srcDoc>` — sem scripts, sem acesso à página da IDE.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Moon, Search, Sun } from "lucide-react";

export type EstiloResumo = { id: string; nome: string; resumo: string; clima: string[]; escuro: boolean };

const Z = { bg: "#282c33", painel: "#2f343e", borda: "#363c46", texto: "#dce0e5", fraco: "#a9afbc", apagado: "#878a98", acento: "#74ade8", ok: "#a1c181", erro: "#d07277", sel: "#3b414d" };
const CLIMAS = ["escuro", "claro", "minimalista", "ousado", "luxuoso", "divertido", "corporativo", "tecnico"] as const;
const ROTULO_CLIMA: Record<string, string> = { tecnico: "técnico" };
export const CREDITO_ESTILOS = "Estilos: VoltAgent/awesome-design-md (MIT)";

export default function GaleriaDesign({ projetoId, designId, onEscolhido, antesDeEscolher, bloqueado }: {
  projetoId: string;
  /** O Octa está escrevendo no projeto agora: dá pra ver as prévias, mas não trocar o estilo. */
  bloqueado?: boolean;
  designId: string | null;
  /** O projeto como o PATCH devolveu (já com o DESIGN.md novo nos arquivos). */
  onEscolhido?: (projeto: any) => void;
  /** Ex.: salvar as edições pendentes antes, pra não sobrescrever o DESIGN.md que o servidor vai gravar. */
  antesDeEscolher?: () => Promise<void>;
}) {
  const [estilos, setEstilos] = useState<EstiloResumo[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState<string | null>(null);
  const [previas, setPrevias] = useState<Record<string, string | "erro">>({});
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [erroEscolha, setErroEscolha] = useState<string | null>(null);
  const pedidas = useRef(new Set<string>());
  const atraso = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    fetch("/api/octa/design")
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j) => { if (vivo) setEstilos(Array.isArray(j) ? j : []); })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [tentativa]);

  const emPrevia = foco ?? designId ?? estilos?.[0]?.id ?? null;
  const estiloPrevia = estilos?.find((e) => e.id === emPrevia) ?? null;

  useEffect(() => {
    if (!emPrevia || pedidas.current.has(emPrevia)) return;
    pedidas.current.add(emPrevia);
    fetch(`/api/octa/design/${encodeURIComponent(emPrevia)}/previa`)
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((html) => setPrevias((p) => ({ ...p, [emPrevia]: html })))
      .catch(() => { pedidas.current.delete(emPrevia); setPrevias((p) => ({ ...p, [emPrevia]: "erro" })); });
  }, [emPrevia]);
  useEffect(() => () => { if (atraso.current) clearTimeout(atraso.current); }, []);

  const focar = (id: string) => {
    if (atraso.current) clearTimeout(atraso.current);
    atraso.current = setTimeout(() => setFoco(id), 120); // passar o mouse pela grade não dispara 20 prévias
  };

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (estilos ?? []).filter((e) => (!filtro || e.clima.includes(filtro)) && (!q || e.nome.toLowerCase().includes(q) || e.resumo.toLowerCase().includes(q)));
  }, [estilos, filtro, busca]);

  const escolher = async (id: string) => {
    if (aplicando || bloqueado) return;
    setAplicando(id); setErroEscolha(null);
    try {
      await antesDeEscolher?.();
      const r = await fetch(`/api/octa/projetos/${encodeURIComponent(projetoId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.projeto) throw new Error(String(r.status));
      onEscolhido?.(j.projeto);
    } catch {
      setErroEscolha("Não deu pra aplicar o estilo agora. Tente de novo.");
    } finally { setAplicando(null); }
  };

  const html = emPrevia ? previas[emPrevia] : undefined;

  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: Z.bg, color: Z.texto }}>
      {/* prévia do estilo em foco */}
      <div className="shrink-0 p-3 pb-0">
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${Z.borda}`, background: Z.painel }}>
          <div className="h-9 flex items-center gap-2 px-3 text-[12px]" style={{ borderBottom: `1px solid ${Z.borda}` }}>
            <span className="flex gap-1">{["#d07277", "#dec184", "#a1c181"].map((c) => <i key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}</span>
            <span className="ml-2" style={{ color: Z.fraco }}>Prévia</span>
            <span className="font-semibold truncate">{estiloPrevia?.nome ?? "—"}</span>
            {estiloPrevia && designId === estiloPrevia.id && <span className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: "#a1c18122", color: Z.ok }}>em uso</span>}
            {estiloPrevia && designId !== estiloPrevia.id && !bloqueado && (
              <button type="button" onClick={() => void escolher(estiloPrevia.id)} disabled={!!aplicando}
                className="ml-auto h-6 px-2.5 rounded-md text-[11.5px] font-medium disabled:opacity-50" style={{ background: Z.acento, color: "#1b1e24" }}>
                {aplicando === estiloPrevia.id ? "Aplicando…" : "Usar este estilo"}
              </button>
            )}
          </div>
          <div className="relative h-[clamp(180px,38vh,420px)] bg-white">
            {estiloPrevia && typeof html === "string" && html !== "erro" ? (
              <iframe key={estiloPrevia.id} title={`Prévia do estilo ${estiloPrevia.nome}`} sandbox="" srcDoc={html} className="absolute inset-0 w-full h-full border-0" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[12px]" style={{ background: Z.bg, color: Z.apagado }}>
                {html === "erro" ? "Não deu pra montar a prévia deste estilo." : estiloPrevia ? <Loader2 className="w-4 h-4 animate-spin" /> : "Escolha um estilo abaixo."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* filtros */}
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-3 pt-3 pb-2 text-[11.5px]">
        <label className="flex items-center gap-1.5 h-7 px-2 rounded-md mr-1" style={{ border: `1px solid ${Z.borda}`, background: Z.painel }}>
          <Search className="w-3.5 h-3.5" style={{ color: Z.apagado }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar estilo" aria-label="Buscar estilo"
            className="w-28 bg-transparent outline-none placeholder:text-[#5d636f]" style={{ color: Z.texto }} />
        </label>
        {[null, ...CLIMAS].map((c) => (
          <button key={c ?? "todos"} type="button" onClick={() => setFiltro(c)} aria-pressed={filtro === c}
            className="h-7 px-2.5 rounded-full" style={{ background: filtro === c ? Z.sel : "transparent", color: filtro === c ? Z.texto : Z.fraco, border: `1px solid ${Z.borda}` }}>
            {c ? ROTULO_CLIMA[c] ?? c : "todos"}
          </button>
        ))}
        {erroEscolha && <span role="alert" className="ml-2" style={{ color: Z.erro }}>{erroEscolha}</span>}
        {bloqueado && <span className="ml-2" style={{ color: "#dec184" }}>o Octa está editando: troque o estilo quando ele terminar</span>}
      </div>

      {/* grade */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {falhou ? (
          <div className="py-8 text-center text-[12.5px]" style={{ color: Z.fraco }}>
            Não deu pra carregar os estilos. <button type="button" className="underline" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button>
          </div>
        ) : !estilos ? (
          <div className="py-8 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin" style={{ color: Z.acento }} /></div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
            {visiveis.map((e) => {
              const emUso = designId === e.id;
              return (
                <button key={e.id} type="button" aria-pressed={emUso} aria-label={`Usar o estilo ${e.nome}`}
                  onClick={() => void escolher(e.id)} onMouseEnter={() => focar(e.id)} onFocus={() => focar(e.id)}
                  className="text-left rounded-lg p-2.5 transition-colors hover:bg-white/[0.04] disabled:opacity-60"
                  disabled={bloqueado || (!!aplicando && aplicando !== e.id)}
                  style={{ border: `1px solid ${emUso ? Z.acento : emPrevia === e.id ? "#4a5160" : Z.borda}`, background: emUso ? "#74ade812" : Z.painel }}>
                  <div className="flex items-center gap-1.5">
                    {e.escuro ? <Moon className="w-3.5 h-3.5 shrink-0" style={{ color: Z.fraco }} /> : <Sun className="w-3.5 h-3.5 shrink-0" style={{ color: Z.fraco }} />}
                    <span className="font-semibold text-[12.5px] truncate">{e.nome}</span>
                    {aplicando === e.id ? <Loader2 className="ml-auto w-3.5 h-3.5 animate-spin" style={{ color: Z.acento }} />
                      : emUso ? <Check className="ml-auto w-3.5 h-3.5" style={{ color: Z.acento }} /> : null}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug line-clamp-2" style={{ color: Z.apagado }}>{e.resumo}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {e.clima.slice(0, 3).map((c) => <span key={c} className="px-1.5 py-[1px] rounded text-[10px]" style={{ background: Z.sel, color: Z.fraco }}>{ROTULO_CLIMA[c] ?? c}</span>)}
                  </div>
                </button>
              );
            })}
            {!visiveis.length && <div className="col-span-full py-6 text-center text-[12px]" style={{ color: Z.apagado }}>Nenhum estilo com esse filtro.</div>}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-2 text-[10.5px]" style={{ borderTop: `1px solid ${Z.borda}`, color: Z.apagado }}>
        <a href="https://github.com/VoltAgent/awesome-design-md" target="_blank" rel="noreferrer" className="hover:underline">{CREDITO_ESTILOS}</a>
        <span> · o nome da marca de origem nunca vai pra sua página.</span>
      </div>
    </div>
  );
}
