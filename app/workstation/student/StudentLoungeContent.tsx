"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Coffee, MessageCircle, Users, Send } from "lucide-react";

export default function StudentLoungeContent() {
    const { data: session } = useSession();
    const [message, setMessage] = useState("");

    const userName = session?.user?.name?.split(" ")[0] || "Estudante";

    return (
        <div className="p-6 md:p-8 flex flex-col gap-8 max-w-[1400px] mx-auto w-full h-full">

            {/* HEADER */}
            <div className="w-full p-8 rounded-[2rem] bg-white/40 dark:bg-slate-900/20 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-violet-400/10 dark:bg-violet-500/10 rounded-full blur-[80px] -translate-y-1/2 -translate-x-1/4 pointer-events-none" />

                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                        <Coffee className="text-violet-600 dark:text-violet-400" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                            Lounge dos Estudantes
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
                            Espaço informal para conversa entre colegas. Relaxe, troque ideias e conecte-se com outros estudantes.
                        </p>
                    </div>
                </div>
            </div>

            {/* LAYOUT: CHAT + ONLINE */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1">

                {/* CHAT AREA */}
                <div className="flex-[2] flex flex-col rounded-[2rem] bg-white/50 dark:bg-[#1a1a1a]/40 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden">
                    {/* Messages */}
                    <div className="flex-1 min-h-[300px] p-6 flex flex-col items-center justify-center gap-3">
                        <MessageCircle size={40} className="text-slate-300 dark:text-white/15" />
                        <span className="text-sm font-semibold text-slate-400 dark:text-white/30">Nenhuma mensagem ainda</span>
                        <span className="text-xs text-slate-400 dark:text-white/20 text-center max-w-sm">
                            Seja o primeiro a enviar uma mensagem no lounge. O chat é em tempo real entre todos os estudantes conectados.
                        </span>
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-3 bg-white dark:bg-black/30 rounded-2xl border border-black/10 dark:border-white/10 p-2 shadow-sm">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={`Diga algo, ${userName}...`}
                                className="flex-1 bg-transparent text-sm outline-none px-3 text-slate-700 dark:text-white placeholder:text-slate-400"
                            />
                            <button
                                disabled={!message.trim()}
                                className="p-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl shadow-md hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ONLINE SIDEBAR */}
                <div className="flex-1 max-w-[300px] p-6 rounded-[2rem] bg-white/40 dark:bg-slate-900/20 backdrop-blur-2xl border border-white/60 dark:border-white/10 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/50">
                            Online Agora
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[150px]">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="w-3 h-3 bg-emerald-500 rounded-full"
                        />
                        <span className="text-xs text-slate-400 dark:text-white/30 italic text-center">
                            Aguardando conexão com o servidor de presença...
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
