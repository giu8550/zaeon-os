/**
 * Cyberespaço — as CREDENCIAIS ACADÊMICAS FICTÍCIAS da frota (PURO), em LEVELS de 1 a 10 (pedido do dono, out/2026 —
 * os termos "graduando", "mestrando", "doutorando" saem do crachá e entra o level):
 *  - GRADUAÇÃO = level 1, 2 ou 3;
 *  - MESTRADO = level 4, 5 ou 6;
 *  - DOUTORADO (doutorando) = level 7, 8 ou 9;
 *  - PhD = level 10.
 * A Zaeon se organiza por essa hierarquia: logo depois dos pilares da capela ficam os level 10 (PhD), atrás deles os
 * level 7–9, depois os level 4–6 — cada um na sua CABINE DE ESTUDO (lib/cyber/ceu `FILEIRAS_CABINES`) — e, nas pontas,
 * os level 1–3, sem cabine, estudando no chão em volta das supertrees e das cabines, SÓ se comprovam que estão num
 * GRUPO DE ESTUDOS. Toda a frota tem level (quem não está na cidadela também — lib/cyber/frota/hierarquia).
 *
 * São FICTÍCIAS (`ficticia: true`) mas têm o MESMO formato da credencial de verdade (prisma `AcademicCredential`: nivel
 * graduacao|mestrado|doutorado, área, instituição, método, status). Não confundir com o "level" da AURA (lib/aura/rules,
 * Iniciante→Referência): aquele é do saldo de AURA de gente de verdade; este é o degrau acadêmico.
 */

/** o DEGRAU acadêmico (a chave interna de cada faixa de levels) */
export type Degrau = "graduando" | "mestrando" | "doutorando" | "phd";
/** a ordem da hierarquia: de dentro (junto dos pilares da capela) pra fora (as pontas) */
export const HIERARQUIA: readonly Degrau[] = ["phd", "doutorando", "mestrando", "graduando"];
/** os LEVELS de cada degrau */
export const LEVELS: Readonly<Record<Degrau, readonly number[]>> = { graduando: [1, 2, 3], mestrando: [4, 5, 6], doutorando: [7, 8, 9], phd: [10] };
export const LEVEL_MAX = 10;
/** o degrau de um level (1–3 graduação, 4–6 mestrado, 7–9 doutorado, 10 PhD) */
export function degrauDoLevel(level: number): Degrau {
  const l = Math.max(1, Math.min(LEVEL_MAX, Math.round(level)));
  return l >= 10 ? "phd" : l >= 7 ? "doutorando" : l >= 4 ? "mestrando" : "graduando";
}
/** um level do degrau, escolhido por um sorteio (determinístico: o mesmo sorteio dá o mesmo level) */
export const levelNoDegrau = (d: Degrau, sorteio: number) => { const ls = LEVELS[d]; return ls[(Math.abs(Math.floor(sorteio)) >>> 0) % ls.length]!; };

/** o nível da credencial de verdade (prisma `AcademicCredential.nivel`) de cada degrau (o programa em curso / o título) */
export type NivelAcademico = "doutorado" | "mestrado" | "graduacao";
export type GrupoDeEstudos = { id: string; nome: string; tema: string; membros: number };

/** o MODELO de cada degrau: os levels, onde a pessoa fica na cidadela e o que é exigido pra credencial valer lá */
export type ModeloCredencial = {
  degrau: Degrau; levels: readonly number[]; nivelAcademico: NivelAcademico;
  /** o rótulo curto do degrau (só o PhD aparece no crachá; os outros são só o level) */
  rotulo: string;
  /** a cor do degrau (a placa da cabine, a borda do crachá) */
  cor: string;
  /** tem CABINE DE ESTUDO (e em que fileira, a partir da capela) */
  cabine: boolean; fileira: number | null;
  /** quantos há na cidadela */
  vagas: number;
  /** a fração que tem ROTINA fora do lugar (sai, passeia, vai pras outras áreas); o resto só fica logado no
   *  laboratório — aparece no lugar em status "estudando" e nunca entra no cyberespaço de verdade */
  rotina: number;
  /** o que tem que estar comprovado pra credencial valer na cidadela */
  exige: readonly ("titulo" | "vinculo" | "grupoDeEstudos")[];
};

/** os modelos (o pedido do dono: 18 doutores — 9 PhD + 9 doutorandos —, 34 de mestrado e 75 de graduação; 30% dos
 *  doutores e 70% dos de mestrado e graduação com rotina fora do lugar) */
