"use client";

/**
 * MoleculeView — a molécula girando dentro da bolha do chat.
 *
 * O SDF vem do PubChem (coordenadas reais) e o 3Dmol.js só desenha. A biblioteca é UMD e
 * mexe em `window`, então o import é DINÂMICO e só depois da montagem — em SSR ela quebra.
 *
 * Três estilos porque cada um responde uma pergunta diferente: vareta mostra as ligações,
 * bola-e-vareta mostra quem é quem, esfera mostra o volume que a molécula ocupa de verdade.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Atom, RotateCw, Pause, ExternalLink } from "lucide-react";

export type MoleculeData = {
  cid: number;
  termo: string;
  nomeResolvido?: string;
  formula: string;
  peso: string;
  iupac?: string;
  smiles?: string;
  sdf: string;
  tridimensional?: boolean;
  url?: string;
  fonte?: string;
};

type Estilo = "vareta" | "bola" | "esfera";

const ESTILOS: { id: Estilo; label: string; spec: any }[] = [
  { id: "vareta", label: "Varetas", spec: { stick: { radius: 0.15 } } },
  { id: "bola", label: "Bola e vareta", spec: { stick: { radius: 0.12 }, sphere: { scale: 0.25 } } },
  { id: "esfera", label: "Volume", spec: { sphere: { scale: 0.9 } } },
];

export default function MoleculeView({ data }: { data: MoleculeData }) {
  const box = useRef<HTMLDivElement | null>(null);
  const viewer = useRef<any>(null);
  const [estilo, setEstilo] = useState<Estilo>("bola");
  const [girando, setGirando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const aplicarEstilo = useCallback((id: Estilo) => {
    const v = viewer.current;
    if (!v) return;
    const spec = ESTILOS.find((e) => e.id === id)?.spec ?? ESTILOS[1].spec;
    v.setStyle({}, spec);
    v.render();
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // Import pelo nome do pacote (e não pelo caminho do build): o subpath não
        // carrega os tipos, e com `strict` ligado isso vira erro de build.
        const mod: any = await import("3dmol");
        const $3Dmol = mod?.createViewer ? mod : (mod?.default ?? (window as any).$3Dmol);
        if (!vivo || !box.current || !$3Dmol?.createViewer) return;
        // backgroundAlpha 0: o cartão do Studio aparece atrás, em claro e escuro.
        const v = $3Dmol.createViewer(box.current, { backgroundAlpha: 0 });
        v.addModel(data.sdf, "sdf");
        v.setStyle({}, ESTILOS[1].spec);
        v.zoomTo();
        v.render();
        v.spin(true);
        viewer.current = v;
      } catch {
        if (vivo) setErro("Não consegui desenhar a molécula neste navegador.");
      }
    })();
    return () => {
      vivo = false;
      try { viewer.current?.clear?.(); } catch { /* ignore */ }
      viewer.current = null;
    };
  }, [data.sdf]);

  const trocar = (id: Estilo) => { setEstilo(id); aplicarEstilo(id); };

  const girar = () => {
    const v = viewer.current;
    if (!v) return;
    const novo = !girando;
    v.spin(novo);
    setGirando(novo);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full h-[260px] rounded-2xl overflow-hidden bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
        <div ref={box} className="absolute inset-0" />
        {erro && (
          <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-500 dark:text-white/60 px-4 text-center">
            {erro}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ESTILOS.map((e) => (
          <button
            key={e.id}
            onClick={() => trocar(e.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              estilo === e.id
                ? "bg-black dark:bg-white text-white dark:text-black border-transparent"
                : "text-slate-700 dark:text-white/80 border-slate-200 dark:border-white/10 hover:border-cyan-400/50"
            }`}
          >
            {e.label}
          </button>
        ))}
        <button
          onClick={girar}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/10 hover:border-cyan-400/50 transition-colors"
        >
          {girando ? <Pause size={12} /> : <RotateCw size={12} />}
          {girando ? "Parar" : "Girar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-white/65">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-white/90">
          <Atom size={12} /> {data.formula}
        </span>
        <span>{data.peso} g/mol</span>
        {data.iupac && <span className="truncate max-w-[22rem]" title={data.iupac}>{data.iupac}</span>}
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors"
          >
            PubChem CID {data.cid} <ExternalLink size={10} />
          </a>
        )}
      </div>

      {data.tridimensional === false && (
        // Honestidade acima de estética: sem conformação 3D no PubChem o desenho sai
        // chapado, e deixar passar por 3D seria ensinar geometria errada.
        <p className="text-[11px] text-amber-600 dark:text-amber-400/90 leading-relaxed">
          O PubChem não tem conformação 3D para esta molécula — o que você vê é a estrutura
          plana (2D), correta nas ligações, mas sem a geometria espacial real.
        </p>
      )}
    </div>
  );
}
