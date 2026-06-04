export type Level = "grad" | "msc" | "phd" | "postdoc";

export const LEVELS: Level[] = ["grad", "msc", "phd", "postdoc"];

export interface LevelMeta {
  id: Level;
  name: string;
  programLabel: string;
  suggestionType: "Exploratória" | "Experimental" | "Pioneira";
  icon: string;
}

export const LEVEL_META: Record<Level, LevelMeta> = {
  grad:    { id: "grad",    name: "Graduando",  programLabel: "Iniciação Científica (PIBIC/IC)", suggestionType: "Exploratória", icon: "🎓" },
  msc:     { id: "msc",     name: "Mestrando",  programLabel: "Mestrado",                        suggestionType: "Experimental", icon: "🔬" },
  phd:     { id: "phd",     name: "Doutorando", programLabel: "Doutorado",                       suggestionType: "Pioneira",     icon: "⚗️" },
  postdoc: { id: "postdoc", name: "Pós-Doc",    programLabel: "Pós-Doutorado (PNPD)",            suggestionType: "Pioneira",     icon: "🚀" },
};

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as string[]).includes(v);
}
