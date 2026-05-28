"use client";
import { type ReactNode, createContext, useContext, useState, useCallback } from "react";
import type { ScholarEvent } from "@/lib/scholar/types";

interface Phase { phase: string; message: string; }
interface OmegaState {
  status: "idle" | "running" | "done" | "error";
  query: string;
  phases: Phase[];
  answer: string;
  session: any | null;
  error: string | null;
}
interface OmegaCtx extends OmegaState {
  runQuery: (prompt: string) => Promise<void>;
  loadSession: (s: any) => void;
}

const Ctx = createContext<OmegaCtx | null>(null);
export const useOmegaScholar = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOmegaScholar must be used within OmegaScholarProvider");
  return c;
};

export function OmegaScholarProvider({ room, onStart, children }:
  { room?: string; onStart?: () => void; children: ReactNode }) {
  const [state, setState] = useState<OmegaState>({
    status: "idle", query: "", phases: [], answer: "", session: null, error: null });

  const runQuery = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    onStart?.(); // parent switches activeTab → "community"
    setState({ status: "running", query: prompt, phases: [], answer: "", session: null, error: null });
    try {
      const res = await fetch("/api/ai/scholar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, room }),
      });
      if (!res.body) throw new Error("Sem stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const dispatch = (line: string) => {
        if (!line.trim()) return;
        let ev: ScholarEvent;
        try { ev = JSON.parse(line) as ScholarEvent; } catch { return; }
        setState((s) => {
          if (ev.type === "phase") return { ...s, phases: [...s.phases, { phase: ev.phase, message: (ev as any).message ?? ev.phase }] };
          if (ev.type === "answer") return { ...s, answer: ev.text };
          if (ev.type === "done") return { ...s, status: "done", session: ev.session };
          if (ev.type === "error") return { ...s, status: "error", error: ev.message };
          return s;
        });
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) dispatch(line);
      }
      // Flush any trailing line not terminated by a newline (robust to servers
      // that don't append a final \n — e.g. a last `done` event).
      if (buf) dispatch(buf);
    } catch (e: any) {
      setState((s) => ({ ...s, status: "error", error: e?.message ?? "Erro" }));
    }
  }, [room, onStart]);

  const loadSession = useCallback((s: any) => {
    setState({ status: "done", query: s.query, phases: [], answer: s?.thread?.answer ?? "", session: s, error: null });
  }, []);

  return <Ctx.Provider value={{ ...state, runQuery, loadSession }}>{children}</Ctx.Provider>;
}
