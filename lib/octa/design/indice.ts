/**
 * lib/octa/design/indice.ts — índice da biblioteca DESIGN.md (vendor/design-md, VoltAgent/awesome-design-md, MIT).
 *
 *   carregarIndice()              lê vendor/design-md/indice.json (gerado por scripts/sync-design-md.mjs)
 *   lerDesignMd(id)               markdown bruto de um estilo do índice
 *   designMdComMarcador(id)       o DESIGN.md do projeto (marcador zaeon-estilo + markdown)
 *   candidatosPorDescricao(...)   ranking puro por clima + nome, para o agente escolher o estilo
 *   extrairClima / marcaDaPasta   usados pelo script de sync ao montar o índice
 *
 * Só roda no servidor (fs). Lê de process.cwd(): o Dockerfile copia a raiz inteira (COPY . .).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TokensDesign } from "./tokens";

export type EstiloDesign = {
  id: string;
  nome: string;
  /** Nome da marca de origem. A página do aluno nunca pode conter isto (regra anti-marca). */
  marca: string;
  resumo: string;
  clima: string[];
  tokens: TokensDesign;
};

const DIR = () => join(process.cwd(), "vendor", "design-md");

let cache: EstiloDesign[] | null = null;

export function carregarIndice(): EstiloDesign[] {
  if (cache) return cache;
  const bruto = JSON.parse(readFileSync(join(DIR(), "indice.json"), "utf8")) as EstiloDesign[];
  cache = bruto;
  return bruto;
}

/** Só aceita ids que existem no índice — impede `../` e leitura fora de vendor/design-md. */
export function lerDesignMd(id: string): string {
  if (!carregarIndice().some((e) => e.id === id)) throw new Error(`estilo de design desconhecido: ${id}`);
  return readFileSync(join(DIR(), id, "DESIGN.md"), "utf8");
}

/** 1ª linha do DESIGN.md gravado pelo Octa: diz às tools seguintes (e ao turno retomado) qual estilo vale. */
export const MARCADOR_ESTILO = (id: string) => `<!-- zaeon-estilo: ${id} -->`;

/** O DESIGN.md que o projeto recebe ao escolher um estilo (tool octa_design_escolher ou a galeria da IDE). */
export function designMdComMarcador(id: string): string {
  return `${MARCADOR_ESTILO(id)}\n${lerDesignMd(id)}`;
}

/** `linear.app` → "Linear", `bmw-m` → "Bmw M", `x.ai` → "X". */
export function marcaDaPasta(pasta: string): string {
  const base = pasta.replace(/\.(app|ai|com|io|dev)$/i, "");
  return base
    .split(/[-.]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Palavras do DESIGN.md → rótulos de clima em pt. Conta ocorrências; precisa de 2+ para valer. */
const CLIMAS: Array<[string, RegExp]> = [
  ["minimalista", /\bminimal(?:ist|ism)?\b|\brestrained\b|\bascetic\b|\bspare\b/gi],
  ["divertido", /\bplayful\b|\bfun\b|\bwhimsical\b|\bjoyful\b|\bfriendly\b|\bvibrant\b/gi],
  ["ousado", /\bbold\b|\bdramatic\b|\bstriking\b|\bbrutal(?:ist)?\b|\baggressive\b/gi],
  ["corporativo", /\bcorporate\b|\benterprise\b|\bprofessional\b|\btrust(?:ed)?\b|\binstitutional\b/gi],
  ["luxuoso", /\bluxur(?:y|ious)\b|\bpremium\b|\belegant\b|\bsophisticated\b|\brefined\b/gi],
  ["tecnico", /\btechnical\b|\bdeveloper\b|\bengineer(?:ed|ing)?\b|\bmonospace\b|\bcode\b/gi],
];

export function extrairClima(md: string, escuro: boolean): string[] {
  const clima = [escuro ? "escuro" : "claro"];
  const contados = CLIMAS.map(([rotulo, re]) => [rotulo, (md.match(re) ?? []).length] as const)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  for (const [rotulo] of contados) clima.push(rotulo);
  return clima;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palavra da descrição (prefixo) → rótulo de clima. */
const SINONIMOS: Array<[RegExp, string]> = [
  [/^(escur|dark|noturn|noir|preto|negro)/, "escuro"],
  [/^(clar|light|branc|luminos)/, "claro"],
  [/^(minimal|simples|limp|clean|enxut)/, "minimalista"],
  [/^(divert|ludic|alegr|colorid|jovem|descontra|playful|fun)/, "divertido"],
  [/^(ousad|forte|impactante|bold|marcante|arrojad)/, "ousado"],
  [/^(corpor|serio|sério|profission|empresari|formal|institucion|negoci)/, "corporativo"],
  [/^(lux|elegan|sofistic|premium|refinad|chique)/, "luxuoso"],
  [/^(tecnic|tecnolog|tech|dev|programa|codigo)/, "tecnico"],
];

/**
 * Ranking puro: +3 por rótulo de clima pedido que o estilo tem, +4 por nome/marca citado,
 * -5 quando pede escuro/claro e o estilo é o contrário. Empate desempata por id (determinístico).
 */
export function candidatosPorDescricao(descricao: string, indice: EstiloDesign[], n = 5): EstiloDesign[] {
  const palavras = semAcento(descricao).split(/[^a-z0-9]+/).filter(Boolean);
  const pedidos = new Set<string>();
  for (const p of palavras) for (const [re, rotulo] of SINONIMOS) if (re.test(p)) pedidos.add(rotulo);
  const texto = ` ${palavras.join(" ")} `;

  const pontos = (e: EstiloDesign): number => {
    let s = 0;
    for (const r of pedidos) if (e.clima.includes(r)) s += 3;
    const chaves = [semAcento(e.marca), semAcento(e.id)].filter((k) => k.length >= 3);
    if (chaves.some((k) => texto.includes(` ${k} `))) s += 4;
    if (pedidos.has("escuro") && !pedidos.has("claro") && !e.tokens.escuro) s -= 5;
    if (pedidos.has("claro") && !pedidos.has("escuro") && e.tokens.escuro) s -= 5;
    return s;
  };

  return indice
    .map((e) => ({ e, s: pontos(e) }))
    .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))
    .slice(0, n)
    .map((x) => x.e);
}
