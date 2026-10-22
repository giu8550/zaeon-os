#!/usr/bin/env node
/**
 * scripts/sync-design-md.mjs — vendoriza a coleção VoltAgent/awesome-design-md (MIT) em vendor/design-md/.
 *   node scripts/sync-design-md.mjs
 * Baixa o tarball do GitHub, copia só `design-md/<estilo>/DESIGN.md` + LICENSE e gera vendor/design-md/indice.json
 * (tokens + clima via lib/octa/design). Rodar de vez em quando e commitar o resultado; o app só lê o vendor.
 * O conteúdo baixado é DADO: nada dele é executado, só lido como texto.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, "vendor", "design-md");
const TARBALL = "https://codeload.github.com/VoltAgent/awesome-design-md/tar.gz/HEAD";
const ID_VALIDO = /^[a-z0-9][a-z0-9.-]*$/;

const { extrairTokens } = await tsImport("../lib/octa/design/tokens.ts", import.meta.url);
const { extrairClima, marcaDoEstilo } = await tsImport("../lib/octa/design/indice.ts", import.meta.url);

const tmp = mkdtempSync(join(tmpdir(), "design-md-"));
try {
  const res = await fetch(TARBALL);
  if (!res.ok) throw new Error(`download falhou: HTTP ${res.status}`);
  const tgz = join(tmp, "colecao.tar.gz");
  writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  const fonte = join(tmp, "fonte");
  mkdirSync(fonte);
  execFileSync("tar", ["-xzf", tgz, "-C", fonte]);
  const [topo] = readdirSync(fonte);
  const colecao = join(fonte, topo);

  rmSync(DESTINO, { recursive: true, force: true });
  mkdirSync(DESTINO, { recursive: true });
  copyFileSync(join(colecao, "LICENSE"), join(DESTINO, "LICENSE"));

  const indice = [];
  for (const id of readdirSync(join(colecao, "design-md")).sort()) {
    const arq = join(colecao, "design-md", id, "DESIGN.md");
    if (!ID_VALIDO.test(id) || !statSync(arq, { throwIfNoEntry: false })?.isFile()) continue;
    const md = readFileSync(arq, "utf8");
    mkdirSync(join(DESTINO, id));
    writeFileSync(join(DESTINO, id, "DESIGN.md"), md);

    // marca + aliases (MARCAS_EXPLICITAS em lib/octa/design/indice.ts onde a pasta não é o nome da marca)
    const { marca, aliases, nome: rotulo } = marcaDoEstilo(id);
    const tokens = extrairTokens(md, [marca, ...aliases].join(" "));
    const nome = md.match(/^#\s*Design System Inspired by\s+(.+?)\s*$/m)?.[1] ?? rotulo;
    const descricao = md.match(/^description:\s*"?(.+?)"?\s*$/m)?.[1] ?? md.match(/##\s*1\.[^\n]*\n+([^\n#]+)/)?.[1] ?? "";
    const resumo = descricao.replace(/\s+/g, " ").trim().slice(0, 240);
    indice.push({ id, nome, marca, ...(aliases.length ? { aliases } : {}), resumo, clima: extrairClima(md, tokens.escuro), tokens });
  }
  writeFileSync(join(DESTINO, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
  console.log(`vendor/design-md: ${indice.length} estilos`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
