/**
 * Frota de IAs — a CONFIGURAÇÃO salva (PURO): os lotes da frota + as chaves ON/OFF (o painel "Deploy agents" do Modo
 * CEO grava; os clientes e o servidor leem). Fica no banco em SystemSetting (chave `frota-ia`), como JSON. `versao` muda a
 * cada gravação (o cache do plano do dia é por versão). Tudo que vem de fora passa por `sanitizarConfig`.
 */
import { FLAGS_PADRAO, type FlagsFrota } from "./agenda";
import { FROTA_PADRAO, type ConfigFrota, type LoteFrota } from "./frota";

export const CHAVE_CONFIG = "frota-ia";
export type ConfigSalva = { frota: ConfigFrota; flags: FlagsFrota; versao: number };
export const CONFIG_PADRAO: ConfigSalva = { frota: FROTA_PADRAO, flags: FLAGS_PADRAO, versao: 1 };
/** limites do painel */
export const LIMITES = { totalMax: 5000, loteMax: 2000, lotesMax: 20 } as const;

const num = (v: unknown, a: number, b: number, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : padrao);
function loteDe(v: unknown): LoteFrota | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const semente = Math.floor(num(o.semente, 1, 2 ** 31, 0)), total = Math.floor(num(o.total, 0, LIMITES.loteMax, -1));
  if (!semente || total < 0) return null;
  return { semente, total, fracaoMulheres: num(o.fracaoMulheres, 0, 1, 0.6), fracaoCloak: num(o.fracaoCloak, 0, 1, 0.7) };
}
/** limpa uma config vinda do banco ou do painel (o que estiver errado volta ao padrão) */
export function sanitizarConfig(v: unknown): ConfigSalva {
  const o = (v ?? {}) as Record<string, unknown>, f = (o.frota ?? {}) as Record<string, unknown>, fl = (o.flags ?? {}) as Record<string, unknown>;
  let lotes = (Array.isArray(f.lotes) ? f.lotes : FROTA_PADRAO.lotes).map(loteDe).filter((l): l is LoteFrota => !!l).slice(0, LIMITES.lotesMax);
  const sementes = new Set<number>(); lotes = lotes.filter((l) => (sementes.has(l.semente) ? false : (sementes.add(l.semente), true)));
  let soma = 0; lotes = lotes.filter((l) => (soma + l.total <= LIMITES.totalMax ? ((soma += l.total), true) : false));
  const flags = Object.fromEntries((Object.keys(FLAGS_PADRAO) as (keyof FlagsFrota)[]).map((k) => [k, typeof fl[k] === "boolean" ? fl[k] : FLAGS_PADRAO[k]])) as FlagsFrota;
  return { frota: { lotes, tamanhoGrupo: Math.floor(num(f.tamanhoGrupo, 2, 8, 4)) }, flags, versao: Math.floor(num(o.versao, 1, 1e12, 1)) };
}
/** um LOTE NOVO (criação em massa): semente nova (diferente das existentes), N agentes, 60/40, 70% cloak */
export function novoLote(c: ConfigSalva, total: number, semente: number): ConfigSalva {
  let s = Math.max(1, Math.floor(semente)); const usadas = new Set(c.frota.lotes.map((l) => l.semente));
  while (usadas.has(s)) s++;
  return sanitizarConfig({ ...c, frota: { ...c.frota, lotes: [...c.frota.lotes, { semente: s, total, fracaoMulheres: 0.6, fracaoCloak: 0.7 }] } });
}
export const totalDaFrota = (c: ConfigSalva) => c.frota.lotes.reduce((n, l) => n + l.total, 0);
