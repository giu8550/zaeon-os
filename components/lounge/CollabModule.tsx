"use client";

/**
 * CollabModule — coração colaborativo do Lounge.
 *  1) Lista MEUS estudos/pesquisas, cada um com ▶ → cria um doc colaborativo (cópia)
 *     e abre um popup com o LINK pra copiar/enviar (avatar do convidador/amigos com
 *     atalho pro chat deles).
 *  2) Lista minhas COLABORAÇÕES e abre o editor compartilhado — edição em grupo
 *     ao vivo (autosave + Pusher canal `collab-<id>`). Edição em grupo só aqui no Lounge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import PusherClient from "pusher-js";
import {
  Play, Link as LinkIcon, Copy, Check, Send, X, Users, ArrowLeft,
  BookOpen, Beaker, FileText, Loader2, UserPlus,
} from "lucide-react";

type Source = { id: string; title: string; kind: "study" | "research" };
type Collab = { id: string; title: string; kind: string; updatedAt: string; isOwner: boolean; memberCount: number };
type Contact = { id: string; name: string | null; image: string | null; isInviter?: boolean };
type Member = { id: string; name: string | null; image: string | null };
type DocFull = { id: string; title: string; kind: string; content: string; ownerId: string; isOwner: boolean; token: string; members: Member[] };

const kindIcon = (k: string) => (k === "research" ? Beaker : k === "report" ? FileText : BookOpen);

// Renderiza no document.body — escapa de ancestrais com backdrop-filter/transform
// (que quebram position:fixed). Sem isso, os popups abrem fora da tela.
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function CollabModule() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id || "";

  const [sources, setSources] = useState<{ studies: Source[]; research: Source[] }>({ studies: [], research: [] });
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [share, setShare] = useState<{ link: string; title: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadCollabs = useCallback(async () => {
    try { const r = await fetch("/api/collab", { cache: "no-store" }); if (r.ok) setCollabs(await r.json()); } catch { /* */ }
  }, []);

  // Deep-link: /research-lab?tab=lounge&collab=<id> abre o doc direto (vindo do aceite).
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("collab");
      if (id) setOpenId(id);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    (async () => {
      try { const r = await fetch("/api/collab/sources", { cache: "no-store" }); if (r.ok) setSources(await r.json()); } catch { /* */ }
      loadCollabs();
      // contatos: convidador (perfil) + amigos
      try {
        const [pr, fr] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/network/friends", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        const list: Contact[] = [];
        if (pr?.inviter?.id) list.push({ id: pr.inviter.id, name: pr.inviter.name, image: pr.inviter.image, isInviter: true });
        (fr?.friends || []).forEach((f: any) => { if (!list.some((c) => c.id === f.id)) list.push({ id: f.id, name: f.name, image: f.image }); });
        setContacts(list);
      } catch { /* */ }
    })();
  }, [loadCollabs]);

  const createCollab = async (s: Source) => {
    setCreating(s.id);
    try {
      const r = await fetch("/api/collab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: s.kind, sourceId: s.id, title: s.title }),
      });
      if (r.ok) {
        const d = await r.json();
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setShare({ link: `${origin}${d.link}`, title: s.title });
        loadCollabs();
      } else {
        const d = await r.json().catch(() => ({}));
        setToast(d.error || `Não consegui gerar o convite (${r.status}).`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast("Erro de conexão ao gerar o convite.");
      setTimeout(() => setToast(null), 4000);
    } finally { setCreating(null); }
  };

  const allSources = [...sources.studies, ...sources.research];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      {/* ── Compartilhar um estudo/pesquisa ── */}
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-300 mb-1">Co-criar com amigos</h3>
        <p className="text-[11px] text-slate-500 dark:text-white/45 mb-4">Dê play em um estudo ou pesquisa pra gerar um link de convite. Quem aceitar edita junto com você, aqui no Lounge.</p>
        {allSources.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-white/30 italic">Você ainda não tem estudos ou pesquisas. Crie um na Sala de Estudos ou Pesquisa primeiro.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allSources.map((s) => {
              const Icon = kindIcon(s.kind);
              return (
                <div key={`${s.kind}-${s.id}`} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] backdrop-blur-md">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.kind === "research" ? "bg-violet-500/15 text-violet-500" : "bg-cyan-500/15 text-cyan-500"}`}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{s.title}</p>
                    <p className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-white/35">{s.kind === "research" ? "Pesquisa" : "Estudo"}</p>
                  </div>
                  <button onClick={() => createCollab(s)} disabled={creating === s.id}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-transform hover:scale-105 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }} title="Gerar convite de colaboração">
                    {creating === s.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} className="ml-0.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Minhas colaborações ── */}
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-600 dark:text-white/55 mb-3 flex items-center gap-2">
          <Users size={13} /> Colaborações
        </h3>
        {collabs.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-white/30 italic">Nenhuma colaboração ainda. Dê play acima ou aceite um convite de um amigo.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {collabs.map((c) => {
              const Icon = kindIcon(c.kind);
              return (
                <button key={c.id} onClick={() => setOpenId(c.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] hover:border-cyan-400/50 transition-colors text-left">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"><Icon size={17} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{c.title}</p>
                    <p className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-white/35">{c.isOwner ? "Você criou" : "Convidado"} · {c.memberCount} {c.memberCount === 1 ? "membro" : "membros"}</p>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-300 shrink-0">abrir →</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {share && <Portal><SharePopup link={share.link} title={share.title} contacts={contacts} onClose={() => setShare(null)} /></Portal>}
      {openId && <Portal><CollabEditor docId={openId} myId={myId} contacts={contacts} onClose={() => { setOpenId(null); loadCollabs(); }} /></Portal>}

      {toast && (
        <Portal>
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[900] px-5 py-3 rounded-full bg-black text-white text-[12px] font-bold shadow-2xl">
            {toast}
          </div>
        </Portal>
      )}
    </div>
  );
}

// ───────────────────────── Popup de convite ─────────────────────────
function SharePopup({ link, title, contacts, onClose }: { link: string; title: string; contacts: Contact[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  };
  const sendTo = async (c: Contact) => {
    try {
      await fetch("/api/ai/chat/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: c.id, text: `🤝 Vem co-criar "${title}" comigo na Zaeon: ${link}` }),
      });
      setSent((p) => ({ ...p, [c.id]: true }));
    } catch { /* */ }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[800] flex items-center justify-center p-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[28px] border border-cyan-300/40 dark:border-cyan-400/20 bg-white dark:bg-[#0b1220] p-6 shadow-2xl overflow-hidden">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-cyan-500/15 blur-2xl" />
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X size={18} /></button>

        <div className="relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>
            <LinkIcon size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Convite gerado ✨</h3>
          <p className="text-[12px] text-slate-500 dark:text-white/50 mb-4">Quem entrar por este link co-cria <span className="font-bold">“{title}”</span> com você.</p>

          <div className="flex items-center gap-2 p-2 pl-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04]">
            <input readOnly value={link} className="flex-1 bg-transparent text-[12px] text-slate-700 dark:text-white/80 outline-none truncate" />
            <button onClick={copy} className="px-3 py-2 rounded-xl text-white text-[11px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 shrink-0"
              style={{ background: copied ? "#10b981" : "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>
              {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
            </button>
          </div>

          {contacts.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40 mb-2">Enviar direto pro chat</p>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                {contacts.map((c) => (
                  <div key={c.id} className={`flex items-center gap-3 p-2 rounded-2xl ${c.isInviter ? "border border-cyan-300/50 dark:border-cyan-400/25 bg-cyan-50/60 dark:bg-cyan-950/15" : "hover:bg-slate-100 dark:hover:bg-white/5"}`}>
                    <span className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-black flex items-center justify-center shrink-0 border border-slate-300 dark:border-white/10">
                      {c.image ? <Image src={c.image} alt="" width={36} height={36} className="w-full h-full object-cover" /> : <span className="text-[12px] font-black text-slate-500">{(c.name || "?").charAt(0).toUpperCase()}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{c.name || "Membro Zaeon"}</p>
                      {c.isInviter && <p className="text-[9px] uppercase tracking-widest text-cyan-600 dark:text-cyan-300">quem te convidou</p>}
                    </div>
                    <button onClick={() => sendTo(c)} disabled={!!sent[c.id]}
                      className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-60"
                      style={{ background: sent[c.id] ? "#10b981" : "rgba(14,165,233,0.12)", color: sent[c.id] ? "#fff" : "#0ea5e9" }}>
                      {sent[c.id] ? <><Check size={12} /> Enviado</> : <><Send size={12} /> Enviar</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ───────────────────────── Editor colaborativo ─────────────────────────
function CollabEditor({ docId, myId, contacts, onClose }: { docId: string; myId: string; contacts: Contact[]; onClose: () => void }) {
  const [doc, setDoc] = useState<DocFull | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [remoteFlash, setRemoteFlash] = useState(false);
  const [share, setShare] = useState<{ link: string; title: string } | null>(null);

  const clientId = useRef(Math.random().toString(36).slice(2));
  const focusedRef = useRef(false);
  const lastEditRef = useRef(0);
  const pendingRemote = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega o doc
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/collab/${docId}`, { cache: "no-store" });
        if (r.ok && alive) { const d: DocFull = await r.json(); setDoc(d); setContent(d.content || ""); }
      } catch { /* */ }
    })();
    return () => { alive = false; };
  }, [docId]);

  // Real-time via Pusher (canal do doc)
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return;
    const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
    const ch = pusher.subscribe(`collab-${docId}`);
    ch.bind("doc-update", (data: any) => {
      if (data?.clientId === clientId.current || data?.fromUserId === myId) return; // não reaplica o próprio
      if (typeof data?.content !== "string") return;
      // se estou digitando agora, guarda e aplica quando eu parar; senão aplica já.
      if (focusedRef.current && Date.now() - lastEditRef.current < 1500) {
        pendingRemote.current = data.content;
      } else {
        setContent(data.content);
        setRemoteFlash(true); setTimeout(() => setRemoteFlash(false), 700);
      }
    });
    return () => { pusher.unsubscribe(`collab-${docId}`); pusher.disconnect(); };
  }, [docId, myId]);

  // Aplica updates remotos pendentes quando o usuário fica ocioso.
  useEffect(() => {
    const iv = setInterval(() => {
      if (pendingRemote.current !== null && (!focusedRef.current || Date.now() - lastEditRef.current > 1500)) {
        setContent(pendingRemote.current);
        pendingRemote.current = null;
        setRemoteFlash(true); setTimeout(() => setRemoteFlash(false), 700);
      }
    }, 800);
    return () => clearInterval(iv);
  }, []);

  const scheduleSave = (next: string) => {
    lastEditRef.current = Date.now();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/collab/${docId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next, clientId: clientId.current }),
        });
      } catch { /* */ } finally { setSaving(false); }
    }, 600);
  };

  const onChange = (v: string) => { setContent(v); scheduleSave(v); };

  const reinvite = () => {
    if (!doc) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setShare({ link: `${origin}/c/${doc.token}`, title: doc.title });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[760] flex items-stretch justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}
        className="relative w-full max-w-3xl flex flex-col rounded-[26px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03]">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10"><ArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">{doc?.title || "Carregando…"}</p>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-white/40">
              Edição em grupo · {saving ? "salvando…" : "salvo"}{remoteFlash ? " · atualizado por colega" : ""}
            </p>
          </div>
          {/* Avatares dos membros */}
          <div className="flex -space-x-2 mr-1">
            {(doc?.members || []).slice(0, 5).map((m) => (
              <span key={m.id} className="w-7 h-7 rounded-full overflow-hidden border-2 border-white dark:border-[#0b1220] bg-slate-200 dark:bg-black flex items-center justify-center" title={m.name || ""}>
                {m.image ? <Image src={m.image} alt="" width={28} height={28} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-500">{(m.name || "?").charAt(0).toUpperCase()}</span>}
              </span>
            ))}
          </div>
          <button onClick={reinvite} className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 text-white shrink-0" style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>
            <UserPlus size={12} /> Convidar
          </button>
        </div>

        {/* Corpo */}
        <div className={`relative flex-1 transition-colors ${remoteFlash ? "bg-cyan-50/40 dark:bg-cyan-500/[0.05]" : ""}`}>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { focusedRef.current = true; }}
            onBlur={() => { focusedRef.current = false; }}
            placeholder="Escrevam juntos aqui…"
            className="w-full h-[55vh] sm:h-[60vh] resize-none outline-none bg-transparent px-5 py-4 text-[14px] leading-relaxed text-slate-800 dark:text-white/90 font-serif custom-scrollbar"
          />
        </div>
      </motion.div>

      {share && <Portal><SharePopup link={share.link} title={share.title} contacts={contacts} onClose={() => setShare(null)} /></Portal>}
    </motion.div>
  );
}
