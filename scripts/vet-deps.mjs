#!/usr/bin/env node
/**
 * scripts/vet-deps.mjs — P1 do Pack Octa (§1). Supply-chain no CI:
 *   1. lockfile obrigatório (package-lock.json versão ≥2);
 *   2. todo pacote com script de instalação (preinstall/install/postinstall) tem que estar na lista
 *      revisada config/vetting/install-scripts.json, com a versão pinada — pacote novo ou versão nova
 *      com script = CI vermelho até alguém revisar e anotar;
 *   3. repos de terceiros REJEITADOS (config/vetting/repos.json) não podem aparecer em package.json.
 * Uso: node scripts/vet-deps.mjs [--write-baseline]   (--write-baseline só pra criar a lista inicial)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const fail = (msg) => { console.error(`✖ vet-deps: ${msg}`); process.exitCode = 1; };

if (!existsSync("package-lock.json")) { fail("package-lock.json ausente — lockfile é obrigatório"); process.exit(1); }
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
if (!lock.packages || (lock.lockfileVersion ?? 1) < 2) { fail("lockfile v1 não suportado — rode npm ≥7"); process.exit(1); }

const comScript = {};
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path || !meta.hasInstallScript) continue;
  const name = path.replace(/^.*node_modules\//, "");
  comScript[name] = meta.version;
}

const ALLOW = "config/vetting/install-scripts.json";
if (process.argv.includes("--write-baseline")) {
  const sorted = Object.fromEntries(Object.entries(comScript).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(ALLOW, JSON.stringify({ _nota: "Baseline herdada (out/2026): pacotes que já tinham install script quando o vetting entrou. Entrada NOVA exige revisão do script + versão pinada.", packages: sorted }, null, 2) + "\n");
  console.log(`baseline escrita: ${Object.keys(sorted).length} pacote(s)`);
  process.exit(0);
}

const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, "utf8")).packages ?? {} : {};
for (const [name, version] of Object.entries(comScript)) {
  if (!(name in allow)) fail(`${name}@${version} roda script de instalação e não foi revisado (adicione em ${ALLOW} após ler o script)`);
  else if (allow[name] !== version && allow[name] !== "*") fail(`${name} mudou de ${allow[name]} pra ${version} — revise o script de instalação da versão nova`);
}

const repos = existsSync("config/vetting/repos.json") ? JSON.parse(readFileSync("config/vetting/repos.json", "utf8")).repos ?? [] : [];
const pkg = readFileSync("package.json", "utf8").toLowerCase();
for (const r of repos.filter((r) => r.veredito === "rejeitado")) {
  const nome = r.repo.split("/")[1].toLowerCase();
  if (pkg.includes(`"${nome}"`) || pkg.includes(r.repo.toLowerCase())) fail(`${r.repo} está REJEITADO (${r.motivo}) e apareceu no package.json`);
}

if (!process.exitCode) console.log(`✔ vet-deps: lockfile ok, ${Object.keys(comScript).length} pacote(s) com install script, todos revisados; nenhum repo rejeitado`);