export const MODELOS_CREDENCIAL: Readonly<Record<Degrau, ModeloCredencial>> = {
  phd: { degrau: "phd", levels: LEVELS.phd, nivelAcademico: "doutorado", rotulo: "PhD", cor: "#ffd27a", cabine: true, fileira: 0, vagas: 9, rotina: 0.3, exige: ["titulo", "vinculo"] },
  doutorando: { degrau: "doutorando", levels: LEVELS.doutorando, nivelAcademico: "doutorado", rotulo: "Doutorado", cor: "#c49bff", cabine: true, fileira: 1, vagas: 9, rotina: 0.3, exige: ["vinculo"] },
  mestrando: { degrau: "mestrando", levels: LEVELS.mestrando, nivelAcademico: "mestrado", rotulo: "Mestrado", cor: "#6fe3ff", cabine: true, fileira: 2, vagas: 34, rotina: 0.7, exige: ["vinculo"] },
  graduando: { degrau: "graduando", levels: LEVELS.graduando, nivelAcademico: "graduacao", rotulo: "Graduação", cor: "#8dffb0", cabine: false, fileira: null, vagas: 75, rotina: 0.7, exige: ["vinculo", "grupoDeEstudos"] },
};
/** quantos DOUTORES (PhD + doutorandos) há na cidadela */
export const DOUTORES_NA_CIDADELA = MODELOS_CREDENCIAL.phd.vagas + MODELOS_CREDENCIAL.doutorando.vagas;

/** as instituições das credenciais (as do mapa) */
export const INSTITUICOES = ["UNILAB", "UFC", "UECE", "Unifor", "IFCE"] as const;

/** a CREDENCIAL (o mesmo formato da `AcademicCredential` + o que a frota usa) */
export type CredencialAcademica = {
  /** o código da credencial (ex.: "ZC-L10-0003") */
  id: string;
  /** de quem é (o id do agente da frota, ou do usuário) */
  dono: string;
  /** o LEVEL (1–10) e o degrau dele */
  level: number; degrau: Degrau; nivelAcademico: NivelAcademico;
  /** a área (o curso) e a instituição */
  area: string; instituicao: string;
  /** o ano em que o título saiu (PhD) ou o de ingresso (os outros) */
  ano: number;
  /** como foi comprovada e o status (os mesmos valores da credencial de verdade) */
  metodo: "registry" | "doc_review" | "edu_email"; status: "verificado" | "pendente";
  /** o GRUPO DE ESTUDOS comprovado (level 1–3 só fica na cidadela com um) */
  grupoDeEstudos: GrupoDeEstudos | null;
  /** é fictícia (dos bots) */
  ficticia: boolean;
};

/** monta uma credencial FICTÍCIA (determinística: os mesmos dados dão a mesma credencial); `level` opcional — sem ele,
 *  sorteia um dentro da faixa do degrau */
export function credencialFicticia(o: { dono: string; degrau: Degrau; area: string; seq: number; sorteio: number; level?: number; grupo?: GrupoDeEstudos | null }): CredencialAcademica {
  const M = MODELOS_CREDENCIAL[o.degrau], s = Math.abs(Math.floor(o.sorteio)) >>> 0;
  const level = o.level !== undefined && M.levels.includes(o.level) ? o.level : levelNoDegrau(o.degrau, s >>> 3);
  const instituicao = INSTITUICOES[s % INSTITUICOES.length]!;
  // o ano: o PhD saiu entre 2008 e 2017; quem está cursando entrou há pouco (mais level = entrou antes)
  const ano = o.degrau === "phd" ? 2008 + (s % 10) : 2026 - (level - M.levels[0]!) - (s % 2);
  return {
    id: `ZC-L${String(level).padStart(2, "0")}-${String(o.seq + 1).padStart(4, "0")}`, dono: o.dono,
    level, degrau: o.degrau, nivelAcademico: M.nivelAcademico, area: o.area, instituicao, ano,
    metodo: o.degrau === "phd" ? "registry" : o.degrau === "graduando" ? "edu_email" : "doc_review", status: "verificado",
    grupoDeEstudos: o.degrau === "graduando" ? o.grupo ?? null : null, ficticia: true,
  };
}

/** a credencial vale na cidadela? verificada e com o que o modelo exige — level 1–3 só com grupo de estudos (de 2+) */
export function podeFicarNaCidadela(c: CredencialAcademica | null | undefined): boolean {
  if (!c || c.status !== "verificado") return false;
  if (MODELOS_CREDENCIAL[c.degrau].exige.includes("grupoDeEstudos")) return !!c.grupoDeEstudos && c.grupoDeEstudos.membros >= 2;
  return true;
}
/** o selo do level no crachá: "Lv 3", "Lv 10 · PhD" */
export const seloDoLevel = (c: Pick<CredencialAcademica, "level">) => (c.level >= LEVEL_MAX ? `Lv ${c.level} · PhD` : `Lv ${c.level}`);
/** a linha do crachá: "Lv 10 · PhD · Ana Lima" / "Lv 2 · Pedro Arruda" */
export const nomeComTitulo = (c: CredencialAcademica, nome: string) => `${seloDoLevel(c)} · ${nome}`;
/** o resumo da credencial (o subtítulo do crachá): "Física · UFC" / "Direito · GE Hipátia" */
export const resumoDaCredencial = (c: CredencialAcademica) => `${c.area} · ${c.grupoDeEstudos ? c.grupoDeEstudos.nome : c.instituicao}`;
