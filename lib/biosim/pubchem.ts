/**
 * lib/biosim/pubchem.ts
 *
 * Resolver de estrutura 3D do PubChem → VoxelBlock[], compartilhado entre a rota
 * /api/agentic/biosim/pubchem e o roteador /api/agentic/biosim (chamada DIRETA,
 * sem hop HTTP interno). Otimizações de latência:
 *   • cache em memória por nome normalizado (estruturas são imutáveis → nunca expira);
 *   • conformer 3D + propriedades buscados EM PARALELO (Promise.all) após o CID;
 *   • timeouts curtos por request (não trava a UX se o PubChem estiver lento).
 */

export interface VoxelBlock {
  x: number;
  y: number;
  z: number;
  color: string;
  label: string;
}

export interface PubChemResult {
  ok: true;
  source: "pubchem";
  cid: number;
  name: string;
  formula: string;
  weight: number | null;
  atomCount: number;
  voxels: VoxelBlock[];
  pubchemUrl: string;
}
export interface PubChemError {
  ok: false;
  status: number;
  error: string;
  cid?: number;
}

const CPK: Record<string, string> = {
  H: "#ffffff", C: "#404040", N: "#3b82f6", O: "#ef4444",
  F: "#22c55e", Cl: "#22c55e", Br: "#7f1d1d", I: "#5b21b6",
  S: "#eab308", P: "#f97316", Fe: "#b45309", Ca: "#99f6e4",
  Mg: "#34d399", Na: "#7c3aed", K: "#a78bfa", Zn: "#6ee7b7",
  Cu: "#f59e0b", Co: "#60a5fa", Mn: "#f472b6", Se: "#fbbf24",
  Si: "#94a3b8", B: "#fde68a", Li: "#bfdbfe", Al: "#cbd5e1",
};
const DEFAULT_COLOR = "#a78bfa";
const ATOMIC_NUMBER_TO_SYMBOL: Record<number, string> = {
  1: "H", 2: "He", 3: "Li", 4: "Be", 5: "B", 6: "C", 7: "N", 8: "O", 9: "F", 10: "Ne",
  11: "Na", 12: "Mg", 13: "Al", 14: "Si", 15: "P", 16: "S", 17: "Cl", 18: "Ar",
  19: "K", 20: "Ca", 26: "Fe", 27: "Co", 28: "Ni", 29: "Cu", 30: "Zn", 34: "Se",
  35: "Br", 53: "I", 56: "Ba", 79: "Au", 80: "Hg", 82: "Pb",
};

const elementSymbol = (n: number) => ATOMIC_NUMBER_TO_SYMBOL[n] ?? "X";
function dedup(blocks: VoxelBlock[]) {
  const map = new Map<string, VoxelBlock>();
  blocks.forEach((b) => map.set(`${b.x},${b.y},${b.z}`, b));
  return [...map.values()];
}

// Cache em memória (o container web é longevo → persiste entre requests).
const CACHE = new Map<string, PubChemResult>();
const MAX_CACHE = 500;

