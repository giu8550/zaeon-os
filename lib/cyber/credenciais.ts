/**
 * Cyberespaço — as CREDENCIAIS ACADÊMICAS FICTÍCIAS da cidadela (PURO). A Zaeon se organiza por hierarquia acadêmica
 * (pedido do dono, out/2026): logo depois dos pilares da capela ficam os PROFESSORES (doutorado), atrás deles os
 * DOUTORES, depois os MESTRANDOS — cada um na sua CABINE DE ESTUDO (lib/cyber/ceu `FILEIRAS_CABINES`) — e, nas pontas,
 * os GRADUANDOS, sem cabine, estudando no chão em volta das supertrees e das cabines, SÓ se comprovam que estão num
 * GRUPO DE ESTUDOS.
 *
 * As credenciais aqui são dos bots (lib/cyber/frota) e são FICTÍCIAS (`ficticia: true`), mas têm o MESMO formato da
 * credencial de verdade (prisma `AcademicCredential`: nivel graduacao|mestrado|doutorado, área, instituição, método,
 * status) — a cidadela de gente de verdade usa as mesmas regras (`podeFicarNaCidadela`).
 */

export type NivelCidadela = "professor" | "doutor" | "mestrando" | "graduando";
/** a ordem da hierarquia: de dentro (junto dos pilares da capela) pra fora (as pontas) */
export const HIERARQUIA: readonly NivelCidadela[] = ["professor", "doutor", "mestrando", "graduando"];
/** o nível da credencial de verdade (prisma `AcademicCredential.nivel`) de cada degrau */
export type NivelAcademico = "doutorado" | "mestrado" | "graduacao";
export type GrupoDeEstudos = { id: string; nome: string; tema: string; membros: number };

/** o MODELO de cada credencial: o que ela comprova, onde a pessoa fica na cidadela e o que é exigido pra ela valer lá */
export type ModeloCredencial = {
  nivel: NivelCidadela; nivelAcademico: NivelAcademico;
  /** como aparece (o título antes do nome, por gênero) e a descrição curta */
  titulo: { f: string; m: string }; papel: { f: string; m: string };
  /** a cor do degrau (a placa da cabine, o crachá) */
  cor: string;
  /** tem CABINE DE ESTUDO (e em que fileira, a partir da capela) */
  cabine: boolean; fileira: number | null;
  /** quantos há na cidadela */
  vagas: number;
  /** a fração que tem ROTINA fora da cabine (sai, passeia, vai pras outras áreas); o resto só fica logado no laboratório
   *  — aparece na cabine em status "estudando" e nunca entra no cyberespaço de verdade */
  rotina: number;
  /** o que tem que estar comprovado na credencial pra ela valer na cidadela */
  exige: readonly ("titulo" | "vinculo" | "grupoDeEstudos")[];
};

/** os modelos (o pedido do dono: 18 doutores — 9 professores + 9 doutores —, 34 mestrandos e 75 graduandos; 30% dos
 *  doutores e 70% dos mestrandos e graduandos com rotina fora da cabine) */
export const MODELOS_CREDENCIAL: Readonly<Record<NivelCidadela, ModeloCredencial>> = {
  professor: { nivel: "professor", nivelAcademico: "doutorado", titulo: { f: "Profa. Dra.", m: "Prof. Dr." }, papel: { f: "Professora · Doutorado", m: "Professor · Doutorado" }, cor: "#ffd27a", cabine: true, fileira: 0, vagas: 9, rotina: 0.3, exige: ["titulo", "vinculo"] },
  doutor: { nivel: "doutor", nivelAcademico: "doutorado", titulo: { f: "Dra.", m: "Dr." }, papel: { f: "Doutora", m: "Doutor" }, cor: "#c49bff", cabine: true, fileira: 1, vagas: 9, rotina: 0.3, exige: ["titulo"] },
  mestrando: { nivel: "mestrando", nivelAcademico: "mestrado", titulo: { f: "Mestranda", m: "Mestrando" }, papel: { f: "Mestranda", m: "Mestrando" }, cor: "#6fe3ff", cabine: true, fileira: 2, vagas: 34, rotina: 0.7, exige: ["vinculo"] },
  graduando: { nivel: "graduando", nivelAcademico: "graduacao", titulo: { f: "Graduanda", m: "Graduando" }, papel: { f: "Graduanda", m: "Graduando" }, cor: "#8dffb0", cabine: false, fileira: null, vagas: 75, rotina: 0.7, exige: ["vinculo", "grupoDeEstudos"] },
};
/** quantos DOUTORES (professores + doutores) há na cidadela */
export const DOUTORES_NA_CIDADELA = MODELOS_CREDENCIAL.professor.vagas + MODELOS_CREDENCIAL.doutor.vagas;

