// Segmentação e montagem do payload de score no cliente — paridade com o
// `segmentation.py` do quality-engine (divisão por linha em branco, descartando
// marcadores `# ...`/`## ...`).

import { parseAbntMarkers } from "@/lib/abntTemplate";
import type { AcademicLevel, ScoreRequest, SectionIn, WorkType } from "@/lib/quality/types";

/** Divide o conteúdo de uma seção em parágrafos, ignorando linhas de marcador. */
export function splitParagraphs(sectionContent: string): string[] {
  return sectionContent
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !/^#{1,6}\s/.test(line.trim()))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

const LEVEL_MAP: Record<string, AcademicLevel> = {
  graduação: "grad",
  graduacao: "grad",
  mestrado: "msc",
  doutorado: "phd",
  "pós-doutorado": "postdoc",
  "pos-doutorado": "postdoc",
  postdoc: "postdoc",
};

/** Converte `User.academicLevel` (PT) para o enum do motor. */
export function mapAcademicLevel(level?: string | null): AcademicLevel {
  if (!level) return "grad";
  return LEVEL_MAP[level.trim().toLowerCase()] ?? "grad";
}

/**
 * Monta o `ScoreRequest` a partir do texto do editor. Usa o parser ABNT já
 * existente; se não houver marcadores `#`, devolve uma única seção genérica.
 */
export function buildScoreRequest(
  docContent: string,
  title: string,
  workType: WorkType,
  academicLevel: AcademicLevel
): ScoreRequest {
  const parsed = parseAbntMarkers(docContent);
  let sections: SectionIn[];
  if (parsed && parsed.length > 0) {
    sections = parsed.map((s) => ({
      type: s.type,
      title: s.title,
      content: s.content,
      subsections: s.subsections,
    }));
  } else {
    sections = [{ type: "desenvolvimento", title: "", content: docContent }];
  }
  return { title, work_type: workType, academic_level: academicLevel, sections };
}