async function fetchJson(url: string, ms = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function resolvePubChem(rawName: string): Promise<PubChemResult | PubChemError> {
  const name = (rawName ?? "").trim();
  if (!name) return { ok: false, status: 400, error: "Compound name required" };

  const key = name.toLowerCase();
  const cached = CACHE.get(key);
  if (cached) return cached;

  const compound = encodeURIComponent(name);
  const BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";

  // 1) nome → CID
  const cidJson = await fetchJson(`${BASE}/name/${compound}/cids/JSON`);
  const cid: number | undefined = cidJson?.IdentifierList?.CID?.[0];
  if (!cid) return { ok: false, status: 404, error: `Composto "${name}" não encontrado no PubChem` };

  // 2) conformer 3D + propriedades EM PARALELO (era sequencial → -1 round-trip)
  const [mol3d, propJson] = await Promise.all([
    fetchJson(`${BASE}/cid/${cid}/record/JSON?record_type=3d`),
    fetchJson(`${BASE}/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`),
  ]);

  const compoundData = mol3d?.PC_Compounds?.[0];
  const conformer = compoundData?.coords?.[0]?.conformers?.[0];
  const elements: number[] = compoundData?.atoms?.element ?? [];
  if (!conformer || !elements.length) {
    return { ok: false, status: 422, error: `Sem conformer 3D para "${name}" (CID ${cid}).`, cid };
  }

  const xs: number[] = conformer.x, ys: number[] = conformer.y, zs: number[] = conformer.z;
  const n = Math.min(xs.length, ys.length, zs.length, elements.length);
  if (n === 0) return { ok: false, status: 422, error: "Arrays de coordenadas vazios", cid };

  const cx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const cy = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const cz = zs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const maxDist = Math.max(
    ...xs.slice(0, n).map((v, i) => Math.sqrt((v - cx) ** 2 + (ys[i] - cy) ** 2 + (zs[i] - cz) ** 2)),
  );
  const scale = maxDist > 0 ? 10 / maxDist : 2;

  const blocks: VoxelBlock[] = [];
  for (let i = 0; i < n; i++) {
    const sym = elementSymbol(elements[i]);
    const color = CPK[sym] ?? DEFAULT_COLOR;
    const vx = Math.round((xs[i] - cx) * scale);
    const vy = Math.round((ys[i] - cy) * scale);
    const vz = Math.round((zs[i] - cz) * scale);
    blocks.push({ x: vx, y: vy, z: vz, color, label: sym });
    if (["O", "N", "S", "P", "Fe", "Cl", "Br"].includes(sym)) {
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(([dx, dy, dz]) => {
        blocks.push({ x: vx + dx, y: vy + dy, z: vz + dz, color, label: sym });
      });
    }
  }

  const props = propJson?.PropertyTable?.Properties?.[0] ?? {};
  const result: PubChemResult = {
    ok: true,
    source: "pubchem",
    cid,
    name: props.IUPACName ?? name,
    formula: props.MolecularFormula ?? "",
    weight: props.MolecularWeight ?? null,
    atomCount: n,
    voxels: dedup(blocks),
    pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
  };

  if (CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, result);
  return result;
}

// Heurística barata: o prompt é claramente só o nome de um composto?
// (curto, sem verbos/pergunta) → pula o Gemini e vai direto ao PubChem.
const COMMON_MOLECULES = new Set([
  "water", "água", "agua", "caffeine", "cafeína", "cafeina", "aspirin", "aspirina",
  "glucose", "glicose", "ethanol", "etanol", "methane", "metano", "benzene", "benzeno",
  "acetone", "acetona", "ammonia", "amônia", "amonia", "co2", "dióxido de carbono",
  "atp", "dna", "adrenaline", "adrenalina", "dopamine", "dopamina", "serotonin", "serotonina",
  "mescaline", "mescalina", "penicillin", "penicilina", "paracetamol", "ibuprofen", "ibuprofeno",
  "cholesterol", "colesterol", "testosterone", "testosterona", "estrogen", "estrogênio",
  "nicotine", "nicotina", "morphine", "morfina", "lsd", "thc", "cbd", "citric acid", "ácido cítrico",
]);

export function looksLikeMoleculeName(prompt: string): string | null {
  const p = (prompt ?? "").trim().toLowerCase().replace(/[?.!]+$/g, "");
  if (!p || p.length > 40) return null;
  if (COMMON_MOLECULES.has(p)) return prompt.trim();
  // fórmula química simples (ex.: C8H10N4O2, H2O, NaCl)
  if (/^[A-Z][a-z]?\d*([A-Z][a-z]?\d*){0,9}$/.test(prompt.trim())) return prompt.trim();
  // 1-2 palavras, sem verbo/pergunta → provável nome de composto
  const words = p.split(/\s+/);
  if (words.length <= 2 && !/\b(o que|what|como|how|why|por que|mostr|show|gera|desenh|explica|é|is|are)\b/.test(p)) {
    return prompt.trim();
  }
  return null;
}
