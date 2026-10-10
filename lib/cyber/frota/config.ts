/**
 * Frota de IAs — a CONFIGURAÇÃO salva (PURO): os lotes da frota + as chaves ON/OFF (o painel "Deploy agents" do Modo
 * CEO grava; os clientes e o servidor leem). Fica no banco em SystemSetting (chave `frota-ia`), como JSON. `versao` muda a
 * cada gravação (o cache do plano do dia é por versão). Tudo que vem de fora passa por `sanitizarConfig`.
 * MIGRAÇÕES (`MIGRACOES`): mudanças na frota que têm que chegar até numa config JÁ SALVA (ex.: o teto de 1500) — cada uma
 * aplica UMA vez (o id fica em `migracoes`) e o servidor grava o resultado (lib/cyber/frota/servidor `lerConfig`); se o
 * dono apagar o lote depois pelo painel, ele não volta.
 */
import { AMBIENTES_ESTUDO, AREAS_PADRAO, ambienteNoMapa, FLAGS_PADRAO, type AreasFrota, type FlagsFrota } from "./agenda";
import { FROTA_PADRAO, type ConfigFrota, type LoteFrota } from "./frota";

export const CHAVE_CONFIG = "frota-ia";
export type ConfigSalva = { frota: ConfigFrota; flags: FlagsFrota; versao: number; /** as migrações já aplicadas */ migracoes: string[];
  /** MODO FULL até (epoch ms): todo mundo online 24 h nos dias que começam antes disso (lib/cyber/frota/agenda `fullNoDia`) */
  modoFullAte: number | null;
  /** os CONTROLES POR ÁREA do painel admin (proporção do dia, peso de cada lugar de estudo, chão do lounge, vagas) */
  areas: AreasFrota };
/** limites do painel */
export const LIMITES = { totalMax: 1000, loteMax: 1000, lotesMax: 20 } as const;   // 1000 = o TETO do dono (desempenho; era 1500 até out/2026)

const num = (v: unknown, a: number, b: number, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : padrao);
function loteDe(v: unknown): LoteFrota | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const semente = Math.floor(num(o.semente, 1, 2 ** 31, 0)), total = Math.floor(num(o.total, 0, LIMITES.loteMax, -1));
  if (!semente || total < 0) return null;
  return { semente, total, fracaoMulheres: num(o.fracaoMulheres, 0, 1, 0.6), fracaoCloak: num(o.fracaoCloak, 0, 1, 0.7) };
}
/** limites dos controles por área (o que o código aguenta hoje: 220 lugares de chão no lounge — o pátio sem as motos —, 33 vagas por estacionamento) */
export const LIMITES_AREAS = { proporcao: 100, peso: 10, loungeChao: 220, vagas: 33 } as const;
/** limpa os controles por área (o que faltar ou vier errado fica no padrão) */
export function sanitizarAreas(v: unknown): AreasFrota {
  const o = (v ?? {}) as Record<string, unknown>, p = (o.proporcao ?? {}) as Record<string, unknown>, w = (o.pesos ?? {}) as Record<string, unknown>, P = AREAS_PADRAO;
  return {
    proporcao: { estudoPlataforma: num(p.estudoPlataforma, 0, LIMITES_AREAS.proporcao, P.proporcao.estudoPlataforma), estudoLounge: num(p.estudoLounge, 0, LIMITES_AREAS.proporcao, P.proporcao.estudoLounge), moto: num(p.moto, 0, LIMITES_AREAS.proporcao, P.proporcao.moto), andar: num(p.andar, 0, LIMITES_AREAS.proporcao, P.proporcao.andar) },
    pesos: Object.fromEntries(AMBIENTES_ESTUDO.map((k) => [k, ambienteNoMapa(k) ? num(w[k], 0, LIMITES_AREAS.peso, P.pesos[k]) : 0])) as AreasFrota["pesos"],   // (lugar fora do mapa: ninguém vai pra lá, mesmo com peso salvo)
    loungeChao: Math.floor(num(o.loungeChao, 0, LIMITES_AREAS.loungeChao, P.loungeChao)), vagas: Math.floor(num(o.vagas, 0, LIMITES_AREAS.vagas, P.vagas)),
  };
}
/** limpa uma config vinda do banco ou do painel (o que estiver errado volta ao padrão) */
export function sanitizarConfig(v: unknown): ConfigSalva {
  const o = (v ?? {}) as Record<string, unknown>, f = (o.frota ?? {}) as Record<string, unknown>, fl = (o.flags ?? {}) as Record<string, unknown>;
  let lotes = (Array.isArray(f.lotes) ? f.lotes : FROTA_PADRAO.lotes).map(loteDe).filter((l): l is LoteFrota => !!l).slice(0, LIMITES.lotesMax);
  const sementes = new Set<number>(); lotes = lotes.filter((l) => (sementes.has(l.semente) ? false : (sementes.add(l.semente), true)));
  let soma = 0; lotes = lotes.filter((l) => (soma + l.total <= LIMITES.totalMax ? ((soma += l.total), true) : false));
  const flags = Object.fromEntries((Object.keys(FLAGS_PADRAO) as (keyof FlagsFrota)[]).map((k) => [k, typeof fl[k] === "boolean" ? fl[k] : FLAGS_PADRAO[k]])) as FlagsFrota;
  const migracoes = Array.isArray(o.migracoes) ? [...new Set(o.migracoes.filter((x): x is string => typeof x === "string" && x.length <= 60))].slice(0, 50) : [];
  const modoFullAte = typeof o.modoFullAte === "number" && Number.isFinite(o.modoFullAte) ? o.modoFullAte : null;
  return { frota: { lotes, tamanhoGrupo: Math.floor(num(f.tamanhoGrupo, 2, 8, 4)) }, flags, versao: Math.floor(num(o.versao, 1, 1e12, 1)), migracoes, modoFullAte, areas: sanitizarAreas(o.areas) };
}
/** um LOTE NOVO (criação em massa): semente nova (diferente das existentes), N agentes, 60/40, 70% cloak */
export function novoLote(c: ConfigSalva, total: number, semente: number): ConfigSalva {
  let s = Math.max(1, Math.floor(semente)); const usadas = new Set(c.frota.lotes.map((l) => l.semente));
  while (usadas.has(s)) s++;
  return sanitizarConfig({ ...c, frota: { ...c.frota, lotes: [...c.frota.lotes, { semente: s, total, fracaoMulheres: 0.6, fracaoCloak: 0.7 }] } });
}
export const totalDaFrota = (c: ConfigSalva) => c.frota.lotes.reduce((n, l) => n + l.total, 0);

