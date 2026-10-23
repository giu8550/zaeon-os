#!/usr/bin/env node
/**
 * scripts/i18n-check.mjs — trava anti-regressão dos arquivos de tradução (public/locales/<lng>/common.json).
 *
 * FALHA (exit 1) se:
 *   • algum JSON não parseia;
 *   • os idiomas não têm EXATAMENTE o mesmo conjunto de chaves (lista o que falta em cada um);
 *   • as variáveis de interpolação ({{name}}) ou as tags do <Trans> (<hl>…</hl>) de uma chave diferem entre idiomas
 *     (variável traduzida = o texto aparece com "{{nome}}" cru na tela);
 *   • uma string está vazia num idioma e preenchida em outro;
 *   • tem mojibake (UTF-8 lido como Latin-1: "Ã§", "Ã£"…).
 * AVISA (sem falhar) das marcações TODO-i18n — tradução pendente pro dono revisar.
 *
 * Uso: node scripts/i18n-check.mjs [pasta-dos-locales]   (roda no CI, .github/workflows/ci.yml)
 */
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2] || path.join(process.cwd(), "public", "locales");
const ARQUIVO = "common.json";

const idiomas = fs.readdirSync(DIR).filter((d) => fs.existsSync(path.join(DIR, d, ARQUIVO))).sort();
const erros = [];
const avisos = [];

/** { "a.b.c": valor } — só as folhas. */
function achatar(o, prefixo = "", out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const chave = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) achatar(v, chave, out);
    else out[chave] = v;
  }
  return out;
}

const variaveis = (s) => (typeof s === "string" ? [...s.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((m) => m[1]).sort().join(",") : "");
const tags = (s) => (typeof s === "string" ? [...s.matchAll(/<\/?([a-z0-9]+)\s*\/?>/gi)].map((m) => m[0].replace(/\s/g, "")).sort().join("") : "");
const MOJIBAKE = /Ã[\u0080-¿]|â€|Â[ -¿]/;

const dados = {};
for (const l of idiomas) {
  try {
    dados[l] = achatar(JSON.parse(fs.readFileSync(path.join(DIR, l, ARQUIVO), "utf8")));
  } catch (e) {
    erros.push(`${l}: JSON inválido — ${e.message}`);
  }
}
const validos = Object.keys(dados);
const todas = new Set(validos.flatMap((l) => Object.keys(dados[l])));

// 1) paridade de chaves
for (const l of validos) {
  const faltam = [...todas].filter((k) => !(k in dados[l]));
  if (faltam.length) erros.push(`${l}: faltam ${faltam.length} chave(s): ${faltam.join(", ")}`);
}

// 2) consistência por chave
for (const k of todas) {
  const presentes = validos.filter((l) => k in dados[l]);
  const ref = presentes[0];
  for (const l of presentes) {
    const v = dados[l][k];
    if (typeof v === "string" && MOJIBAKE.test(v)) erros.push(`${l}: ${k} com mojibake: ${JSON.stringify(v.slice(0, 60))}`);
    if (typeof v === "string" && v.includes("TODO-i18n")) avisos.push(`${l}: ${k} marcado TODO-i18n`);
    if (l === ref) continue;
    const r = dados[ref][k];
    if (variaveis(v) !== variaveis(r)) erros.push(`${k}: variáveis diferentes — ${ref}=[${variaveis(r)}] ${l}=[${variaveis(v)}]`);
    if (tags(v) !== tags(r)) erros.push(`${k}: tags diferentes — ${ref}=[${tags(r)}] ${l}=[${tags(v)}]`);
    if ((v === "") !== (r === "")) erros.push(`${k}: vazia em ${v === "" ? l : ref} e preenchida em ${v === "" ? ref : l}`);
  }
}

for (const a of avisos) console.warn(`aviso: ${a}`);
if (erros.length) {
  console.error(`i18n: ${erros.length} problema(s) em ${idiomas.length} idiomas (${idiomas.join(", ")}):`);
  for (const e of erros) console.error(`  • ${e}`);
  process.exit(1);
}
console.log(`i18n ok: ${idiomas.length} idiomas (${idiomas.join(", ")}), ${todas.size} chaves cada, variáveis e tags consistentes.`);
