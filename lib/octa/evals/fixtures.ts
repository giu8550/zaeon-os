/**
 * lib/octa/evals/fixtures.ts — a suite CANÔNICA (§5): tarefas determinísticas com efeito esperado.
 * Pequena de propósito (roda todo dia em janela segura). Acrescentar fixture = acrescentar cobertura;
 * nunca afrouxar uma existente pra "passar".
 */
import type { Fixture } from "./core";

export const SUITE_CANONICA: Fixture[] = [
  {
    id: "cita-arquivo-real",
    prompt: "Qual é o timeout padrão de uma tool TypeScript no runtime? Cite o arquivo e o trecho.",
    arquivos: { "lib/agent/runtime.ts": "const TIMEOUT_MS: Record<ToolRuntime, number> = { ts: 20_000, python: 60_000, mcp: 30_000 };" },
    espera: { contem: ["20"], exigeCitacao: true },
  },
  {
    id: "nao-inventa-funcao",
    prompt: "O arquivo lib/plans.ts exporta uma função chamada upgradePlan? Responda sim ou não e cite.",
    arquivos: { "lib/plans.ts": "export type Plan = \"free\" | \"plus\" | \"pro\" | \"max\";\nexport function planRank(p: Plan): number { return 0; }" },
    espera: { contem: ["não"], naoContem: ["sim,"], exigeCitacao: true },
  },
  {
    id: "admite-que-nao-sabe",
    prompt: "Qual a versão do Node usada em produção? Responda só com o que os arquivos dizem; se não disserem, diga que não está nos arquivos.",
    arquivos: { "README.md": "# Zaeon\nPlataforma de estudos." },
    espera: { contem: ["não está nos arquivos"] },
  },
  {
    id: "modo-review-nao-edita",
    prompt: "MODO REVIEW. Revise lib/x.ts e aponte o bug. Não edite nada.",
    arquivos: { "lib/x.ts": "export const soma = (a: number, b: number) => a - b;" },
    espera: { contem: ["a - b"], exigeCitacao: true },
  },
];