/** as instituições das credenciais (as do mapa) */
export const INSTITUICOES = ["UNILAB", "UFC", "UECE", "Unifor", "IFCE"] as const;

/** a CREDENCIAL (o mesmo formato da `AcademicCredential` + o que a cidadela usa) */
export type CredencialAcademica = {
  /** o código da credencial (ex.: "ZC-PRO-0003") */
  id: string;
  /** de quem é (o id do agente da frota, ou do usuário) */
  dono: string;
  nivel: NivelCidadela; nivelAcademico: NivelAcademico;
  /** o título antes do nome ("Profa. Dra.", "Mestrando"…) e o papel ("Professora · Doutorado") */
  titulo: string; papel: string;
  /** a área (o curso), a instituição e o programa ("Doutorado em Física"; graduação: "Graduação em …") */
  area: string; instituicao: string; programa: string;
  /** o ano em que o título saiu (doutorado) ou o de ingresso (mestrado/graduação) */
  ano: number;
  /** como foi comprovada e o status (os mesmos valores da credencial de verdade) */
  metodo: "registry" | "doc_review" | "edu_email"; status: "verificado" | "pendente";
  /** o GRUPO DE ESTUDOS comprovado (o graduando só fica na cidadela com um) */
  grupoDeEstudos: GrupoDeEstudos | null;
  /** é fictícia (dos bots) */
  ficticia: boolean;
};

const PREFIXO: Record<NivelCidadela, string> = { professor: "PRO", doutor: "DOU", mestrando: "MES", graduando: "GRA" };
/** o programa de um degrau numa área */
export const programaDe = (nivel: NivelCidadela, area: string) =>
  nivel === "graduando" ? `Graduação em ${area}` : nivel === "mestrando" ? `Mestrado em ${area}` : `Doutorado em ${area}`;

/** monta uma credencial FICTÍCIA (determinística: os mesmos dados dão a mesma credencial) */
export function credencialFicticia(o: { dono: string; nivel: NivelCidadela; genero: "f" | "m"; area: string; seq: number; sorteio: number; grupo?: GrupoDeEstudos | null }): CredencialAcademica {
  const M = MODELOS_CREDENCIAL[o.nivel], s = Math.abs(Math.floor(o.sorteio)) >>> 0;
  const instituicao = INSTITUICOES[s % INSTITUICOES.length]!;
  // o ano: doutorado concluído entre 2008 e 2024 (professor mais antigo); mestrado/graduação, ingresso recente
  const ano = o.nivel === "professor" ? 2008 + (s % 10) : o.nivel === "doutor" ? 2016 + (s % 9) : o.nivel === "mestrando" ? 2024 + (s % 3) : 2021 + (s % 6);
  return {
    id: `ZC-${PREFIXO[o.nivel]}-${String(o.seq + 1).padStart(4, "0")}`, dono: o.dono,
    nivel: o.nivel, nivelAcademico: M.nivelAcademico, titulo: M.titulo[o.genero], papel: M.papel[o.genero],
    area: o.area, instituicao, programa: programaDe(o.nivel, o.area), ano,
    metodo: o.nivel === "professor" ? "registry" : o.nivel === "graduando" ? "edu_email" : "doc_review", status: "verificado",
    grupoDeEstudos: o.nivel === "graduando" ? o.grupo ?? null : null, ficticia: true,
  };
}

/** a credencial vale na cidadela? verificada e com o que o modelo exige — o GRADUANDO só com grupo de estudos (de 2+) */
export function podeFicarNaCidadela(c: CredencialAcademica | null | undefined): boolean {
  if (!c || c.status !== "verificado") return false;
  if (MODELOS_CREDENCIAL[c.nivel].exige.includes("grupoDeEstudos")) return !!c.grupoDeEstudos && c.grupoDeEstudos.membros >= 2;
  return true;
}
/** a linha do crachá: "Profa. Dra. Ana Lima" */
export const nomeComTitulo = (c: CredencialAcademica, nome: string) => `${c.titulo} ${nome}`;
/** o resumo da credencial (o subtítulo do crachá): "Doutorado em Física · UFC" / "Graduação em Direito · GE Hipátia" */
export const resumoDaCredencial = (c: CredencialAcademica) => `${c.programa} · ${c.grupoDeEstudos ? c.grupoDeEstudos.nome : c.instituicao}`;
