/**
 * Frota de IAs — o lado do SERVIDOR (só servidor): a config salva (SystemSetting `frota-ia`), o plano/episódios do dia
 * (cacheados por versão da config), o texto das conversas (FrotaConversa — gerado uma vez por episódio) e o registro das
 * falas vistas (FrotaFala — a regra de ouro). A IA é a do harness do cyberespaço (lib/cyber/ia/motor: modelo leve).
 */
import { prisma } from "@/src/lib/prisma";
import { falarJson } from "@/lib/cyber/ia/motor";
import { CHAVE_CONFIG, CONFIG_PADRAO, aplicarMigracoes, sanitizarConfig, type ConfigSalva } from "./config";
import { gerarFrota, type AgenteIA } from "./frota";
import { planejarDia, type PlanoDia } from "./plano";
import { episodiosDoDia, type Episodio } from "./conversas";
import { fullNoDia } from "./agenda";
import type { DepsTexto } from "./texto";

let cacheConfig: { em: number; c: ConfigSalva } | null = null;
/** a config (cache de 15 s) */
export async function lerConfig(): Promise<ConfigSalva> {
  if (cacheConfig && Date.now() - cacheConfig.em < 15_000) return cacheConfig.c;
  let c = CONFIG_PADRAO;
  try {
    const s = await prisma.systemSetting.findUnique({ where: { key: CHAVE_CONFIG } });
    if (s) {
      // a config SALVA: aplica as migrações que faltam (uma vez) e grava (a versão sobe: os clientes recalculam o dia)
      const m = aplicarMigracoes(sanitizarConfig(JSON.parse(s.value)));
      c = m.c;
      if (m.mudou) { c = { ...c, versao: c.versao + 1 }; await prisma.systemSetting.update({ where: { key: CHAVE_CONFIG }, data: { value: JSON.stringify(c) } }); }
    }
  } catch { /* sem banco: o padrão */ }
  cacheConfig = { em: Date.now(), c }; return c;
}
export async function salvarConfig(c: ConfigSalva): Promise<ConfigSalva> {
  // as migrações já aplicadas FICAM (mesmo que o painel mande uma config sem elas) — senão um lote apagado voltava
  const atual = await lerConfig(), nova = sanitizarConfig({ ...c, versao: atual.versao + 1, migracoes: [...new Set([...atual.migracoes, ...(c.migracoes ?? [])])] });
  await prisma.systemSetting.upsert({ where: { key: CHAVE_CONFIG }, create: { key: CHAVE_CONFIG, value: JSON.stringify(nova) }, update: { value: JSON.stringify(nova) } });
  cacheConfig = { em: Date.now(), c: nova }; return nova;
}

type Dia = { frota: AgenteIA[]; porId: Map<string, AgenteIA>; plano: PlanoDia; episodios: Map<string, Episodio> };
const cacheDia = new Map<string, Dia>();
/** a frota, o plano e os episódios de um dia (cacheados por versão+dia; ~0,3 s na 1ª vez) */
export function diaDaFrota(c: ConfigSalva, dia: number): Dia {
  const k = `${c.versao}|${dia}|${fullNoDia(dia, c.modoFullAte) ? 1 : 0}`; let d = cacheDia.get(k);
  if (d) return d;
  const frota = gerarFrota(c.frota), plano = planejarDia(frota, dia, c.flags, fullNoDia(dia, c.modoFullAte));
  d = { frota, porId: new Map(frota.map((a) => [a.id, a])), plano, episodios: new Map(episodiosDoDia(plano, c.flags).map((e) => [e.id, e])) };
  cacheDia.set(k, d); while (cacheDia.size > 4) cacheDia.delete(cacheDia.keys().next().value!);
  return d;
}

/** as dependências reais do texto: a IA do cyberespaço + o registro FrotaFala */
export const depsTexto = (userId: string | null): DepsTexto => ({
  ia: (p) => falarJson<unknown>({ system: p.system, user: p.user, agente: "frota", userId, temperatura: p.temperatura }),
  jaVistas: async (imps) => {
    if (!imps.length) return new Set();
    const r = await prisma.frotaFala.findMany({ where: { impressao: { in: imps } }, select: { impressao: true } });
    return new Set(r.map((x) => x.impressao));
  },
  anotar: async (imps) => {
    const ja = new Set<string>();
    for (const impressao of imps) { try { await prisma.frotaFala.create({ data: { impressao } }); } catch { ja.add(impressao); } }   // (índice único: já existia = corrida)
    return ja;
  },
});
