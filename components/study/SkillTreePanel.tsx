"use client";

/**
 * SkillTreePanel — a ÁRVORE DE HABILIDADES GENERATIVA de um tópico (React Flow).
 *
 * Opt-in na Sala de Estudos (drawer ao lado da conversa). A árvore nasce do tópico via
 * POST /api/skilltree (cache por tópico); o progresso vem por usuário (GET /api/skilltree/progress).
 * Nós desenhados por ramo (cor) e nível (camadas); desbloqueados acendem no gradiente
 * #8b5cf6→#22d3ee, travados ficam foscos. Clicar num nó mostra o resumo e manda a conversa
 * pro chat scopada naquele nó (`onNodeChat`). "Entendi" marca maestria manual e desbloqueia.
 * Estados: gerando ("montando sua árvore…"), pronto, degradado (trilha linear como lista).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";
import { Lock, Check, Sparkles, MessageSquare, RefreshCw, X, GitBranch, Loader2, Maximize2, Minimize2 } from "lucide-react";
import type { SkillBranch, SkillNodeState } from "@/lib/skilltree/types";

export type SkillTreeData = { topicSlug: string; topicLabel: string; degraded: boolean; nodes: SkillNodeState[] };

type Props = {
  topic: string | null;                  // tópico inicial (título do estudo focado)
  focusNodeId?: string | null;
  refreshKey?: number;                   // bump → refetch do progresso (a maestria muda no chat)
  onTree?: (t: SkillTreeData | null) => void;
  onNodeChat: (node: SkillNodeState, tree: SkillTreeData) => void;
  onClose?: () => void;
  /** a árvore ocupando o chat inteiro (true) ou a gaveta de 460 px (false) */
  expandida?: boolean;
  onExpandir?: (v: boolean) => void;
};

const BRANCH_LABEL: Record<SkillBranch, string> = { teoria: "Teoria", experimental: "Experimental", pratica: "Prática" };
const BRANCH_COLOR: Record<SkillBranch, string> = { teoria: "#8b5cf6", experimental: "#22d3ee", pratica: "#f59e0b" };

// ───────────────────────────── nó customizado ─────────────────────────────
type NodeData = { node: SkillNodeState; selected: boolean };

