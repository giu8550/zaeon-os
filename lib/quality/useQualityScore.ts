"use client";
import { useEffect, useRef, useState } from "react";

import { isEmptyOrTemplate } from "@/lib/abntTemplate";
import { buildScoreRequest } from "@/lib/quality/segment";
import type { AcademicLevel, ScoreResponse, WorkType } from "@/lib/quality/types";

interface Params {
  docContent: string;
  title: string;
  workType: WorkType;
  academicLevel: AcademicLevel;
  enabled?: boolean;
  debounceMs?: number;
}

export interface QualityState {
  score: ScoreResponse | null;
  loading: boolean;
  offline: boolean;
}

// djb2 — hash estável e barato para cache por conteúdo.
function hashContent(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/**
 * Pontua o documento via /api/quality com debounce e cache por hash de
 * conteúdo. Não dispara para template intacto/vazio. Degrada para `offline`
 * quando o motor não responde (a UI então se esconde).
 */
export function useQualityScore({
  docContent,
  title,
  workType,
  academicLevel,
  enabled = true,
  debounceMs = 700,
}: Params): QualityState {
  const [state, setState] = useState<QualityState>({ score: null, loading: false, offline: false });
  const cache = useRef<Map<string, ScoreResponse>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || isEmptyOrTemplate(docContent)) {
      setState((s) => ({ ...s, score: null, loading: false }));
      return;
    }

    const key = hashContent(`${title}|${workType}|${academicLevel}|${docContent}`);
    const cached = cache.current.get(key);
    if (cached) {
      setState({ score: cached, loading: false, offline: false });
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    setState((s) => ({ ...s, loading: true }));

    timer.current = setTimeout(async () => {
      try {
        const body = buildScoreRequest(docContent, title, workType, academicLevel);
        const r = await fetch("/api/quality", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.status === 503) {
          setState({ score: null, loading: false, offline: true });
          return;
        }
        if (!r.ok) {
          setState({ score: null, loading: false, offline: false });
          return;
        }
        const data = (await r.json()) as ScoreResponse;
        cache.current.set(key, data);
        setState({ score: data, loading: false, offline: false });
      } catch {
        setState({ score: null, loading: false, offline: true });
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [docContent, title, workType, academicLevel, enabled, debounceMs]);

  return state;
}
