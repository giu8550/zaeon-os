"use client";

/**
 * ControlesAreasFrota — os CONTROLES POR ÁREA da frota de IAs (lib/cyber/frota/agenda `AreasFrota`), do jeito que o
 * plano do dia permite hoje: a proporção do dia (estudo nas plataformas × no lounge; moto × pedestres na Zaeon), o peso de
 * cada lugar de estudo e a capacidade (chão do lounge, vagas por estacionamento). Usado no Modo CEO ("Deploy agents") e
 * no painel admin dentro do cyberespaço. Só edita o rascunho — quem grava é quem usa.
 */
import { AREAS_PADRAO, type AreasFrota } from "@/lib/cyber/frota/agenda";
import { LIMITES_AREAS } from "@/lib/cyber/frota/config";
import { AREAS, type AreaId } from "@/lib/cyber/frota/areas";

const NOME_LUGAR: Record<keyof AreasFrota["pesos"], string> = { univ: "UNILAB", ufc: "UFC", unifor: "Unifor", uece: "UECE", biblioteca: "Zaeon · biblioteca", jardim: "Zaeon · jardim" };
const pct = (v: number, total: number) => (total > 0 ? Math.round((100 * v) / total) : 0);

function Faixa({ rotulo, valor, max, passo = 1, onChange, sufixo }: { rotulo: string; valor: number; max: number; passo?: number; onChange: (v: number) => void; sufixo?: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold">{rotulo}</span><span className="tabular-nums opacity-70">{valor}{sufixo ? ` ${sufixo}` : ""}</span></span>
      <input type="range" min={0} max={max} step={passo} value={valor} onChange={(e) => onChange(Number(e.target.value))} aria-label={rotulo} className="mt-1 w-full accent-cyan-400" />
    </label>
  );
}

export default function ControlesAreasFrota({ areas, onChange }: { areas: AreasFrota; onChange: (a: AreasFrota) => void }) {
  const p = areas.proporcao, estudo = p.estudoPlataforma + p.estudoLounge, intervalo = p.moto + p.andar;
  const somaPesos = Object.values(areas.pesos).reduce((s, v) => s + v, 0);
  const prop = (k: keyof AreasFrota["proporcao"], v: number) => onChange({ ...areas, proporcao: { ...p, [k]: v } });
  const titulo = "mb-2 text-[10px] font-black uppercase tracking-widest opacity-60";
  return (
    <div className="space-y-5">
      <section>
        <h4 className={titulo}>Estudo: onde estudam</h4>
        <div className="space-y-3">
          <Faixa rotulo={`Nas plataformas de estudo · ${pct(p.estudoPlataforma, estudo)}% do estudo`} valor={p.estudoPlataforma} max={LIMITES_AREAS.proporcao} onChange={(v) => prop("estudoPlataforma", v)} />
          <Faixa rotulo={`Nos sofás do lounge · ${pct(p.estudoLounge, estudo)}% do estudo`} valor={p.estudoLounge} max={LIMITES_AREAS.proporcao} onChange={(v) => prop("estudoLounge", v)} />
        </div>
      </section>
      <section>
        <h4 className={titulo}>Intervalos: o que fazem</h4>
        <div className="space-y-3">
          <Faixa rotulo={`De moto pelo mapa · ${pct(p.moto, intervalo)}% dos intervalos`} valor={p.moto} max={LIMITES_AREAS.proporcao} onChange={(v) => prop("moto", v)} />
          <Faixa rotulo={`A pé na Zaeon (telões e salão) · ${pct(p.andar, intervalo)}%`} valor={p.andar} max={LIMITES_AREAS.proporcao} onChange={(v) => prop("andar", v)} />
        </div>
      </section>
      <section>
        <h4 className={titulo}>Peso de cada lugar de estudo (0 = ninguém)</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(NOME_LUGAR) as (keyof AreasFrota["pesos"])[]).map((k) => (
            <Faixa key={k} rotulo={`${NOME_LUGAR[k]} · ${pct(areas.pesos[k], somaPesos)}%`} valor={areas.pesos[k]} max={LIMITES_AREAS.peso} passo={0.5} onChange={(v) => onChange({ ...areas, pesos: { ...areas.pesos, [k]: v } })} />
          ))}
        </div>
      </section>
      <section>
        <h4 className={titulo}>Capacidade</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Faixa rotulo="Lugares no chão do lounge (além dos sofás)" valor={areas.loungeChao} max={LIMITES_AREAS.loungeChao} onChange={(v) => onChange({ ...areas, loungeChao: v })} />
          <Faixa rotulo="Vagas por estacionamento" valor={areas.vagas} max={LIMITES_AREAS.vagas} onChange={(v) => onChange({ ...areas, vagas: v })} />
        </div>
      </section>
      <button type="button" onClick={() => onChange(AREAS_PADRAO)} className="min-h-[36px] rounded-full border border-slate-400/30 px-4 text-xs font-semibold opacity-80 hover:opacity-100">Restaurar o padrão</button>
    </div>
  );
}

/** a tabela bots × usuários reais por área (os usuários por área só existem dentro do cyberespaço: `null` = "—") */
export function TabelaAreas({ linhas }: { linhas: Record<AreaId, { bots: number; usuarios: number | null }> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-[10px] uppercase tracking-widest opacity-60"><tr><th className="py-1">Área</th><th className="text-right">Bots</th><th className="text-right">Usuários reais</th></tr></thead>
      <tbody>
        {AREAS.map((a) => {
          const l = linhas[a.id];
          return (
            <tr key={a.id} className="border-t border-slate-400/20">
              <td className="py-1">{a.nome}</td>
              <td className="text-right tabular-nums">{l.bots}</td>
              <td className="text-right tabular-nums">{l.usuarios ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
