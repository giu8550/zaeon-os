#!/usr/bin/env node
/**
 * scripts/vet-audit.mjs — P1 do Pack Octa (§1). SCA no CI com CATRACA: `npm audit` das deps de produção;
 * falha só se aparecer advisory high/critical que NÃO está na baseline (config/vetting/audit-baseline.json).
 * As herdadas ficam listadas pra serem pagas aos poucos — mas nenhuma NOVA entra calada.
 * Uso: node scripts/vet-audit.mjs [--write-baseline]
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

let raw;
try { raw = execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }); }
catch (e) { raw = e.stdout; } // npm audit sai ≠0 quando acha vulnerabilidade — o JSON vem igual
const report = JSON.parse(raw || "{}");
if (!report.vulnerabilities) { console.error("✖ vet-audit: npm audit não devolveu relatório (rede/registry?)"); process.exit(1); }

const graves = new Set();
for (const v of Object.values(report.vulnerabilities)) {
  for (const via of v.via ?? []) {
    if (typeof via === "object" && (via.severity === "high" || via.severity === "critical")) graves.add(`${via.name}|${via.url}`);
  }
}

const BASE = "config/vetting/audit-baseline.json";
if (process.argv.includes("--write-baseline")) {
  writeFileSync(BASE, JSON.stringify({ _nota: "Advisories high/critical HERDADAS quando o SCA entrou (out/2026). Remover daqui ao corrigir; nunca adicionar sem revisão.", advisories: [...graves].sort() }, null, 2) + "\n");
  console.log(`baseline escrita: ${graves.size} advisory(s)`);
  process.exit(0);
}
const base = new Set(existsSync(BASE) ? JSON.parse(readFileSync(BASE, "utf8")).advisories : []);
const novas = [...graves].filter((g) => !base.has(g));
const pagas = [...base].filter((g) => !graves.has(g));
if (pagas.length) console.log(`ℹ ${pagas.length} advisory(s) da baseline já não aparecem — pode tirar de ${BASE}`);
if (novas.length) {
  for (const n of novas) console.error(`✖ vet-audit: advisory NOVA high/critical: ${n.replace("|", " — ")}`);
  process.exit(1);
}
console.log(`✔ vet-audit: nenhuma advisory high/critical nova (${base.size} herdada(s) na baseline)`);
