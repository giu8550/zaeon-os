/**
 * lib/aura/rules.ts — ÚNICO lugar com os números da economia AURA (PURO).
 * Tunar aqui, nunca nos call sites. AURA cresce com VERIFICAÇÃO, não com volume:
 * validado ≫ aplicado ≫ aprendido; cérebro completo é bônus; título acadêmico só com documento.
 */
export type AuraSource =
  | "node_learned" | "node_applied" | "node_validated" | "brain_completed"
  | "credential_verified" | "edu_link" | "legacy_xp" | "reversal";

export const AURA: Record<Exclude<AuraSource, "credential_verified" | "edu_link" | "legacy_xp" | "reversal">, number> = {
  node_learned: 5,      // nó vira "aprendido"
  node_applied: 15,     // nó vira "aplicado"
  node_validated: 50,   // nó "validado" pelo prof (+ atestado Solana) ← a moeda real
  brain_completed: 200, // TODO o backbone do cérebro validado (bônus)
};

/** Fontes de baixo rigor levam soft-cap diário (anti-grind de nós triviais). */
export const SOFT_CAP_DIARIO: Partial<Record<AuraSource, number>> = { node_learned: 20 };
export function dentroDoCapDiario(source: AuraSource, concedidosHoje: number): boolean {
  const cap = SOFT_CAP_DIARIO[source];
  return cap === undefined || concedidosHoje < cap;
}

// ───────────── níveis (derivados do saldo; nunca campo solto) ─────────────
export const NIVEIS: readonly { min: number; titulo: string }[] = [
  { min: 0, titulo: "Iniciante" },
  { min: 150, titulo: "Aprendiz" },
  { min: 400, titulo: "Praticante" },
  { min: 900, titulo: "Especialista" },
  { min: 1800, titulo: "Mestre" },
  { min: 3600, titulo: "Referência" },
];

export type NivelInfo = { level: number; titulo: string; /** AURA que falta pro próximo nível; null no topo */ prox: number | null; min: number; proxMin: number | null };

export function levelFromAura(aura: number): NivelInfo {
  const a = Number.isFinite(aura) ? Math.max(0, Math.floor(aura)) : 0;
  let i = 0;
  for (let k = 0; k < NIVEIS.length; k++) if (a >= NIVEIS[k]!.min) i = k;
  const atual = NIVEIS[i]!, proximo = NIVEIS[i + 1] ?? null;
  return { level: i + 1, titulo: atual.titulo, min: atual.min, proxMin: proximo?.min ?? null, prox: proximo ? proximo.min - a : null };
}

// ───────────── credencial acadêmica: nível = peso, método = portão ─────────────
export const NIVEIS_ACADEMICOS = ["tecnico", "graduacao", "especializacao", "mestrado", "doutorado", "posdoc"] as const;
export type NivelAcademico = (typeof NIVEIS_ACADEMICOS)[number];
export const isNivelAcademico = (v: unknown): v is NivelAcademico => typeof v === "string" && (NIVEIS_ACADEMICOS as readonly string[]).includes(v);

export const AURA_NIVEL: Record<NivelAcademico, number> = {
  tecnico: 60, graduacao: 120, especializacao: 200, mestrado: 350, doutorado: 600, posdoc: 800,
};
/** Vínculo institucional (edu_email) confirma vínculo, não o diploma → AURA fixa pequena. */
export const AURA_VINCULO = 20;

export const METODOS = ["declarado", "edu_email", "doc_review", "registry", "onchain"] as const;
export type MetodoVerificacao = (typeof METODOS)[number];
export const isMetodo = (v: unknown): v is MetodoVerificacao => typeof v === "string" && (METODOS as readonly string[]).includes(v);

/** Quanto da base o método libera: declarado 0 · edu_email fixo pequeno · doc_review/registry/onchain base cheia. */
export function auraPorCredencial(nivel: NivelAcademico, metodo: MetodoVerificacao): number {
  switch (metodo) {
    case "declarado": return 0;
    case "edu_email": return AURA_VINCULO;
    case "doc_review": case "registry": case "onchain": return AURA_NIVEL[nivel];
  }
}
/** Selo visual do método (UI): ouro só pra checagem oficial/atestado. */
export const seloDoMetodo = (metodo: MetodoVerificacao): "nenhum" | "vinculo" | "verificado" | "ouro" =>
  metodo === "declarado" ? "nenhum" : metodo === "edu_email" ? "vinculo" : metodo === "doc_review" ? "verificado" : "ouro";

/** Rótulo humano do nível (vira `User.academicLevel`, derivado do MAIOR nível verificado). */
export const ROTULO_NIVEL: Record<NivelAcademico, string> = {
  tecnico: "Técnico", graduacao: "Graduação", especializacao: "Especialização", mestrado: "Mestrado", doutorado: "Doutorado", posdoc: "Pós-Doutorado",
};
export function maiorNivel(niveis: NivelAcademico[]): NivelAcademico | null {
  let best: NivelAcademico | null = null;
  for (const n of niveis) if (best === null || NIVEIS_ACADEMICOS.indexOf(n) > NIVEIS_ACADEMICOS.indexOf(best)) best = n;
  return best;
}

/** Flag da economia (server e cliente): tudo off por padrão. */
export const auraEnabled = (): boolean => process.env.AURA_ECONOMY === "1" || process.env.NEXT_PUBLIC_AURA_ECONOMY === "1";
