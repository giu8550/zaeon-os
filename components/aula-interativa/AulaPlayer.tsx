"use client";

/**
 * AulaPlayer — toca uma AULA interativa (kind "aula"; roteiro em lib/aula-interativa/contrato.ts).
 *
 * O palco do Papermorph, em React: quadro 16:9 escuro, uma cena por beat que se MONTA conforme a
 * narração chega nas `[[marcas]]`, legenda por frase, e as checagens dentro da aula — a aula só
 * segue quando o aluno responde. Teclas como no Papermorph: Espaço toca/pausa, ←/→ beat anterior/
 * próximo, C liga a legenda. Placar no fim: o que acertou de PRIMEIRA (checagens e prática).
 *
 * Relógio: com áudio, o `currentTime` manda; sem áudio (TTS falhou), um relógio interno anda na
 * duração estimada da fala, com a legenda fazendo as vezes da voz.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, ChevronLeft, ChevronRight, Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import "katex/dist/katex.min.css";
import { confereLacuna, type Aula, type Beat, type Cena, type Cor, type Item, type Pergunta, type TempoBeat } from "@/lib/aula-interativa/contrato";
import { legendaEm, momentos, placar, type Placar } from "@/lib/aula-interativa/momentos";
import { temposDoBeat } from "@/lib/aula-interativa/tempo";

const COR: Record<Cor, string> = {
  giz: "#e8edf5", tarefa: "#fbbf24", certo: "#34d399", errado: "#fb7185",
  azul: "#60a5fa", verde: "#4ade80", roxo: "#c084fc", laranja: "#fb923c",
};
const corDe = (c?: Cor, padrao: Cor = "giz") => COR[c ?? padrao];

// ───────────────────────────── LaTeX (KaTeX sob demanda) ─────────────────────────────
let katexP: Promise<any> | null = null;
function Latex({ tex }: { tex: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    katexP ??= import("katex").then((m) => (m as any).default ?? m);
    katexP.then((k) => { if (vivo) setHtml(k.renderToString(tex, { throwOnError: false, output: "html" })); }).catch(() => {});
    return () => { vivo = false; };
  }, [tex]);
  return html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <code>{tex}</code>;
}

// ───────────────────────────── a cena ─────────────────────────────
function Aparece({ ok, children, className = "", style }: { ok: boolean; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`transition-all duration-500 motion-reduce:transition-none ${ok ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[0.6cqw]"} ${className}`} style={style} aria-hidden={!ok}>
      {children}
    </div>
  );
}

function TextoItem({ it }: { it: Item }) {
  return (
    <span>
      {it.texto}
      {it.latex && <span className="ml-[0.8cqw] align-middle"><Latex tex={it.latex} /></span>}
      {it.nota && <span className="block text-[1.5cqw] text-white/55 mt-[0.3cqw]">{it.nota}</span>}
    </span>
  );
}

function CenaView({ cena, ve }: { cena: Cena; ve: (chave: string) => boolean }) {
  const titulo = (t?: string) => t ? <p className="text-[2.6cqw] font-semibold text-white/90 mb-[2cqw]">{t}</p> : null;
  switch (cena.layout) {
    case "titulo":
      return (
        <div className="h-full flex flex-col items-center justify-center text-center px-[6cqw]">
          <Aparece ok={ve("titulo")}>
            {cena.kicker && <p className="text-[1.7cqw] uppercase tracking-[0.2em] text-white/50 mb-[1.2cqw]">{cena.kicker}</p>}
            <p className="text-[5.4cqw] font-semibold leading-tight text-white">{cena.titulo}</p>
          </Aparece>
          {cena.subtitulo && <Aparece ok={ve("sub")}><p className="mt-[2cqw] text-[2.3cqw] text-white/70">{cena.subtitulo}</p></Aparece>}
        </div>
      );
    case "passos":
      return (
        <div className="h-full flex flex-col justify-center px-[7cqw]">
          {titulo(cena.titulo)}
          <ol className="flex flex-col gap-[1.4cqw]">
            {cena.itens.map((it, i) => {
              const dest = cena.destaque?.indice === i && ve("dest");
              return (
                <Aparece key={i} ok={ve(`i${i}`)}>
                  <li className={`flex items-start gap-[1.5cqw] rounded-[1cqw] px-[1.4cqw] py-[0.8cqw] text-[2.3cqw] transition-shadow ${dest ? "ring-[0.25cqw] ring-amber-300/80 bg-amber-300/10" : ""}`} style={{ color: corDe(it.cor) }}>
                    <span className="shrink-0 w-[3cqw] h-[3cqw] rounded-full flex items-center justify-center text-[1.6cqw] font-bold bg-white/10 text-white">{i + 1}</span>
                    <TextoItem it={it} />
                  </li>
                </Aparece>
              );
            })}
          </ol>
        </div>
      );
    case "comparar": {
      const lado = (l: { titulo: string; itens: Item[] }, pre: "e" | "d", cab: string) => (
        <div className="flex-1 rounded-[1.2cqw] border border-white/15 bg-white/[0.04] p-[2cqw]">
          <Aparece ok={ve(cab)}><p className="text-[2.4cqw] font-semibold text-white mb-[1.4cqw]">{l.titulo}</p></Aparece>
          <ul className="flex flex-col gap-[1cqw]">
            {l.itens.map((it, i) => <Aparece key={i} ok={ve(`${pre}${i}`)}><li className="text-[2cqw]" style={{ color: corDe(it.cor) }}>• <TextoItem it={it} /></li></Aparece>)}
          </ul>
        </div>
      );
      return (
        <div className="h-full flex flex-col justify-center px-[5cqw]">
          {titulo(cena.titulo)}
          <div className="flex gap-[3cqw]">{lado(cena.esquerda, "e", "cabE")}{lado(cena.direita, "d", "cabD")}</div>
        </div>
      );
    }
    case "fluxo": {
      const n = cena.nos.length;
      // linha (esquerda→direita) ou ciclo (elipse); posições em % do palco
      const pos = cena.nos.map((_, i) => cena.ciclo
        ? { x: 50 + 33 * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n), y: 56 + 28 * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n) }
        : { x: 10 + (80 * (i + 0.5)) / n, y: 56 });
      const pares = cena.nos.map((_, i) => [i, i + 1] as const).filter(([, j]) => j < n || cena.ciclo).map(([i, j]) => [i, j % n] as const);
      return (
        <div className="relative h-full">
          {cena.titulo && <p className="absolute top-[6%] inset-x-0 text-center text-[2.6cqw] font-semibold text-white/90">{cena.titulo}</p>}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs><marker id="ponta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,0.6)" /></marker></defs>
            {pares.map(([i, j]) => {
              const a = pos[i], b = pos[j];
              const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
              const enc = cena.ciclo ? 9 : Math.min(9, len / 3);
              return (
                <line key={`${i}-${j}`} x1={a.x + (dx / len) * enc} y1={a.y + (dy / len) * enc * 1.6} x2={b.x - (dx / len) * enc} y2={b.y - (dy / len) * enc * 1.6}
                  stroke="rgba(255,255,255,0.55)" strokeWidth="0.35" markerEnd="url(#ponta)" vectorEffect="non-scaling-stroke"
                  className="transition-opacity duration-500" style={{ opacity: ve(`n${j}`) && ve(`n${i}`) ? 1 : 0 }} />
              );
            })}
          </svg>
          {cena.nos.map((it, i) => (
            <Aparece key={i} ok={ve(`n${i}`)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%`, width: `${Math.min(18, 70 / n + 4)}%` }}>
              <div className="rounded-[1cqw] border-[0.18cqw] px-[1cqw] py-[0.9cqw] text-center text-[1.8cqw] font-semibold bg-[#0b1324]" style={{ borderColor: corDe(it.cor, "azul"), color: corDe(it.cor) }}>
                <TextoItem it={it} />
              </div>
            </Aparece>
          ))}
        </div>
      );
    }
    case "formula":
      return (
        <div className="h-full flex flex-col justify-center px-[7cqw]">
          {titulo(cena.titulo)}
          <div className="flex flex-col gap-[1.6cqw]">
            {cena.linhas.map((it, i) => (
              <Aparece key={i} ok={ve(`l${i}`)}>
                <div className="text-[2.6cqw]" style={{ color: corDe(it.cor) }}>
                  {it.latex ? <><Latex tex={it.latex} /><span className="ml-[1.5cqw] text-[1.8cqw] text-white/60">{it.texto}</span></> : it.texto}
                </div>
              </Aparece>
            ))}
            {cena.erro && (
              <Aparece ok={ve("erro")}>
                <div className="text-[2.3cqw] text-rose-300">
                  <span className="relative inline-block">
                    {cena.erro.latex ? <Latex tex={cena.erro.latex} /> : cena.erro.texto}
                    <span aria-hidden className={`absolute left-0 top-1/2 h-[0.25cqw] bg-rose-400 transition-[width] duration-700 ${ve("erro") ? "w-full" : "w-0"}`} />
                  </span>
                  <span className="ml-[1.5cqw] text-[1.7cqw] text-rose-200/80">✗ {cena.erro.porque || cena.erro.texto}</span>
                </div>
              </Aparece>
            )}
          </div>
        </div>
      );
    case "destaque":
      return (
        <div className="h-full flex flex-col items-center justify-center text-center px-[8cqw]">
          <Aparece ok={ve("termo")}><p className="text-[4.6cqw] font-semibold text-amber-300">{cena.termo}</p></Aparece>
          <Aparece ok={ve("def")}><p className="mt-[1.6cqw] text-[2.4cqw] text-white/85 max-w-[70cqw]">{cena.definicao}</p></Aparece>
          <div className="mt-[2.4cqw] flex flex-wrap justify-center gap-[1.2cqw]">
            {(cena.fatos ?? []).map((it, i) => (
              <Aparece key={i} ok={ve(`f${i}`)}><span className="inline-block rounded-full border border-white/20 px-[1.6cqw] py-[0.6cqw] text-[1.8cqw]" style={{ color: corDe(it.cor) }}><TextoItem it={it} /></span></Aparece>
            ))}
          </div>
        </div>
      );
    case "resumo":
      return (
        <div className="h-full flex flex-col justify-center px-[8cqw] gap-[1.8cqw]">
          <p className="text-[1.7cqw] uppercase tracking-[0.2em] text-white/50">Pra levar</p>
          {cena.itens.map((it, i) => (
            <Aparece key={i} ok={ve(`r${i}`)}>
              <div className="flex items-center gap-[1.6cqw] text-[2.5cqw] font-semibold text-white">
                <span className="shrink-0 w-[3.4cqw] h-[3.4cqw] rounded-full flex items-center justify-center bg-amber-300 text-[#0b1324] text-[1.8cqw] font-bold">{i + 1}</span>
                <TextoItem it={it} />
              </div>
            </Aparece>
          ))}
        </div>
      );
  }
}

// ───────────────────────────── perguntas ─────────────────────────────
type Nota = (id: string, certas: number, total: number) => void;

function CartaoPergunta({ p, rotulo, onNota, onContinuar }: { p: Pergunta; rotulo: string; onNota: Nota; onContinuar: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [resolvida, setResolvida] = useState(false);
  const [primeira, setPrimeira] = useState(true);
  const [errou, setErrou] = useState(false);
  const [desativadas, setDesativadas] = useState<number[]>([]);
  const [valor, setValor] = useState("");
  const [vf, setVf] = useState<Record<number, boolean | null>>({});
  const continuarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (resolvida) continuarRef.current?.focus({ preventScroll: true }); }, [resolvida]);

  const nota = (ok: boolean, texto: string, score?: { certas: number; total: number }) => {
    if (primeira) { onNota(p.id, score?.certas ?? +ok, score?.total ?? 1); setPrimeira(false); }
    setMsg({ ok, texto });
    if (ok) setResolvida(true); else setErrou(true);
  };
  const mostrar = () => {
    if (p.tipo === "escolha") setMsg({ ok: true, texto: `Resposta: ${p.opcoes[p.correta]}. ${p.porque}` });
    if (p.tipo === "lacuna") setMsg({ ok: true, texto: `Resposta: ${p.aceitas[0]}. ${p.porque}` });
    if (p.tipo === "vf") setMsg({ ok: true, texto: p.afirmacoes.map((a) => `${a.verdadeira ? "V" : "F"} — ${a.porque}`).join("  ·  ") });
    if (primeira) { onNota(p.id, 0, p.tipo === "vf" ? p.afirmacoes.length : 1); setPrimeira(false); }
    setResolvida(true);
  };

  return (
    <div className="rounded-2xl border border-amber-300/40 bg-[#0b1324] p-4 text-white" role="group" aria-label={rotulo}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/90">{rotulo}</p>
      <p className="mt-1 text-[16px] font-semibold leading-snug">{p.enunciado}</p>

      {p.tipo === "escolha" && (
        <div className="mt-3 flex flex-col gap-2">
          {p.opcoes.map((o, i) => (
            <button key={i} type="button" disabled={resolvida || desativadas.includes(i)}
              onClick={() => {
                if (i === p.correta) nota(true, p.porque);
                else { setDesativadas((d) => [...d, i]); nota(false, p.porqueErrado?.[i] || "Ainda não. Releia a cena e tente de novo."); }
              }}
              className={`text-left rounded-xl border px-3 py-2 text-[14px] transition-colors disabled:cursor-default ${
                resolvida && i === p.correta ? "border-emerald-400 bg-emerald-400/15" : desativadas.includes(i) ? "border-rose-400/50 bg-rose-400/10 opacity-70" : "border-white/15 hover:border-amber-300/60 hover:bg-white/5"
              }`}>
              <kbd className="mr-2 rounded bg-white/10 px-1.5 text-[11px]">{i + 1}</kbd>{o}
            </button>
          ))}
        </div>
      )}

      {p.tipo === "vf" && (
        <div className="mt-3 flex flex-col gap-2">
          {p.afirmacoes.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[14px]">
              <span className="flex-1">{a.texto}</span>
              {([true, false] as const).map((v) => (
                <button key={String(v)} type="button" disabled={resolvida} aria-pressed={vf[i] === v}
                  onClick={() => setVf((x) => ({ ...x, [i]: v }))}
                  className={`w-9 h-8 rounded-lg border text-[13px] font-bold ${vf[i] === v ? "border-amber-300 bg-amber-300/20" : "border-white/15 hover:bg-white/5"}`}>{v ? "V" : "F"}</button>
              ))}
            </div>
          ))}
          {!resolvida && (
            <button type="button" disabled={p.afirmacoes.some((_, i) => vf[i] == null)}
              onClick={() => {
                const certas = p.afirmacoes.filter((a, i) => vf[i] === a.verdadeira).length;
                const ok = certas === p.afirmacoes.length;
                nota(ok, ok ? "Todas certas." : `${certas} de ${p.afirmacoes.length}. ${p.afirmacoes.filter((a, i) => vf[i] !== a.verdadeira).map((a) => a.porque).join(" ")}`, { certas, total: p.afirmacoes.length });
              }}
              className="self-start mt-1 rounded-full bg-amber-300 px-4 py-1.5 text-[13px] font-bold text-[#0b1324] disabled:opacity-40">Conferir</button>
          )}
        </div>
      )}

      {p.tipo === "lacuna" && (
        <form className="mt-3 flex flex-wrap items-center gap-2 text-[15px]" onSubmit={(e) => {
          e.preventDefault();
          if (resolvida || !valor.trim()) return;
          if (confereLacuna(valor, p.aceitas)) nota(true, p.porque);
          else nota(false, p.dica || "Ainda não. Pense no que a cena mostrou.");
        }}>
          {p.antes && <span>{p.antes}</span>}
          <input value={valor} onChange={(e) => setValor(e.target.value)} disabled={resolvida} aria-label="Sua resposta"
            className="w-40 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-white outline-none focus:border-amber-300" />
          {p.depois && <span>{p.depois}</span>}
          {!resolvida && <button type="submit" className="rounded-full bg-amber-300 px-4 py-1.5 text-[13px] font-bold text-[#0b1324]">Conferir</button>}
        </form>
      )}

      {msg && <p role="status" className={`mt-3 text-[14px] ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.ok ? "✓ " : "✗ "}{msg.texto}</p>}
      <div className="mt-3 flex gap-2">
        {errou && !resolvida && <button type="button" onClick={mostrar} className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/5">Mostrar resposta</button>}
        {resolvida && <button ref={continuarRef} type="button" onClick={onContinuar} className="rounded-full bg-emerald-400 px-4 py-1.5 text-[13px] font-bold text-[#0b1324]">Continuar</button>}
      </div>
    </div>
  );
}

// ───────────────────────────── o player ─────────────────────────────
export default function AulaPlayer({ aula, tempos, audioDe, onTelaCheia, grande = false }: {
  aula: Aula;
  tempos: Record<string, TempoBeat>;
  /** URL da narração do beat (ou null: toca no relógio estimado, com legenda). */
  audioDe: (beat: Beat) => string | null;
  onTelaCheia?: () => void;
  grande?: boolean;
}) {
  const beats = aula.beats;
  const [indice, setIndice] = useState(0);
  const [t, setT] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [comecou, setComecou] = useState(false);
  const [perguntando, setPerguntando] = useState(false);
  const [legenda, setLegenda] = useState(true);
  const [respostas, setRespostas] = useState<Record<string, Placar>>({});
  // beat cujo áudio falhou (404, rede): toca no relógio estimado, com legenda
  const [semAudio, setSemAudio] = useState<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const beat = beats[indice];
  const tempo = useMemo(() => tempos[beat.id] ?? temposDoBeat(beat.narracao), [tempos, beat]);
  const quando = useMemo(() => momentos(beat.cena, tempo), [beat, tempo]);
  const fimDaFala = t >= tempo.duracao - 0.05;
  const src = semAudio[beat.id] ? null : audioDe(beat);

  const irPara = useCallback((i: number, tocar = true) => {
    const k = Math.max(0, Math.min(beats.length - 1, i));
    setIndice(k); setT(0); setPerguntando(false); setTocando(tocar);
  }, [beats.length]);

  // relógio: áudio manda; sem áudio, um rAF anda na duração estimada
  useEffect(() => {
    const a = audioRef.current;
    if (src && a) {
      if (tocando) a.play().catch(() => setTocando(false)); else a.pause();
      return;
    }
    if (!tocando) return;
    // Só o carimbo do próprio rAF (um relógio só), e passo limitado: aba em segundo plano não
    // "pula" a aula inteira quando volta.
    let ultimo: number | null = null, raf = 0;
    const passo = (agora: number) => {
      const dt = ultimo === null ? 0 : Math.min(0.25, Math.max(0, (agora - ultimo) / 1000));
      ultimo = agora;
      if (dt) setT((x) => Math.min(tempo.duracao, x + dt));
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [tocando, src, tempo.duracao, indice]);

  // fim da fala: pergunta → para e pergunta; senão → próximo beat (o fim fica no placar)
  useEffect(() => {
    if (!comecou || !fimDaFala || perguntando) return;
    if (beat.pergunta) { setPerguntando(true); setTocando(false); return; }
    if (beat.tipo === "fim" || indice >= beats.length - 1) { setTocando(false); return; }
    if (!tocando) return;
    const id = setTimeout(() => irPara(indice + 1), 700);
    return () => clearTimeout(id);
  }, [fimDaFala, beat, indice, beats.length, tocando, comecou, perguntando, irPara]);

  const alternar = () => {
    if (!comecou) { setComecou(true); setTocando(true); return; }
    if (perguntando) return;
    if (fimDaFala && beat.tipo === "fim") { setRespostas({}); irPara(0); return; }
    setTocando((v) => !v);
  };
  const tecla = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === " ") { e.preventDefault(); alternar(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); if (!perguntando) irPara(indice + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); irPara(indice - 1); }
    else if (e.key === "c" || e.key === "C") setLegenda((v) => !v);
    else if (/^[1-5]$/.test(e.key) && perguntando) (raizRef.current?.querySelectorAll<HTMLButtonElement>("[role=group] button:not([disabled])")[+e.key - 1])?.click();
  };

  const ve = (chave: string) => !comecou ? chave === "titulo" || chave === "termo" : (quando[chave] ?? 0) <= t + 0.01 || (fimDaFala && !tocando);
  const checagens = placar(respostas, "c-");
  const pratica = placar(respostas, "p-");
  const numPratica = beats.filter((b) => b.tipo === "pratica").findIndex((b) => b.id === beat.id) + 1;
  const totalPratica = beats.filter((b) => b.tipo === "pratica").length;

  return (
    <div ref={raizRef} tabIndex={0} onKeyDown={tecla} data-beat={beat.id} data-t={t.toFixed(1)} className="outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 rounded-2xl bg-[#070d1a] p-2" aria-label={`Aula: ${aula.titulo}`}>
      <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-[#0b1324] text-white select-none" style={{ containerType: "inline-size" }}>
        {/* textura de quadro */}
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, #fff 0, transparent 40%), radial-gradient(circle at 80% 90%, #60a5fa 0, transparent 45%)" }} />
        <div className="absolute inset-0">
          {beat.tipo === "fim" ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-[1.4cqw] px-[6cqw]">
              <p className="text-[1.7cqw] uppercase tracking-[0.2em] text-white/50">Aula concluída</p>
              <p className="text-[4cqw] font-semibold">{aula.titulo}</p>
              <p className="text-[2.2cqw] text-white/80">Checagens: {checagens.total ? `${checagens.certas} de ${checagens.total} de primeira` : "não respondidas"}</p>
              <p className="text-[2.2cqw] text-white/80">Prática: {pratica.total ? `${pratica.certas} de ${pratica.total} de primeira` : "não respondida"}</p>
            </div>
          ) : beat.cena ? <CenaView cena={beat.cena} ve={ve} /> : (
            <div className="h-full flex items-center justify-center px-[8cqw] text-center">
              <p className="text-[3cqw] font-semibold text-amber-300/90">{beat.tipo === "pratica" ? `Prática da aula · ${numPratica} de ${totalPratica}` : beat.tipo === "checagem" ? "Checagem rápida" : beat.titulo}</p>
            </div>
          )}
        </div>
        {comecou && legenda && !perguntando && legendaEm(tempo, t) && (
          <p className="absolute bottom-[3%] inset-x-[8%] text-center text-[1.75cqw] leading-snug text-white bg-black/55 rounded-[0.8cqw] px-[1.2cqw] py-[0.5cqw]">{legendaEm(tempo, t)}</p>
        )}
        {!comecou && (
          <button type="button" onClick={alternar} className="absolute inset-0 flex flex-col items-center justify-end pb-[8%] gap-[1cqw] bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-label="Começar a aula">
            <span className="w-[8cqw] h-[8cqw] rounded-full bg-amber-300 text-[#0b1324] flex items-center justify-center shadow-xl"><Play className="w-[3.4cqw] h-[3.4cqw] ml-[0.4cqw]" /></span>
            <span className="text-[1.8cqw] font-semibold text-white">Começar a aula · {beats.length - 1} partes</span>
          </button>
        )}
      </div>

      {src && <audio ref={audioRef} key={`${indice}-${src}`} src={src} preload="auto"
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onEnded={() => setT(tempo.duracao)}
        onError={() => setSemAudio((x) => ({ ...x, [beat.id]: true }))} />}

      {perguntando && beat.pergunta && (
        <div className="mt-3">
          <CartaoPergunta key={beat.id} p={beat.pergunta}
            rotulo={beat.tipo === "pratica" ? `Prática da aula · ${numPratica} de ${totalPratica}` : "Checagem rápida"}
            onNota={(id, certas, total) => setRespostas((r) => (r[id] ? r : { ...r, [id]: { certas, total } }))}
            onContinuar={() => irPara(indice + 1)} />
        </div>
      )}

      <div className="mt-2 px-1 flex items-center gap-1.5 text-white/80">
        <button type="button" onClick={() => irPara(indice - 1)} disabled={indice === 0} aria-label="Parte anterior" title="Parte anterior (←)" className={BTN}><ChevronLeft size={16} /></button>
        <button type="button" onClick={alternar} disabled={perguntando} aria-label={tocando ? "Pausar" : beat.tipo === "fim" && fimDaFala ? "Ver de novo" : "Tocar"} title="Tocar/pausar (Espaço)" className={BTN}>
          {beat.tipo === "fim" && fimDaFala && comecou ? <RotateCcw size={15} /> : tocando ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button type="button" onClick={() => irPara(indice + 1)} disabled={perguntando || indice >= beats.length - 1} aria-label="Próxima parte" title="Próxima parte (→)" className={BTN}><ChevronRight size={16} /></button>
        <div className="flex-1 flex items-center gap-1 mx-1" aria-label={`Parte ${indice + 1} de ${beats.length}`}>
          {beats.map((b, i) => (
            <button key={b.id} type="button" onClick={() => irPara(i)} title={b.titulo} aria-label={`Ir para: ${b.titulo}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i < indice ? "bg-amber-300/70" : i === indice ? "bg-amber-300" : b.pergunta ? "bg-white/25" : "bg-white/12"}`} />
          ))}
        </div>
        <span className="text-[11px] tabular-nums text-white/55 min-w-[4.5rem] text-right">{beat.titulo}</span>
        <button type="button" onClick={() => setLegenda((v) => !v)} aria-pressed={legenda} aria-label="Legenda" title="Legenda (C)" className={`${BTN} ${legenda ? "text-amber-300" : ""}`}><Captions size={15} /></button>
        {onTelaCheia && !grande && <button type="button" onClick={onTelaCheia} aria-label="Tela cheia" title="Tela cheia" className={BTN}><Maximize2 size={14} /></button>}
      </div>
    </div>
  );
}

const BTN = "w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors";
