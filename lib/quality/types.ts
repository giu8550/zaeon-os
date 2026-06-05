// Tipos compartilhados do Termômetro Acadêmico — espelham o contrato do
// quality-engine (Python). Bandas em snake_case para casar 1:1 com o motor.

export type Band = "ruim" | "aceitavel" | "bom" | "muito_bom" | "excepcional";

export const BAND_ORDER: Band[] = ["ruim", "aceitavel", "bom", "muito_bom", "excepcional"];

export const BAND_LABELS: Record<Band, string> = {
  ruim: "Ruim",
  aceitavel: "Aceitável",
  bom: "Bom",
  muito_bom: "Muito bom",
  excepcional: "Excepcional",
};

export interface ParagraphScore {
  idx: number;
  section_type: string;
  band: Band;
  score: number;
  rationale: string;
  strengths: string[];
  gaps: string[];
  flags: string[];
  metrics: Record<string, number>;
}

export interface SectionScore {
  type: string;
  title: string;
  band: Band;
  score: number;
  structure_flags: string[];
  rationale: string;
  paragraphs: ParagraphScore[];
}

export interface TitleScore {
  band: Band;
  specificity: number;
  notes: string[];
}

export interface OverallScore {
  band: Band;
  score: number;
  level_read: string;
  rationale: string;
  strengths: string[];
  gaps: string[];
}

export interface ScoreResponse {
  overall: OverallScore;
  title: TitleScore;
  sections: SectionScore[];
  meta: Record<string, unknown>;
}

export interface SubsectionIn {
  title: string;
  content: string;
}

export interface SectionIn {
  type: string;
  title: string;
  content: string;
  subsections?: SubsectionIn[];
}

export type WorkType = "Artigo" | "Relatório" | "TCC";
export type AcademicLevel = "grad" | "msc" | "phd" | "postdoc";

export interface ScoreRequest {
  title: string;
  work_type: WorkType;
  academic_level: AcademicLevel;
  sections: SectionIn[];
}
