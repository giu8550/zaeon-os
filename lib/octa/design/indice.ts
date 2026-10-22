/**
 * lib/octa/design/indice.ts — índice da biblioteca DESIGN.md (vendor/design-md, VoltAgent/awesome-design-md, MIT).
 *
 *   carregarIndice()              lê vendor/design-md/indice.json (gerado por scripts/sync-design-md.mjs)
 *   lerDesignMd(id)               markdown bruto de um estilo do índice
 *   designMdComMarcador(id)       o DESIGN.md do projeto (marcador zaeon-estilo + markdown)
 *   candidatosPorDescricao(...)   ranking puro por clima + nome, para o agente escolher o estilo
 *   extrairClima / marcaDoEstilo  usados pelo script de sync ao montar o índice
 *   palavrasDaMarca(e)            marca + aliases: o que a página do aluno nunca pode dizer
 *   estiloDoProjeto(arquivos)     o estilo do projeto, pelo marcador zaeon-estilo do DESIGN.md
 *
 * Só roda no servidor (fs). Lê de process.cwd(): o Dockerfile copia a raiz inteira (COPY . .).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TokensDesign } from "./tokens";

export type EstiloDesign = {
  id: string;
  nome: string;
  /** Nome da marca de origem (rótulo/crédito na galeria). A página do aluno nunca pode conter isto (regra anti-marca). */
  marca: string;
  /** Outras formas do nome da marca, também proibidas na página ("RunwayML", "Grok"…). */
  aliases?: string[];
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

/** `linear.app` → "Linear", `bmw-m` → "Bmw M", `x.ai` → "X". Só o fallback: veja MARCAS_EXPLICITAS. */
export function marcaDaPasta(pasta: string): string {
  const base = pasta.replace(/\.(app|ai|com|io|dev)$/i, "");
  return base
    .split(/[-.]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Onde o nome da pasta não é o nome da marca (ano/sufixo no id, palavras grudadas, sigla). A regra anti-marca
 * casa palavra inteira, então "Nintendo 2001" deixaria passar "Nintendo" e "Theverge" deixaria "The Verge".
 */
export const MARCAS_EXPLICITAS: Record<string, { marca: string; aliases?: string[]; /** rótulo na galeria, se não for a marca */ nome?: string }> = {
  aljazeera: { marca: "Al Jazeera", aliases: ["Aljazeera"] },
  bmw: { marca: "BMW" },
  "bmw-m": { marca: "BMW", nome: "BMW M" },
  "dell-1996": { marca: "Dell", nome: "Dell 1996" },
  "nintendo-2001": { marca: "Nintendo", nome: "Nintendo 2001" },
  runwayml: { marca: "Runway", aliases: ["RunwayML"] },
  theverge: { marca: "The Verge", aliases: ["TheVerge"] },
  // "X" sozinho casaria com x.com e com qualquer "x" solto: fica como alias (não varrido, 1 letra)
  "x.ai": { marca: "xAI", aliases: ["X", "Grok"] },
  dji: { marca: "DJI" },
  hp: { marca: "HP" },
  ibm: { marca: "IBM" },
  sap: { marca: "SAP" },
  mongodb: { marca: "MongoDB" },
  elevenlabs: { marca: "ElevenLabs" },
  hashicorp: { marca: "HashiCorp" },
  posthog: { marca: "PostHog" },
  spacex: { marca: "SpaceX" },
  clickhouse: { marca: "ClickHouse" },
  playstation: { marca: "PlayStation" },
  nerdwallet: { marca: "NerdWallet" },
  "opencode.ai": { marca: "OpenCode" },
  voltagent: { marca: "VoltAgent" },
  minimax: { marca: "MiniMax" },
};

/** Marca + aliases de um estilo pelo id da pasta (o sync grava isto no índice). */
export function marcaDoEstilo(pasta: string): { marca: string; aliases: string[]; nome: string } {
  const o = MARCAS_EXPLICITAS[pasta];
  if (!o) { const marca = marcaDaPasta(pasta); return { marca, aliases: [], nome: marca }; }
  return { marca: o.marca, aliases: [...(o.aliases ?? [])], nome: o.nome ?? o.marca };
}

/** Todas as formas do nome da marca (sem repetir). Quem varre o texto pula as de 1 letra. */
export function palavrasDaMarca(e: Pick<EstiloDesign, "marca" | "aliases"> | undefined | null): string[] {
  if (!e) return [];
  const vistas = new Set<string>();
  return [e.marca, ...(e.aliases ?? [])].map((w) => String(w ?? "").trim()).filter((w) => {
    const k = w.toLowerCase();
    if (!w || vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

const RE_MARCADOR = /^<!-- zaeon-estilo: ([^\s]+) -->\r?\n?/;

/** O DESIGN.md do projeto (raiz): o estilo de origem (se veio da biblioteca) e o markdown sem o marcador. */
export function estiloDoProjeto(arquivos: Record<string, string> | null | undefined): { estilo?: EstiloDesign; md: string } | null {
  const bruto = arquivos?.["DESIGN.md"];
  if (typeof bruto !== "string") return null;
  const m = bruto.match(RE_MARCADOR);
  const estilo = m ? carregarIndice().find((e) => e.id === m[1]) : undefined;
  return { estilo, md: m ? bruto.slice(m[0].length) : bruto };
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
