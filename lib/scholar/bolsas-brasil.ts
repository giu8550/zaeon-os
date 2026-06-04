// Cenário nacional de bolsas — valores verificados em jun/2026.
// Federais (CAPES/CNPq): reajuste de 2023 (mestrado R$1.5k→2.1k, doutorado R$2.2k→3.1k,
//   pós-doc R$4.1k→5.2k) ainda vigente em 2025 — sem novo reajuste sob o arcabouço fiscal.
// FAPESP: tabela vigente a partir de 01/08/2025 (mais alta do país).
import type { Level } from "./levels";

export type Agency = "CAPES" | "CNPq" | "FAPESP";

export interface BolsaAgencyValue {
  name: Agency;
  monthlyBRL: number;
  sourceUrl: string;
  asOf: string;
}

export interface BolsaInfo {
  level: Level;
  programLabel: string;
  agencies: BolsaAgencyValue[];
  availabilityNote: string;
  competitiveness: "baixa" | "média" | "alta";
}

const FAPESP = "https://fapesp.br/valores/bolsasnopais";
const FED_REAJUSTE = "https://adufscar.org.br/veja-os-novos-valores-das-bolsas-de-estudo-do-cnpq-e-da-capes/";
const PIBIC = "https://www.gov.br/cti/pt-br/programas-de-bolsas/pibic/editais/EditalPIBICCTI2025_2026.pdf";

export const BOLSAS_BRASIL: Record<Level, BolsaInfo> = {
  grad: {
    level: "grad",
    programLabel: "Iniciação Científica (PIBIC/IC)",
    agencies: [
      { name: "CNPq",   monthlyBRL: 700,  sourceUrl: PIBIC, asOf: "2025" },
      { name: "CAPES",  monthlyBRL: 700,  sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 1140, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "Cotas amplas por universidade (PIBIC/PIBITI), mas muito concorridas; valor federal de R$700 congelado desde 2023.",
    competitiveness: "média",
  },
  msc: {
    level: "msc",
    programLabel: "Mestrado",
    agencies: [
      { name: "CAPES",  monthlyBRL: 2100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "CNPq",   monthlyBRL: 2100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 3450, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "PPGs bem avaliados (CAPES 5–7) contemplam a maioria; federal R$2.100 desde 2023, reajuste em negociação (CAPES pediu +R$500mi p/ 2025).",
    competitiveness: "média",
  },
  phd: {
    level: "phd",
    programLabel: "Doutorado",
    agencies: [
      { name: "CAPES",  monthlyBRL: 3100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "CNPq",   monthlyBRL: 3100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 7140, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "Alta prioridade de fomento; doutorandos em PPGs fortes costumam ser bolsistas; federal R$3.100 desde 2023.",
    competitiveness: "média",
  },
  postdoc: {
    level: "postdoc",
    programLabel: "Pós-Doutorado (PNPD/PD)",
    agencies: [
      { name: "CAPES",  monthlyBRL: 5200,  sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "CNPq",   monthlyBRL: 5200,  sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 12570, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "Cotas PNPD limitadas por programa — as mais disputadas; federal R$5.200 (+25% em 2023). FAPESP PD é a maior do país.",
    competitiveness: "alta",
  },
};

export function getBolsaInfo(level: Level): BolsaInfo {
  return BOLSAS_BRASIL[level];
}

export function bolsaRange(level: Level): { reference: number; min: number; max: number } {
  const all = BOLSAS_BRASIL[level].agencies.map((a) => a.monthlyBRL);
  const federal = BOLSAS_BRASIL[level].agencies.filter((a) => a.name !== "FAPESP").map((a) => a.monthlyBRL);
  return { reference: Math.min(...federal), min: Math.min(...all), max: Math.max(...all) };
}
