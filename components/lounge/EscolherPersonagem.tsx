"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { coresDoGenero, type Genero, type Personagem } from "@/lib/cyber/personagem";

const PreviaPersonagem = dynamic(() => import("./PreviaPersonagem"), { ssr: false });

/**
 * ESCOLHER PERSONAGEM — o passo depois do nome de usuário, antes do jogo (app/lounge-cosmico): o GÊNERO (a astronauta
 * ou o astronauta) e a COR (só as da lista daquele gênero — lib/cyber/personagem), com a prévia 3D girando. Grava em
 * /api/user/personagem.
 */
export default function EscolherPersonagem({ inicial, aoConcluir }: { inicial: Personagem | null; aoConcluir: () => void }) {
  const [genero, setGenero] = useState<Genero>(inicial?.genero ?? "f");
  const [cores, setCores] = useState<Record<Genero, string>>(() => ({
    f: inicial?.genero === "f" ? inicial.cor : coresDoGenero("f")[0]!.cor,
    m: inicial?.genero === "m" ? inicial.cor : coresDoGenero("m")[0]!.cor,
  }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const opcoes = coresDoGenero(genero), cor = cores[genero];

  async function entrar() {
    setErro(""); setSalvando(true);
    try {
      const r = await fetch("/api/user/personagem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ genero, cor }) });
      if (!r.ok) { setErro(((await r.json().catch(() => null)) as { error?: string } | null)?.error || "Não foi possível salvar agora."); return; }
      aoConcluir();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#03030a] px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl border border-cyan-500/25 bg-white/[0.04] p-5 text-left backdrop-blur sm:p-6">
        <h1 className="text-xl font-semibold text-white">Escolha seu personagem</h1>
        <p className="mt-1 text-sm text-white/60">É assim que você aparece para os outros no jogo.</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_1.1fr]">
          <div className="relative h-72 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#0b1030] to-[#03030a] sm:h-auto sm:min-h-[22rem]">
            <PreviaPersonagem personagem={{ genero, cor }} />
          </div>

          <div className="flex flex-col">
            <fieldset>
              <legend className="text-sm font-medium text-white/80">Gênero</legend>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gênero">
                {([["f", "Feminino"], ["m", "Masculino"]] as const).map(([g, rotulo]) => (
                  <button key={g} type="button" role="radio" aria-checked={genero === g} onClick={() => setGenero(g)}
                    className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition ${genero === g ? "border-cyan-400 bg-cyan-400/15 text-white" : "border-white/15 bg-black/30 text-white/70 hover:border-white/30"}`}>
                    {rotulo}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-white/80">Cor</legend>
              <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Cor">
                {opcoes.map((o) => (
                  <button key={o.nome} type="button" role="radio" aria-checked={cor === o.cor} aria-label={o.rotulo} title={o.rotulo}
                    onClick={() => setCores((c) => ({ ...c, [genero]: o.cor }))}
                    className={`flex min-h-[44px] items-center justify-center rounded-xl border transition ${cor === o.cor ? "border-white ring-2 ring-cyan-400" : "border-white/15 hover:border-white/40"}`}>
                    <span className="h-6 w-6 rounded-full border border-black/30" style={{ background: o.cor }} />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/50">{opcoes.find((o) => o.cor === cor)?.rotulo}</p>
            </fieldset>

            {erro && <p role="alert" className="mt-4 text-sm text-rose-300">{erro}</p>}
            <button type="button" onClick={entrar} disabled={salvando}
              className="mt-auto min-h-[44px] w-full rounded-full bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60 sm:mt-6">
              {salvando ? "Salvando…" : "Entrar no jogo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
