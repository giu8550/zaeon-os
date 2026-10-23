import { useState, useEffect } from "react";
import { PlusIcon, TrashIcon, Squares2X2Icon, CheckIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

/**
 * Admin → Blueprints: a vitrine "Aqui você vale o que você constrói." da landing.
 * Só os PUBLICADOS aparecem lá (GET /api/blueprints); sem nenhum publicado, a seção some da landing.
 * API: /api/admin/blueprints (+ /:id). Validação no servidor (lib/landing/blueprints).
 */
interface BlueprintRow {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    href: string | null;
    tags: string[];
    published: boolean;
    order: number;
}

type Form = { id: string; title: string; description: string; imageUrl: string; href: string; tags: string; published: boolean; order: string };

const EMPTY: Form = { id: "", title: "", description: "", imageUrl: "", href: "", tags: "", published: false, order: "0" };

const ERROS: Record<string, string> = {
    titulo_obrigatorio: "Preencha o título.",
    titulo_longo: "Título muito longo (máx. 120).",
    descricao_invalida: "Descrição muito longa (máx. 400).",
    imagem_invalida: "Imagem: use uma URL https ou um caminho do site (/...).",
    link_invalido: "Link: use uma URL https ou um caminho do site (/...).",
    tags_invalidas: "Tags: até 10, separadas por vírgula, cada uma com até 30 letras.",
    ordem_invalida: "Ordem precisa ser um número inteiro.",
};

const paraForm = (b: BlueprintRow): Form => ({
    id: b.id, title: b.title, description: b.description ?? "", imageUrl: b.imageUrl ?? "", href: b.href ?? "",
    tags: b.tags.join(", "), published: b.published, order: String(b.order),
});

const campo = "w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm";
const rotulo = "text-[10px] font-black uppercase text-slate-400";

export default function BlueprintsModule({ glassPanel }: { glassPanel: string }) {
    const [list, setList] = useState<BlueprintRow[]>([]);
    const [current, setCurrent] = useState<Form>(EMPTY);
    const [salvando, setSalvando] = useState(false);

    const carregar = async () => {
        const res = await fetch("/api/admin/blueprints");
        if (res.ok) setList((await res.json()).blueprints ?? []);
    };
    useEffect(() => { carregar(); }, []);

    const salvar = async () => {
        if (salvando) return;
        setSalvando(true);
        const payload = {
            title: current.title, description: current.description, imageUrl: current.imageUrl, href: current.href,
            tags: current.tags, published: current.published, order: current.order,
        };
        const res = await fetch(current.id ? `/api/admin/blueprints/${current.id}` : "/api/admin/blueprints", {
            method: current.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).catch(() => null);
        setSalvando(false);
        if (!res) { alert("❌ Erro de conexão."); return; }
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { alert(`❌ ${ERROS[d?.error] ?? "Erro ao salvar o blueprint."}`); return; }
        setCurrent(paraForm(d.blueprint));
        carregar();
    };

    const alternarPublicado = async (b: BlueprintRow) => {
        const res = await fetch(`/api/admin/blueprints/${b.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !b.published }),
        });
        if (res.ok) { carregar(); if (current.id === b.id) setCurrent({ ...current, published: !b.published }); }
    };

    const apagar = async (id: string) => {
        if (!confirm("🚨 Apagar este blueprint? Ele sai da landing na hora.")) return;
        const res = await fetch(`/api/admin/blueprints/${id}`, { method: "DELETE" });
        if (res.ok) { carregar(); if (current.id === id) setCurrent(EMPTY); }
    };

    const publicados = list.filter((b) => b.published).length;

    return (
        <div className="flex-1 flex gap-8 overflow-hidden w-full h-full">
            {/* LISTA */}
            <div className={`w-[340px] rounded-[45px] flex flex-col overflow-hidden ${glassPanel}`}>
                <div className="p-8 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-white/50 dark:bg-black/20">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Blueprints</h2>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                            {publicados}/{list.length} publicados na landing
                        </p>
                    </div>
                    <button
                        onClick={() => setCurrent(EMPTY)}
                        aria-label="Adicionar blueprint"
                        title="Adicionar blueprint"
                        className="p-2 bg-slate-900 dark:bg-cyan-500 text-white dark:text-black rounded-full hover:scale-110 shadow-lg transition-transform"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {list.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3 py-16 text-center">
                            <Squares2X2Icon className="w-10 h-10" />
                            <span className="text-[10px] uppercase tracking-widest">Nenhum blueprint ainda<br />(a seção não aparece na landing)</span>
                        </div>
                    )}
                    {list.map((b) => (
                        <div
                            key={b.id}
                            onClick={() => setCurrent(paraForm(b))}
                            className={`p-5 rounded-3xl cursor-pointer transition-all border group relative ${
                                current.id === b.id
                                    ? "bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/20"
                                    : "bg-transparent border-transparent hover:bg-white/40 dark:hover:bg-white/5"
                            }`}
                        >
                            <div className="flex items-center gap-2 pr-16">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${b.published ? "bg-cyan-400" : "bg-slate-400/50"}`} />
                                <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{b.title}</h4>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest truncate">
                                #{b.order} · {b.published ? "Publicado" : "Rascunho"}
                            </p>
                            <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                                <button
                                    onClick={(e) => { e.stopPropagation(); alternarPublicado(b); }}
                                    aria-label={b.published ? "Despublicar" : "Publicar"}
                                    title={b.published ? "Despublicar" : "Publicar"}
                                    className="p-1.5 text-slate-400 hover:bg-cyan-500 hover:text-white rounded-lg"
                                >
                                    {b.published ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); apagar(b.id); }}
                                    aria-label="Apagar"
                                    title="Apagar"
                                    className="p-1.5 text-slate-400 hover:bg-red-500 hover:text-white rounded-lg"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FORM */}
            <div className={`flex-1 rounded-[45px] flex flex-col relative overflow-hidden ${glassPanel}`}>
                <div className="absolute top-8 right-8 z-20">
                    <button
                        onClick={salvar}
                        disabled={salvando}
                        className="px-8 py-3 rounded-2xl bg-slate-950 dark:bg-cyan-500 text-white dark:text-black font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <CheckIcon className="w-5 h-5" /> {salvando ? "Salvando…" : current.id ? "Atualizar" : "Adicionar"}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 pt-24 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-8">
                        <input
                            type="text"
                            aria-label="Título"
                            placeholder="Título do blueprint..."
                            maxLength={120}
                            className="w-full bg-transparent text-5xl font-black outline-none border-none placeholder:text-slate-200 dark:placeholder:text-white/10"
                            value={current.title}
                            onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                        />

                        <div className="space-y-2">
                            <label htmlFor="bp-desc" className={rotulo}>Descrição curta (card)</label>
                            <textarea
                                id="bp-desc" rows={3} maxLength={400}
                                placeholder="Uma ou duas frases sobre o que esse blueprint constrói."
                                className={`${campo} resize-none`}
                                value={current.description}
                                onChange={(e) => setCurrent({ ...current, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label htmlFor="bp-img" className={rotulo}>Imagem (URL)</label>
                                <input id="bp-img" type="text" placeholder="https://… ou /assets/…" className={campo}
                                    value={current.imageUrl} onChange={(e) => setCurrent({ ...current, imageUrl: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="bp-href" className={rotulo}>Link “ver no game” (opcional)</label>
                                <input id="bp-href" type="text" placeholder="/lounge-cosmico…" className={campo}
                                    value={current.href} onChange={(e) => setCurrent({ ...current, href: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2 space-y-2">
                                <label htmlFor="bp-tags" className={rotulo}>Tags (separadas por vírgula)</label>
                                <input id="bp-tags" type="text" placeholder="energia, cidade, game" className={campo}
                                    value={current.tags} onChange={(e) => setCurrent({ ...current, tags: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="bp-ordem" className={rotulo}>Ordem</label>
                                <input id="bp-ordem" type="number" step={1} className={campo}
                                    value={current.order} onChange={(e) => setCurrent({ ...current, order: e.target.value })} />
                            </div>
                        </div>

                        <button
                            type="button" role="switch" aria-checked={current.published}
                            onClick={() => setCurrent({ ...current, published: !current.published })}
                            className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-left"
                        >
                            <span>
                                <span className={`${rotulo} block`}>Publicado</span>
                                <span className="text-sm font-bold">{current.published ? "Aparece na landing" : "Rascunho (não aparece na landing)"}</span>
                            </span>
                            <span aria-hidden className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${current.published ? "bg-cyan-500" : "bg-slate-300 dark:bg-white/15"}`}>
                                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${current.published ? "translate-x-5" : ""}`} />
                            </span>
                        </button>

                        {current.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element -- prévia de URL livre digitada no admin
                            <img src={current.imageUrl} alt="Prévia da imagem" className="w-full max-w-sm aspect-[16/10] object-cover rounded-2xl border border-slate-200 dark:border-white/10" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