function SkillNodeCard({ data }: NodeProps<NodeData>) {
  const { node, selected } = data;
  const lit = node.status !== "locked";
  const color = BRANCH_COLOR[node.branch];
  return (
    <div
      className={`relative w-[170px] rounded-2xl p-[1.5px] transition-transform ${selected ? "scale-[1.04]" : ""}`}
      style={{
        background: lit ? "linear-gradient(135deg,#8b5cf6,#22d3ee)" : "rgba(148,163,184,0.35)",
        boxShadow: lit ? `0 10px 28px -14px ${color}` : "none",
        opacity: lit ? 1 : 0.55,
        filter: lit ? "none" : "saturate(0.3)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-2 !h-2" />
      <div className="rounded-[15px] bg-white/95 dark:bg-[#0b1020]/95 backdrop-blur-xl px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[9.5px] font-black uppercase tracking-[0.14em] font-tech" style={{ color }}>{BRANCH_LABEL[node.branch]}</span>
          <span className="ml-auto text-slate-400 dark:text-white/40">
            {node.status === "mastered" ? <Check size={12} className="text-emerald-500" /> : node.status === "locked" ? <Lock size={11} /> : <Sparkles size={11} className="text-cyan-500" />}
          </span>
        </div>
        <div className="text-[12.5px] font-semibold leading-tight text-slate-800 dark:text-white/90 font-tech">{node.title}</div>
        <div className="mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.round(node.mastery * 100)}%`, background: "linear-gradient(90deg,#8b5cf6,#22d3ee)" }} />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-2 !h-2" />
    </div>
  );
}
const NODE_TYPES = { skill: SkillNodeCard };

const NO_W = 170, NO_H = 70;

/**
 * O enquadramento INICIAL da árvore calculado sem depender da medição do React Flow (o `fitView` só roda depois que
 * os nós são medidos — quando isso não acontecia, a árvore ficava presa no canto, metade fora da tela, e "não
 * expandia"). Os nós do layout ficam centrados em x=0: aqui se centraliza na largura e escala pra caber.
 */
export function enquadrar(nodes: Node[], largura: number, altura: number): { x: number; y: number; zoom: number } {
  if (!nodes.length || largura <= 0) return { x: Math.max(0, largura / 2 - NO_W / 2), y: 24, zoom: 1 };
  const xs = nodes.map((n) => n.position.x), ys = nodes.map((n) => n.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + NO_W, minY = Math.min(...ys), maxY = Math.max(...ys) + NO_H;
  const pad = 32;
  const zoom = Math.max(0.3, Math.min(1.2, (largura - 2 * pad) / (maxX - minX), altura > 0 ? (altura - 2 * pad) / (maxY - minY) : 1.2));
  return { x: largura / 2 - ((minX + maxX) / 2) * zoom, y: pad - minY * zoom, zoom };
}

/** Layout simples por camadas: y = nível, x = posição dentro da camada (centralizado). */
export function layoutByLevel(nodes: SkillNodeState[], selectedId: string | null): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const byLevel = new Map<number, SkillNodeState[]>();
  for (const n of nodes) byLevel.set(n.level, [...(byLevel.get(n.level) ?? []), n]);
  const W = 200, H = 150;
  const out: Node<NodeData>[] = [];
  for (const [level, list] of byLevel) {
    list.forEach((n, i) => {
      out.push({
        id: n.id,
        type: "skill",
        position: { x: (i - (list.length - 1) / 2) * W, y: (level - 1) * H },
        data: { node: n, selected: n.id === selectedId },
        draggable: false,
      });
    });
  }
  const status = new Map(nodes.map((n) => [n.id, n.status]));
  const edges: Edge[] = [];
  for (const n of nodes) for (const p of n.prereqs) {
    const lit = status.get(p) === "mastered";
    edges.push({
      id: `${p}->${n.id}`,
      source: p,
      target: n.id,
      type: "smoothstep",
      animated: lit && n.status !== "mastered",
      style: { stroke: lit ? "#22d3ee" : "rgba(148,163,184,0.45)", strokeWidth: lit ? 2 : 1.2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: lit ? "#22d3ee" : "rgba(148,163,184,0.6)" },
    });
  }
  return { nodes: out, edges };
}

// ───────────────────────────── painel ─────────────────────────────
export default function SkillTreePanel({ topic, focusNodeId, refreshKey = 0, onTree, onNodeChat, onClose, expandida = false, onExpandir }: Props) {
  // o tamanho da área do grafo (pro enquadramento inicial e pra reenquadrar ao expandir/recolher)
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const medir = () => { const r = el.getBoundingClientRect(); setArea({ w: Math.round(r.width), h: Math.round(r.height) }); };
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const [topicInput, setTopicInput] = useState(topic ?? "");
  const [tree, setTree] = useState<SkillTreeData | null>(null);
  const [phase, setPhase] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [selectedId, setSelectedId] = useState<string | null>(focusNodeId ?? null);
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastTopic = useRef<string | null>(null);

  const emit = useCallback((t: SkillTreeData | null) => { setTree(t); onTree?.(t); }, [onTree]);

  const generate = useCallback(async (t: string) => {
    const clean = t.trim();
    if (clean.length < 2) return;
    lastTopic.current = clean;
    setPhase("generating");
    try {
      const r = await fetch("/api/skilltree", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: clean }) });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as SkillTreeData;
      emit(data);
      setSelectedId(null);
      setPhase("ready");
    } catch {
      emit(null);
      setPhase("error");
    }
  }, [emit]);

  // tópico inicial (estudo focado) → gera/carrega uma vez; troca de tópico → nova árvore
  useEffect(() => {
    if (topic && topic !== lastTopic.current) { setTopicInput(topic); void generate(topic); }
  }, [topic, generate]);

  // progresso muda no chat (o mentor sobe a maestria) → refetch
  useEffect(() => {
    if (!tree || refreshKey === 0) return;
    (async () => {
      try {
        const r = await fetch(`/api/skilltree/progress?topic=${encodeURIComponent(tree.topicSlug)}`, { cache: "no-store" });
        if (r.ok) { const d = await r.json(); emit({ ...tree, nodes: d.nodes }); }
      } catch { /* best-effort */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => { if (focusNodeId) setSelectedId(focusNodeId); }, [focusNodeId]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);

  const selected = useMemo(() => tree?.nodes.find((n) => n.id === selectedId) ?? null, [tree, selectedId]);
  const graph = useMemo(() => (tree ? layoutByLevel(tree.nodes, selectedId) : { nodes: [], edges: [] }), [tree, selectedId]);
  const done = tree ? tree.nodes.filter((n) => n.status === "mastered").length : 0;
  const viewportInicial = useMemo(() => enquadrar(graph.nodes, area.w, area.h), [graph.nodes, area.w, area.h]);
  // árvore nova ou a área mudou de tamanho (expandir/recolher, girar a tela) → reenquadra: primeiro pela conta
  // (sempre funciona), depois o fitView do React Flow, se os nós já estiverem medidos
  useEffect(() => {
    const rf = rfRef.current;
    if (!rf || !tree || tree.degraded) return;
    rf.setViewport(viewportInicial);
    const t = setTimeout(() => { try { rf.fitView({ padding: 0.2, duration: 200 }); } catch { /* sem medida ainda: fica a conta */ } }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree?.topicSlug, tree?.nodes.length, area.w, area.h]);

  const markUnderstood = useCallback(async () => {
    if (!tree || !selected || marking) return;
    setMarking(true);
    try {
      const r = await fetch("/api/skilltree/progress", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: tree.topicSlug, nodeId: selected.id, mastered: true }),
      });
      if (r.ok) {
        const d = await r.json();
        emit({ ...tree, nodes: d.nodes });
        const names = (d.unlocked as string[]).map((id) => (d.nodes as SkillNodeState[]).find((n) => n.id === id)?.title).filter(Boolean);
        setToast(names.length ? `Desbloqueou: ${names.join(", ")}` : "Nó dominado ✓");
      } else if (r.status === 409) setToast("Esse nó ainda está travado — domine os pré-requisitos.");
    } catch { /* ignore */ } finally { setMarking(false); }
  }, [tree, selected, marking, emit]);

  return (
    <div className="h-full flex flex-col bg-white/85 dark:bg-[#080c18]/90 backdrop-blur-2xl border-l border-slate-200 dark:border-white/10">
      {/* cabeçalho */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <span className="text-cyan-600 dark:text-cyan-300 text-[14px] leading-none" style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.5))" }}>⟁</span>
        <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-white/50 font-tech">Árvore de habilidades</span>
        {tree && <span className="text-[11px] font-mono text-slate-400">{done}/{tree.nodes.length}</span>}
        {onExpandir && (
          <button onClick={() => onExpandir(!expandida)} className="ml-auto p-1 rounded-lg text-slate-400 hover:text-cyan-500"
            title={expandida ? "Recolher a árvore" : "Expandir a árvore"} aria-label={expandida ? "Recolher a árvore" : "Expandir a árvore"} aria-pressed={expandida}>
            {expandida ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className={`${onExpandir ? "" : "ml-auto "}p-1 rounded-lg text-slate-400 hover:text-cyan-500`} title="Fechar árvore" aria-label="Fechar árvore"><X size={15} /></button>
        )}
      </div>

      {/* tópico */}
      <form
        onSubmit={(e) => { e.preventDefault(); void generate(topicInput); }}
        className="flex items-center gap-2 px-3 py-2 border-b border-slate-200/70 dark:border-white/[0.06]"
      >
        <GitBranch size={14} className="text-violet-500 shrink-0" />
        <input
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder="Tópico de estudo (ex.: Fotossíntese)"
          className="flex-1 min-w-0 bg-transparent text-[13px] font-tech text-slate-800 dark:text-white/90 placeholder:text-slate-400 outline-none"
        />
        <button
          type="submit"
          disabled={phase === "generating" || topicInput.trim().length < 2}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold font-tech
            bg-gradient-to-r from-violet-500 to-cyan-400 text-white disabled:opacity-40"
          title="Gerar / carregar a árvore deste tópico"
        >
          {phase === "generating" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Árvore
        </button>
      </form>

      {/* corpo */}
      <div ref={areaRef} className="relative flex-1 min-h-0">
        {phase === "idle" && !tree && (
          <div className="h-full flex items-center justify-center p-6 text-center text-[12.5px] text-slate-400 dark:text-white/35 font-tech leading-relaxed">
            Foque um estudo ou digite um tópico: a Aura monta uma árvore de teoria, experimental e prática pra você dominar nó a nó.
          </div>
        )}
        {phase === "generating" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/60 dark:bg-[#080c18]/70 backdrop-blur-sm">
            <span className="text-[26px] text-cyan-500 animate-pulse" style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.6))" }}>⟁</span>
            <span className="text-[13px] font-tech text-slate-600 dark:text-white/70">montando sua árvore…</span>
          </div>
        )}
        {phase === "error" && !tree && (
          <div className="h-full flex items-center justify-center p-6 text-center text-[12.5px] text-rose-500 font-tech">
            Não consegui montar a árvore agora. Tente de novo.
          </div>
        )}
        {tree && tree.degraded && (
          // DEGRADADO: trilha linear simples (a geração falhou) — nunca quebra o estudo
          <div className="h-full overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
            <p className="text-[11px] font-tech text-amber-600 dark:text-amber-300 px-1">Trilha simples por enquanto (a geração da árvore falhou). Toque em “Árvore” pra tentar de novo.</p>
            {tree.nodes.map((n, i) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`text-left rounded-xl border px-3 py-2 font-tech transition-colors
                  ${n.id === selectedId ? "border-cyan-400/60 bg-cyan-500/5" : "border-slate-200 dark:border-white/10"}
                  ${n.status === "locked" ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-800 dark:text-white/90">
                  <span className="text-slate-400 font-mono text-[11px]">{i + 1}.</span> {n.title}
                  <span className="ml-auto">{n.status === "mastered" ? <Check size={12} className="text-emerald-500" /> : n.status === "locked" ? <Lock size={11} className="text-slate-400" /> : <Sparkles size={11} className="text-cyan-500" />}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {tree && !tree.degraded && (
          <ReactFlow
            key={tree.topicSlug}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onInit={(rf) => { rfRef.current = rf; rf.setViewport(viewportInicial); }}
            defaultViewport={viewportInicial}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.3}
            maxZoom={1.6}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            className="!bg-transparent"
          >
            <Background gap={22} size={1} color="rgba(148,163,184,0.25)" />
            <Controls showInteractive={false} className="!bg-white/80 dark:!bg-white/10 !border-slate-200 dark:!border-white/10 !shadow-none" />
          </ReactFlow>
        )}
        {toast && (
          <div className="absolute left-3 right-3 top-3 z-20 rounded-xl px-3 py-2 text-[12px] font-tech text-white
            bg-gradient-to-r from-violet-500 to-cyan-400 shadow-lg">{toast}</div>
        )}
      </div>

      {/* nó selecionado: resumo + ações */}
      {tree && selected && (
        <div className="border-t border-slate-200 dark:border-white/10 p-3 flex flex-col gap-2 bg-white/70 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRANCH_COLOR[selected.branch] }} />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] font-tech" style={{ color: BRANCH_COLOR[selected.branch] }}>
              {BRANCH_LABEL[selected.branch]} · nível {selected.level}
            </span>
            <span className="ml-auto text-[10.5px] font-mono text-slate-400">{Math.round(selected.mastery * 100)}%</span>
          </div>
          <div className="text-[13.5px] font-semibold text-slate-800 dark:text-white/90 font-tech leading-tight">{selected.title}</div>
          {selected.summary && <p className="text-[12px] text-slate-500 dark:text-white/55 font-tech leading-relaxed">{selected.summary}</p>}
          {selected.status === "locked" && selected.prereqs.length > 0 && (
            <p className="text-[11px] text-slate-400 font-tech">
              Precisa antes: {selected.prereqs.map((p) => tree.nodes.find((n) => n.id === p)?.title ?? p).join(", ")}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onNodeChat(selected, tree)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold font-tech text-white
                bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_8px_20px_-10px_rgba(139,92,246,0.7)]"
            >
              <MessageSquare size={12} /> Estudar este nó
            </button>
            {selected.status !== "mastered" && selected.status !== "locked" && (
              <button
                onClick={markUnderstood}
                disabled={marking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold font-tech
                  border border-emerald-400/50 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                title="Marcar como dominado"
              >
                {marking ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Entendi
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
