// Elegibilidade acadêmica BR a partir do e-mail. Porte fiel de
// agent-gateway/app/engines/edu_eligibility.py (já testado). Fonte-da-verdade do web.

export type InstitutionKind =
  | "federal" | "estadual" | "privada"
  | "instituto_federal" | "internacional_edu" | "desconhecida";

export interface EduResult {
  eligible: boolean;
  isBrazilian: boolean;
  institution: string | null;
  kind: InstitutionKind;
  confidence: number;
  domain: string;
}

const PERSONAL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.com.br",
  "icloud.com", "proton.me", "protonmail.com", "bol.com.br", "uol.com.br", "terra.com.br",
]);

const KNOWN: Record<string, [string, InstitutionKind]> = {
  "usp.br": ["Universidade de São Paulo", "estadual"],
  "unicamp.br": ["Universidade Estadual de Campinas", "estadual"],
  "unesp.br": ["Universidade Estadual Paulista", "estadual"],
  "ufrj.br": ["Universidade Federal do Rio de Janeiro", "federal"],
  "ufmg.br": ["Universidade Federal de Minas Gerais", "federal"],
  "ufrgs.br": ["Universidade Federal do Rio Grande do Sul", "federal"],
  "ufsc.br": ["Universidade Federal de Santa Catarina", "federal"],
  "ufpr.br": ["Universidade Federal do Paraná", "federal"],
  "ufba.br": ["Universidade Federal da Bahia", "federal"],
  "ufpe.br": ["Universidade Federal de Pernambuco", "federal"],
  "ufc.br": ["Universidade Federal do Ceará", "federal"],
  "unb.br": ["Universidade de Brasília", "federal"],
  "ufscar.br": ["Universidade Federal de São Carlos", "federal"],
  "uff.br": ["Universidade Federal Fluminense", "federal"],
  "puc-rio.br": ["PUC-Rio", "privada"],
  "pucsp.br": ["PUC-SP", "privada"],
  "pucrs.br": ["PUC-RS", "privada"],
  "pucminas.br": ["PUC Minas", "privada"],
  "mackenzie.br": ["Universidade Presbiteriana Mackenzie", "privada"],
  "fgv.br": ["Fundação Getulio Vargas", "privada"],
  "insper.edu.br": ["Insper", "privada"],
  "estacio.br": ["Universidade Estácio de Sá", "privada"],
  "anhembi.br": ["Anhembi Morumbi", "privada"],
};

const PATTERNS: [RegExp, InstitutionKind, number][] = [
  [/^if[a-z]{1,3}\.edu\.br$/i, "instituto_federal", 0.9],
  [/^if[a-z]{1,3}\.br$/i, "instituto_federal", 0.85],
  [/^cefet[a-z-]*\.br$/i, "instituto_federal", 0.85],
  [/^uf[a-z]{1,4}\.br$/i, "federal", 0.85],
  [/^u[a-z]{2,4}\.br$/i, "estadual", 0.6],
  [/^fac[a-z-]*\.(edu\.)?br$/i, "privada", 0.6],
];

function domainOf(email: string): string {
  const e = (email || "").trim().toLowerCase();
  if (!e.includes("@")) return "";
  return e.split("@").pop()!.trim();
}

export function checkEdu(email: string): EduResult {
  const d = domainOf(email);
  if (!d || PERSONAL.has(d)) {
    return { eligible: false, isBrazilian: false, institution: null, kind: "desconhecida", confidence: 0, domain: d };
  }
  for (const known of Object.keys(KNOWN)) {
    if (d === known || d.endsWith("." + known)) {
      const [name, kind] = KNOWN[known];
      return { eligible: true, isBrazilian: true, institution: name, kind, confidence: 0.98, domain: d };
    }
  }
  if (d.endsWith(".edu.br") || d === "edu.br") {
    return { eligible: true, isBrazilian: true, institution: null, kind: "privada", confidence: 0.9, domain: d };
  }
  for (const [pat, kind, conf] of PATTERNS) {
    if (pat.test(d)) {
      return { eligible: true, isBrazilian: true, institution: null, kind, confidence: conf, domain: d };
    }
  }
  if (d.includes(".edu.") && d.endsWith(".br")) {
    return { eligible: true, isBrazilian: true, institution: null, kind: "privada", confidence: 0.8, domain: d };
  }
  if (d.endsWith(".edu")) {
    return { eligible: true, isBrazilian: false, institution: null, kind: "internacional_edu", confidence: 0.7, domain: d };
  }
  return { eligible: false, isBrazilian: false, institution: null, kind: "desconhecida", confidence: 0, domain: d };
}
