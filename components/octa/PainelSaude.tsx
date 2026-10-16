"use client";
/**
 * components/octa/PainelSaude.tsx — 🩺 "Monitorando alucinações e falhas de cognição" (Pack Octa §5).
 * Verde/amarelo/vermelho por agente, última execução, taxa de PASS, drift e o que falhou. Só leitura.
 */
import { useEffect, useState } from "react";
import type { Relatorio } from "@/lib/octa/evals/core";

const COR: Record<Relatorio["status"], string> = { verde: "bg-emerald-500", amarelo: "bg-amber-400", vermelho: "bg-rose-500" };

export default function PainelSaude() {
  const [rels, setRels] = useState<Relatorio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/octa/saude").then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErro(j.error ?? `erro ${r.status}`); else setRels(j.relatorios ?? []);
    }).catch((e) => setErro(String(e)));
  }, []);

  return (
    <section className="mx-auto max-w-3xl p-4 sm:p-6 text-zinc-100">
      <h1 className="text-xl font-semibold">🩺 Monitorando alucinações e falhas de cognição</h1>
      <p className="mt-1 text-sm text-zinc-400">Rotina diária: groundedness, tool-truth, repetibilidade e drift, julgados por um juiz independente só-leitura. Auto-cura re-ancora e re-roda; nunca edita a saída.</p>
      {erro && <p className="mt-6 rounded bg-rose-950/60 p-3 text-sm text-rose-200">{erro}</p>}
      {!erro && rels === null && <p className="mt-6 text-sm text-zinc-500">carregando…</p>}
      {rels?.length === 0 && <p className="mt-6 text-sm text-zinc-400">Nenhuma execução ainda. A rotina roda pelo cron (POST /api/octa/evals/run).</p>}
      <ul className="mt-6 space-y-3">
        {rels?.map((r) => (
          <li key={r.agente} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${COR[r.status]}`} aria-label={r.status} />
              <strong>{r.agente}</strong>
              <span className="ml-auto text-xs text-zinc-400">{new Date(r.em).toLocaleString("pt-BR")}</span>
            </div>
            <p className="mt-2 text-sm">PASS {(r.taxaPass * 100).toFixed(0)}% · drift {r.drift == null ? "—" : `${(r.drift * 100).toFixed(1)} pp`}</p>
            {r.alerta && <p className="mt-1 text-sm text-rose-300">{r.alerta}</p>}
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {r.resultados.filter((x) => !x.veredito.pass || x.curadoCom).map((x) => (
                <li key={x.fixture}>
                  {x.veredito.pass ? "↻ curado" : "✖"} <code>{x.fixture}</code>: {x.veredito.motivo}
                  {x.curadoCom && <> (re-ancorado com {JSON.stringify(x.curadoCom)})</>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
