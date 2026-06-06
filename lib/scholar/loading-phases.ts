// Maps the Omega Scholar streaming phases into a progress value + an "agent
// swarm" narrative line. Pure + testable; the real counts already live in
// each phase's `message`, so no backend/context change is needed.

export interface PhaseLike {
  phase: string;
  message?: string;
}

const BASE: Record<string, number> = {
  planning: 0.12,
  searching: 0.28,
  dedup: 0.64,
  synthesizing: 0.82,
  verifying: 0.93,
};

/** Target progress [0,1] for the current phase/status (component smooths toward it). */
export function progressFor(phases: PhaseLike[], status: string): number {
  if (status === "done") return 1;
  if (status !== "running") return 0;
  if (!phases.length) return 0.08;

  const names = phases.map((p) => p.phase);
  const last = names[names.length - 1];

  if (last === "searching") {
    const n = names.filter((p) => p === "searching").length;
    return Math.min(0.55, 0.28 + (n - 1) * 0.06);
  }
  return BASE[last] ?? 0.5;
}

/** Strip status emojis/markers so we can reframe the message as agent activity. */
function clean(message?: string): string {
  return (message ?? "").replace(/^[✓⏳⚠🧠🔎\s·]+/u, "").trim();
}

export interface AgentLine {
  icon: string;
  text: string;
}

/** Turn a phase event into an agent-swarm log line. */
export function agentNarrative(p: PhaseLike): AgentLine {
  const m = clean(p.message);
  switch (p.phase) {
    case "planning":
      return { icon: "⟁", text: "implantando agentes de reconhecimento" };
    case "searching":
      return { icon: "⟁", text: m ? `agente · ${m}` : "agentes varrendo a rede" };
    case "dedup":
      return { icon: "⊹", text: m || "mesclando descobertas" };
    case "synthesizing":
      return { icon: "✶", text: "agentes cruzando evidências" };
    case "verifying":
      return { icon: "✓", text: m || "validando citações" };
    default:
      return { icon: "·", text: m || p.phase };
  }
}
