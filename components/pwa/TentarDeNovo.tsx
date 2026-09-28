"use client";

export function TentarDeNovo() {
    return (
        <button
            type="button"
            onClick={() => location.reload()}
            className="mt-10 inline-flex items-center rounded-full border border-slate-300 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.2em] text-slate-900 transition-colors hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
        >
            Tentar de novo
        </button>
    );
}
