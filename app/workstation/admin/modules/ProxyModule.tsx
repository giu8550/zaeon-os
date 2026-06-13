import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    PlusIcon, TrashIcon, GlobeAltIcon, LinkIcon, ShieldCheckIcon, SignalIcon,
} from "@heroicons/react/24/outline";

interface ProxyData {
    id: string;
    label: string;
    host: string;
    port: number | string;
    username: string;
    password: string;
    type: "socks5" | "http" | "https";
    region: string;
    status: "free" | "assigned";
    assignedEmail: string;
    assignedInstance: string;
}

const EMPTY: ProxyData = {
    id: "", label: "", host: "", port: "", username: "", password: "",
    type: "socks5", region: "BR", status: "free", assignedEmail: "", assignedInstance: "",
};

export default function ProxyModule({ glassPanel }: { glassPanel: string }) {
    const [list, setList] = useState<ProxyData[]>([]);
    const [current, setCurrent] = useState<ProxyData>(EMPTY);

    const fetchProxies = async () => {
        const res = await fetch("/api/admin/proxies");
        if (res.ok) setList(await res.json());
    };
    useEffect(() => { fetchProxies(); }, []);

    const handleSave = async () => {
        if (!current.label || !current.host || !current.port) {
            alert("⚠️ Preencha label, host e porta.");
            return;
        }
        const payload: any = { ...current };
        if (!payload.id) delete payload.id;
        const res = await fetch("/api/admin/proxies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (res.ok) { alert("🛡 Proxy conectado."); setCurrent(EMPTY); fetchProxies(); }
        else { alert("❌ Erro ao salvar proxy."); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("🚨 Remover este proxy? A sessão vinculada perde o egress dedicado.")) return;
        const res = await fetch(`/api/admin/proxies?id=${id}`, { method: "DELETE" });
        if (res.ok) { fetchProxies(); if (current.id === id) setCurrent(EMPTY); }
    };

    const assignedCount = list.filter((p) => p.status === "assigned").length;

    return (
        <div className="flex-1 flex gap-8 overflow-hidden w-full h-full">
            {/* LISTA */}
            <div className={`w-[340px] rounded-[45px] flex flex-col overflow-hidden ${glassPanel}`}>
                <div className="p-8 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-white/50 dark:bg-black/20">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Proxies Pro</h2>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                            {assignedCount}/{list.length} vinculados
                        </p>
                    </div>
                    <button
                        onClick={() => setCurrent(EMPTY)}
                        className="p-2 bg-slate-900 dark:bg-cyan-500 text-white dark:text-black rounded-full hover:scale-110 shadow-lg transition-transform"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {list.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3 py-16">
                            <GlobeAltIcon className="w-10 h-10" />
                            <span className="text-[10px] uppercase tracking-widest">Nenhum proxy ainda</span>
                        </div>
                    )}
                    {list.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => setCurrent({ ...EMPTY, ...p })}
                            className={`p-5 rounded-3xl cursor-pointer transition-all border group relative ${
                                current.id === p.id
                                    ? "bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/20"
                                    : "bg-transparent border-transparent hover:bg-white/40 dark:hover:bg-white/5"
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === "assigned" ? "bg-cyan-400" : "bg-slate-400/50"}`} />
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate pr-6">{p.label}</h4>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest truncate">
                                        {p.type} · {p.region} · {p.host}:{p.port}
                                    </p>
                                    {p.status === "assigned" && (
                                        <p className="text-[10px] text-cyan-500 mt-1 truncate flex items-center gap-1">
                                            <LinkIcon className="w-3 h-3" /> {p.assignedEmail}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                    className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
                        onClick={handleSave}
                        className="px-8 py-3 rounded-2xl bg-slate-950 dark:bg-cyan-500 text-white dark:text-black font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"
                    >
                        <ShieldCheckIcon className="w-5 h-5" /> {current.id ? "Atualizar" : "Conectar Proxy"}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 pt-24 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-10">
                        <input
                            type="text"
                            placeholder="Label do proxy..."
                            className="w-full bg-transparent text-5xl font-black outline-none border-none placeholder:text-slate-200 dark:placeholder:text-white/10"
                            value={current.label}
                            onChange={(e) => setCurrent({ ...current, label: e.target.value })}
                        />

                        {/* host : port */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Host / IP</label>
                                <input
                                    type="text" placeholder="ex: 200.150.10.5"
                                    className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm"
                                    value={current.host}
                                    onChange={(e) => setCurrent({ ...current, host: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Porta</label>
                                <input
                                    type="number" placeholder="1080"
                                    className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm"
                                    value={current.port}
                                    onChange={(e) => setCurrent({ ...current, port: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* user : pass */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Usuário</label>
                                <input
                                    type="text" placeholder="(opcional)"
                                    className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm"
                                    value={current.username}
                                    onChange={(e) => setCurrent({ ...current, username: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Senha</label>
                                <input
                                    type="password" placeholder="(opcional)"
                                    className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm"
                                    value={current.password}
                                    onChange={(e) => setCurrent({ ...current, password: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* type : region */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Tipo</label>
                                <select
                                    className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm"
                                    value={current.type}
                                    onChange={(e) => setCurrent({ ...current, type: e.target.value as any })}
                                >
                                    <option value="socks5">SOCKS5</option>
                                    <option value="http">HTTP</option>
                                    <option value="https">HTTPS</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Região (geo)</label>
                                <input
                                    type="text" placeholder="BR"
                                    className="w-full bg-slate-100 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-sm"
                                    value={current.region}
                                    onChange={(e) => setCurrent({ ...current, region: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Vínculo 1-a-1 com a sessão / QR */}
                        <div className="rounded-[30px] border border-cyan-500/30 bg-cyan-500/[0.04] backdrop-blur-xl p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <SignalIcon className="w-5 h-5 text-cyan-500" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                    Certificação Pro · vínculo 1-a-1 com o QR
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
                                Conecte este proxy à sessão WhatsApp de um usuário. O egress fica dedicado
                                e geo-coerente (ver ADR-001). Deixe em branco para manter como pool livre.
                            </p>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">E-mail do usuário</label>
                                    <input
                                        type="email" placeholder="aluno@usp.br"
                                        className="w-full bg-white/60 dark:bg-black/30 p-4 rounded-2xl outline-none font-bold text-sm border border-cyan-500/20"
                                        value={current.assignedEmail}
                                        onChange={(e) => setCurrent({ ...current, assignedEmail: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Instância / sessão QR</label>
                                    <input
                                        type="text" placeholder="id da instância"
                                        className="w-full bg-white/60 dark:bg-black/30 p-4 rounded-2xl outline-none font-bold text-sm border border-cyan-500/20"
                                        value={current.assignedInstance}
                                        onChange={(e) => setCurrent({ ...current, assignedInstance: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <span className={`w-2 h-2 rounded-full ${current.assignedEmail ? "bg-cyan-400" : "bg-slate-400/50"}`} />
                                <span className="text-[10px] uppercase tracking-widest text-slate-400">
                                    {current.assignedEmail ? "Será marcado como vinculado" : "Pool livre"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
