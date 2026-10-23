"use client";
/**
 * FiguraIso — a MÁQUINA do tema (lib/blueprint/maquina), desenhada com o kit do anatomy (wheresryan22/anatomy, MIT):
 * um objeto real cujo mecanismo é o conceito, com a legenda e a frase do objeto EMBAIXO (nada de rótulo solto no
 * desenho). Os temas são as variáveis do próprio kit (`.iso`): no blueprint, tinta ciano no papel azul; na cartolina,
 * tinta marrom no papel creme, com o traço tremido do filtro #rabisco.
 */
import { useMemo } from "react";
import { ISO_CSS } from "@/lib/anatomy/iso-kit";
import { montarMaquina, FORMAS } from "@/lib/blueprint/maquina";
import type { DocBlueprint } from "@/lib/blueprint/tipos";
import { MAO, PAPEL, useSkin } from "./skin";

/** os dois temas da prancha, nas variáveis do kit */
const TEMAS = `
.iso[data-theme="blueprint"]{--anatomy-paper:#0f3a64;--anatomy-face:#15497b;--anatomy-top:#1a548a;--anatomy-shade-0:#0b2d4f;--anatomy-shade-1:#0d3359;--anatomy-shade-2:#103a63;--anatomy-shade-3:#13416f;
  --anatomy-lit-top:#1f6a9e;--anatomy-lit-shade:#185a88;--anatomy-hi:#e8f6ff;--anatomy-mid:#8cc4e6;--anatomy-lo:#4f86b0;--anatomy-faint:#2d5f8a;--anatomy-lit:#7fe0ff;
  --anatomy-halo:#03101f;--anatomy-halo-opacity:.75;--anatomy-dot:#d6f0ff;--anatomy-red:#ff4d5e;--anatomy-green:#7dffb0;--anatomy-weight:.9px}
.iso[data-theme="cartolina"]{--anatomy-paper:#f7efdd;--anatomy-face:#fffaf0;--anatomy-top:#fbf5e7;--anatomy-shade-0:#ddcfae;--anatomy-shade-1:#e6dabd;--anatomy-shade-2:#eee4cc;--anatomy-shade-3:#f4ecd9;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#efe4c8;--anatomy-hi:#3a2f1e;--anatomy-mid:#7d6644;--anatomy-lo:#ad9670;--anatomy-faint:#d2c19c;--anatomy-lit:#0e7490;
  --anatomy-halo:#8a7350;--anatomy-halo-opacity:.3;--anatomy-dot:#3a2f1e;--anatomy-red:#c0392b;--anatomy-green:#2e7d32;--anatomy-weight:1.1px}
.iso[data-theme="cartolina"] .iso-svg{filter:url(#rabisco)}
.iso[data-theme="cartolina"] .iso-face-text{font-family:${MAO.replace(/"/g, "'")}}
`;
const COR_ESTADO = { ok: { blueprint: "#7dffb0", cartolina: "#2e7d32" }, trava: { blueprint: "#ff4d5e", cartolina: "#c0392b" }, futuro: { blueprint: "rgba(186,230,253,.55)", cartolina: PAPEL.tintaSuave } } as const;

export default function FiguraIso({ doc }: { doc: DocBlueprint }) {
  const skin = useSkin(), tema = skin === "cartolina" ? "cartolina" : "blueprint";
  const m = useMemo(() => montarMaquina(doc), [doc]);
  if (!m) return null;
  const tinta = skin === "cartolina" ? PAPEL.tinta : "#e8f6ff", suave = skin === "cartolina" ? PAPEL.tintaSuave : "rgba(186,230,253,.72)";
  return (
    <div className="iso" data-theme={tema}>
      <style>{ISO_CSS + TEMAS}</style>
      <svg className="iso-svg" viewBox={`0 0 ${m.largura} ${m.altura}`} role="img" aria-label={`A máquina do tema: ${m.legenda.map((l) => `${l.codigo} ${l.nome}`).join(", ")}`}
        style={{ maxHeight: 470 }} dangerouslySetInnerHTML={{ __html: m.svg }} />
      {doc.objeto && <p className="mx-auto mt-1 max-w-[640px] text-center text-[14px] italic" style={{ color: suave }}>{doc.objeto}</p>}
      {/* a LEGENDA (o anatomy põe o que é cada peça embaixo, não no desenho) */}
      <ol className="mx-auto mt-2 grid max-w-[700px] grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {m.legenda.map((l) => (
          <li key={l.n} className="flex items-baseline gap-2 text-[13px] leading-snug" style={{ color: tinta }} title={FORMAS[l.forma]}>
            <span className="font-mono text-[12px] font-bold" style={{ color: COR_ESTADO[l.estado][tema] }}>{String(l.n).padStart(2, "0")}</span>
            <span><b>{l.nome}</b>{l.estado === "ok" ? " ✓" : l.estado === "trava" ? " ✕" : ""}{l.sub ? <span style={{ color: suave }}> — {l.sub}</span> : null}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
