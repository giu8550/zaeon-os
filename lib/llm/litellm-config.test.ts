/**
 * Pina o infra/litellm.config.yaml lendo como TEXTO (sem lib de yaml): as regras do pool grátis
 * que, violadas, custam dinheiro (§5.10) ou a conta do provedor (§8.11).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const yaml = readFileSync(path.resolve(__dirname, "../../infra/litellm.config.yaml"), "utf8");
/** Só as linhas ativas (comentário fora — o GLM comentado não conta). */
const ativas = yaml.split("\n").filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/\s+#.*$/, ""));

/** Blocos de deployment: model_name → linhas até o próximo "- model_name" ou seção de topo. */
function deployments(): { nome: string; linhas: string[] }[] {
  const out: { nome: string; linhas: string[] }[] = [];
  let atual: { nome: string; linhas: string[] } | null = null;
  for (const l of ativas) {
    const m = /^\s*-\s*model_name:\s*(\S+)/.exec(l);
    if (m) { atual = { nome: m[1], linhas: [] }; out.push(atual); continue; }
    if (/^\S/.test(l)) atual = null;            // general_settings:, litellm_settings:…
    else if (atual) atual.linhas.push(l);
  }
  return out;
}

const ENV_KEY_DO_PROVEDOR: Record<string, string> = {
  "gemini/": "GEMINI_FREE_API_KEY",
  "cloudflare/": "CLOUDFLARE_API_KEY",
  "groq/": "GROQ_API_KEY",
  "openai/glm": "ZHIPU_API_KEY",
};

describe("infra/litellm.config.yaml — pool grátis", () => {
  const deps = deployments();
  const pool = deps.filter((d) => d.nome.startsWith("zaeon-pool-"));

  it("Vertex intacto: zaeon-flash e zaeon-pro continuam vertex_ai/", () => {
    for (const n of ["zaeon-flash", "zaeon-pro"]) {
      const d = deps.find((x) => x.nome === n);
      expect(d, n).toBeTruthy();
      expect(d!.linhas.join("\n")).toMatch(/model:\s*vertex_ai\//);
    }
  });

  it("os 3 grupos do pool existem (GLM comentado = fora)", () => {
    expect(pool.map((d) => d.nome).sort()).toEqual(["zaeon-pool-cf", "zaeon-pool-groq", "zaeon-pool-lite"]);
  });

  it("nenhum vertex_ai/ dentro de grupo zaeon-pool-* (pool nunca é crédito do negócio)", () => {
    for (const d of pool) expect(d.linhas.join("\n"), d.nome).not.toMatch(/vertex_ai\/|vertex_credentials|vertex_project/);
  });

  it("UM deployment por grupo e UMA api_key por provedor (§8.11)", () => {
    const nomes = pool.map((d) => d.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    // §8.11 é regra dos provedores GRÁTIS de terceiros (uma conta cada). Os zaeon-local-* (Contabo, nossa)
    // dividem a mesma key de propósito — o teste deles está abaixo.
    const porEnv = new Map<string, number>();
    for (const l of pool.flatMap((d) => d.linhas)) {
      const m = /api_key:\s*os\.environ\/(\S+)/.exec(l);
      if (m) porEnv.set(m[1], (porEnv.get(m[1]) ?? 0) + 1);
    }
    for (const [env, n] of porEnv) expect(n, env).toBe(1);
    // e cada deployment do pool usa a env do SEU provedor
    for (const d of pool) {
      const corpo = d.linhas.join("\n");
      const modelo = /model:\s*(\S+)/.exec(corpo)?.[1] ?? "";
      const prefixo = Object.keys(ENV_KEY_DO_PROVEDOR).find((p) => modelo.startsWith(p));
      expect(prefixo, `${d.nome}: provedor de ${modelo}`).toBeTruthy();
      expect(corpo, d.nome).toContain(`api_key: os.environ/${ENV_KEY_DO_PROVEDOR[prefixo!]}`);
    }
  });

  it("nenhuma key literal no arquivo (só os.environ/)", () => {
    for (const l of ativas) {
      const m = /(?:api_key|master_key):\s*(\S+)/.exec(l);
      if (m) expect(m[1], l).toMatch(/^os\.environ\//);
    }
  });

  it("cada deployment do pool tem model_info.id = alvo (header x-litellm-model-id)", () => {
    const esperado: Record<string, string> = { "zaeon-pool-lite": "gemini-free", "zaeon-pool-cf": "cloudflare", "zaeon-pool-groq": "groq" };
    for (const d of pool) expect(d.linhas.join("\n"), d.nome).toMatch(new RegExp(`model_info:\\s*\\{\\s*id:\\s*${esperado[d.nome]}\\s*\\}`));
  });

  it("fallback do pool = só a reserva Google; nunca zaeon-flash/zaeon-pro (o orçamento do chat)", () => {
    const linha = ativas.find((l) => /^\s*fallbacks:/.test(l));
    expect(linha).toBeTruthy();
    expect(linha).not.toMatch(/zaeon-flash|zaeon-pro/);
    expect(linha).toMatch(/"zaeon-pool-lite":\s*\["zaeon-reserva-google"\]/);
  });

  it("reserva Google = Vertex flash-lite (o mais barato), com alvo vertex pro ledger contar o custo", () => {
    const d = deps.find((x) => x.nome === "zaeon-reserva-google");
    expect(d).toBeTruthy();
    const corpo = d!.linhas.join("\n");
    expect(corpo).toMatch(/model:\s*vertex_ai\/gemini-[\d.]+-flash-lite\s/);
    expect(corpo).toMatch(/id:\s*vertex\b/);
  });

  it("modelos próprios (Contabo): 4 zaeon-local-*, todos litellm_proxy/ com URL e key só por env, nunca Vertex", () => {
    const locais = deps.filter((d) => d.nome.startsWith("zaeon-local-"));
    expect(locais.map((d) => d.nome).sort()).toEqual(["zaeon-local-coder", "zaeon-local-embed", "zaeon-local-lfm2", "zaeon-local-rerank"]);
    for (const d of locais) {
      const corpo = d.linhas.join("\n");
      expect(corpo, d.nome).toMatch(/model:\s*litellm_proxy\//);
      expect(corpo, d.nome).toContain("api_base: os.environ/CONTABO_LLM_URL");
      expect(corpo, d.nome).toContain("api_key: os.environ/CONTABO_LLM_KEY");
      expect(corpo, d.nome).toMatch(/id:\s*contabo-/);
      expect(corpo, d.nome).not.toMatch(/vertex_ai\/|vertex_credentials/);
    }
  });

  it("modelos próprios fora de qualquer fallback (CPU lento: quem chama escolhe pelo nome)", () => {
    const linha = ativas.find((l) => /^\s*fallbacks:/.test(l));
    expect(linha).not.toMatch(/zaeon-local-/);
  });
});