/** as MIGRAÇÕES da frota, em ordem (o id nunca muda depois de publicado) */
export const MIGRACOES: readonly { id: string; desc: string; aplicar(c: ConfigSalva): ConfigSalva }[] = [
  // (publicada na #318; com o teto de 1500 o lote de 1300 não cabe e o sanitizarConfig o descarta — o `teto-1500` refaz)
  { id: "2026-10-mais-1300", desc: "+1300 IAs no mesmo mundo (total 2000)", aplicar: (c) => novoLote(c, 1300, 2027) },
  // o dono quebrou a regra do horário: todo mundo online 24 h até o fim do dia 12/10/2026 (meia-noite de Fortaleza)
  { id: "2026-10-modo-full-ate-12", desc: "modo full (24 h) até 12/10", aplicar: (c) => ({ ...c, modoFullAte: Date.UTC(2026, 9, 13, 3, 0, 0) }) },
  // o TETO do dono: 1500 no total — completa com a MESMA semente do lote de +1300 (as primeiras 800 IAs dele continuam
  // as mesmas); vale pra config nova e pra que já tinha 2000 salvas (o sanitizar descarta o lote que estoura o teto)
  { id: "2026-10-teto-1500", desc: "teto de 1500 IAs (completa com o lote 2027)", aplicar: (c) => {
    const t = totalDaFrota(c); return t < LIMITES.totalMax && !c.frota.lotes.some((l) => l.semente === 2027) ? novoLote(c, LIMITES.totalMax - t, 2027) : c; } },
  // o dono baixou pra 1000 (performance). O sanitizar já descarta o lote que estoura o teto (o de 800 da semente 2027):
  // completa até 1000 com a MESMA semente 2027 — as primeiras 300 IAs dela continuam as mesmas pessoas
  { id: "2026-10-teto-1000", desc: "teto de 1000 IAs (performance)", aplicar: (c) => {
    const t = totalDaFrota(c); return t < LIMITES.totalMax ? novoLote(c, LIMITES.totalMax - t, 2027) : c; } },
];
/** aplica as migrações que faltam (cada uma uma vez); `mudou` = tem coisa nova pra gravar */
export function aplicarMigracoes(c: ConfigSalva): { c: ConfigSalva; mudou: boolean } {
  let out = c, mudou = false;
  for (const m of MIGRACOES) if (!out.migracoes.includes(m.id)) { out = { ...m.aplicar(out), migracoes: [...out.migracoes, m.id] }; mudou = true; }
  return { c: out, mudou };
}
/** a config de quando não há nada salvo: a frota base com as migrações já aplicadas */
export const CONFIG_PADRAO: ConfigSalva = aplicarMigracoes({ frota: FROTA_PADRAO, flags: FLAGS_PADRAO, versao: 1, migracoes: [], modoFullAte: null, areas: AREAS_PADRAO }).c;
