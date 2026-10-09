"use client";

/**
 * CredencialCard — o "selo visual" de uma credencial verificável: o quê (título), por quem foi
 * validada, quando, e a proveniência (asset na Solana → explorer). Espelha o que
 * app/api/academic/[id]/verificar grava (verifiedById/verifiedAt) e o que lib/solana/credentials.ts
 * cunha (assetId/issuedAt). Serve pra dado real (perfil) e pra ilustração (Sobre nós, `ilustrativo`).
 *
 * Privacidade: o card mostra só o que já é público na credencial — nunca documento, e-mail ou
 * carteira completa (o endereço aparece abreviado).
 */
import SolanaMark from "./SolanaMark";
import IconeCredencial from "./IconesCredencial";

export type CredencialCardProps = {
  titulo: string;
  /** "Habilidade dominada" · "Título acadêmico verificado" · … */
  tipo?: string;
  /** quem chancelou (professor vinculado / instituição); opcional */
  validadoPor?: string | null;
  /** ISO ou Date */
  emitidaEm?: string | Date | null;
  /** asset id na Solana (cNFT / token-2022); opcional */
  assetId?: string | null;
  explorerUrl?: string | null;
  rede?: string | null;
  /** "issued" | "minting" | "pending" | "error" | "verificado" | … */
  status?: string | null;
  /** true = mockup do Sobre nós (não há dado real por trás) */
  ilustrativo?: boolean;
  className?: string;
};

export function abreviar(id: string, n = 4) {
  return id.length <= n * 2 + 1 ? id : `${id.slice(0, n)}…${id.slice(-n)}`;
}

function dataPt(d?: string | Date | null) {
  if (!d) return null;
  const x = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? null : x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CredencialCard({ titulo, tipo = "Credencial verificável", validadoPor, emitidaEm, assetId, explorerUrl, rede, status, ilustrativo, className }: CredencialCardProps) {
  const emitida = status === "issued" || status === "verificado" || (!status && !!assetId);
  const aCaminho = status === "minting" || status === "pending";
  const data = dataPt(emitidaEm);
  return (
    <article
      aria-label={`Credencial: ${titulo}`}
      className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070a1a] text-white shadow-[0_30px_80px_-30px_rgba(34,211,238,0.35)] ${className ?? ""}`}
    >
      {/* brilho */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-[80px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-[80px]" />

      <div className="relative p-6 md:p-7 flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
              <IconeCredencial name="credencial" size={22} />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-300/90">{tipo}</p>
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40">Zaeon · emissora</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">
            <SolanaMark size={9} title="" /> Solana{rede ? ` · ${rede}` : ""}
          </span>
        </header>

        <h3 className="text-xl md:text-2xl font-black leading-tight tracking-tight">{titulo}</h3>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <dt className="text-[8px] font-black uppercase tracking-[0.25em] text-white/40">O quê</dt>
            <dd className="mt-1 font-semibold text-white/90 line-clamp-2">{tipo}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <dt className="text-[8px] font-black uppercase tracking-[0.25em] text-white/40">Validado por</dt>
            <dd className="mt-1 font-semibold text-white/90 line-clamp-2">{validadoPor || (emitida ? "revisor humano habilitado" : "—")}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <dt className="text-[8px] font-black uppercase tracking-[0.25em] text-white/40">Quando</dt>
            <dd className="mt-1 font-semibold text-white/90">{data ?? (aCaminho ? "registrando…" : "—")}</dd>
          </div>
        </dl>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/40">Proveniência</p>
            {assetId ? (
              explorerUrl ? (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40">
                  {abreviar(assetId, 6)} ↗
                </a>
              ) : (
                <span className="font-mono text-[11px] text-cyan-300">{abreviar(assetId, 6)}</span>
              )
            ) : (
              <span className="font-mono text-[11px] text-white/50">{aCaminho ? "asset em cunhagem" : "sem registro on-chain"}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-300"><IconeCredencial name="hash" size={10} /> à prova de adulteração</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-cyan-300"><IconeCredencial name="portavel" size={10} /> portável</span>
          </div>
        </footer>

        {ilustrativo && (
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/35">exemplo ilustrativo · o seu aparece no perfil</p>
        )}
      </div>
    </article>
  );
}
