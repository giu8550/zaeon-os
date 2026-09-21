/**
 * lib/studio/molecule.ts — resolve "cafeína" numa estrutura 3D de verdade.
 *
 * Fonte: PubChem PUG REST (NCBI, domínio público, sem chave de API). O que chega aqui é
 * um termo escrito por um aluno brasileiro; o que sai é um SDF com coordenadas reais —
 * medidas/calculadas pelo PubChem, não inventadas por um modelo. Essa distinção é o
 * produto inteiro: molécula desenhada por LLM é ficção com cara de ciência.
 *
 * A ponte entre os dois é mais torta do que parece. Testado contra a API real:
 *
 *   cafeina            → CID 2519 ✅        cafeína  → 404 ❌ (o acento derruba)
 *   agua               → CID 962  ✅        água     → 404 ❌
 *   acido acetico      → CID 176  ✅
 *   glicose            → 404 ❌             glucose  → CID 5793 ✅
 *   aspirina           → 404 ❌             aspirin  → CID 2244 ✅
 *   colesterol         → 404 ❌             cholesterol → CID 5997 ✅
 *
 * Ou seja: tirar acento resolve uma parte, e o resto só sai traduzindo pro inglês. Por
 * isso a cascata: termo cru → sem acento → nome em inglês (via LLM, só como ÚLTIMO passo
 * e só pra achar o nome — a estrutura continua vindo do PubChem).
 */
import { geminiJson } from "@/lib/scholar/gemini";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";

export type MoleculeData = {
  cid: number;
  /** Termo que o aluno escreveu — é o que aparece no título. */
  termo: string;
  /** Nome que realmente resolveu no PubChem (pode ser a tradução). */
  nomeResolvido: string;
  formula: string;
  peso: string;
  iupac?: string;
  smiles?: string;
  /** Molfile/SDF com as coordenadas. */
  sdf: string;
  /** false = o PubChem não tem conformação 3D; o SDF é 2D e o render sai chapado. */
  tridimensional: boolean;
  url: string;
};

export type MoleculeResult =
  | { ok: true; data: MoleculeData }
  | { ok: false; reason: string };

/** "cafeína" → "cafeina". O PubChem 404a em qualquer acento. */
export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Limpa o que a conversa gruda no termo: "estrutura molecular da cafeína" → "cafeina".
 * Não tenta ser esperto — só tira os prefixos que aparecem o tempo todo.
 */
export function limparTermo(bruto: string): string {
  let t = (bruto || "").trim().toLowerCase();
  t = t.replace(/^(a\s+)?(estrutura|formula|fórmula|molecula|molécula)\s+(molecular\s+)?(d[aeo]s?\s+)?/i, "");
  t = t.replace(/^(d[aeo]s?\s+)/i, "");
  t = t.replace(/[.?!,;]+$/g, "");
  return t.trim();
}

/** Candidatos em ordem de custo: o termo, o termo sem acento. A tradução vem depois. */
export function candidatosLocais(termo: string): string[] {
  const base = limparTermo(termo);
  const sem = semAcento(base);
  return base === sem ? [base] : [base, sem];
}

type Props = { CID: number; MolecularFormula: string; MolecularWeight: string; IUPACName?: string; ConnectivitySMILES?: string; CanonicalSMILES?: string };

async function buscarProps(nome: string, f: typeof fetch): Promise<Props | null> {
  const url = `${PUG}/name/${encodeURIComponent(nome)}/property/MolecularFormula,MolecularWeight,IUPACName,ConnectivitySMILES/JSON`;
  try {
    const r = await f(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = j?.PropertyTable?.Properties?.[0];
    return p?.CID ? (p as Props) : null;
  } catch {
    return null;
  }
}

/** SDF 3D; se o composto não tiver conformação 3D no PubChem, cai pro 2D. */
async function buscarSdf(cid: number, f: typeof fetch): Promise<{ sdf: string; tridimensional: boolean } | null> {
  for (const [tipo, tri] of [["3d", true], ["2d", false]] as const) {
    try {
      const r = await f(`${PUG}/cid/${cid}/SDF?record_type=${tipo}`);
      if (!r.ok) continue;
      const sdf = await r.text();
      // Um SDF de verdade sempre termina o bloco de átomos com "M  END".
      if (sdf.includes("M  END")) return { sdf, tridimensional: tri };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

/** Último recurso: pedir ao modelo só o NOME em inglês. A estrutura nunca vem dele. */
async function traduzirNome(termo: string): Promise<string> {
  const system =
    "Você converte o nome de uma substância química para o nome em INGLÊS usado no PubChem. " +
    'Responda SOMENTE JSON: {"nome":"..."}. Se não for uma substância química, devolva {"nome":""}.';
  try {
    const out = await geminiJson<{ nome?: string }>(system, `Substância: ${termo}`);
    return (out?.nome || "").trim();
  } catch {
    return "";
  }
}

export async function resolverMolecula(
  termoBruto: string,
  opts: { fetchImpl?: typeof fetch; traduzir?: (t: string) => Promise<string> } = {},
): Promise<MoleculeResult> {
  const f = opts.fetchImpl ?? fetch;
  const termo = limparTermo(termoBruto);
  if (!termo) return { ok: false, reason: "sem termo" };

  let props: Props | null = null;
  let nomeResolvido = "";

  for (const cand of candidatosLocais(termo)) {
    props = await buscarProps(cand, f);
    if (props) { nomeResolvido = cand; break; }
  }

  if (!props) {
    const emIngles = await (opts.traduzir ?? traduzirNome)(termo);
    if (emIngles) {
      props = await buscarProps(emIngles, f);
      if (props) nomeResolvido = emIngles;
    }
  }

  if (!props) return { ok: false, reason: `não achei "${termo}" no PubChem` };

  const est = await buscarSdf(props.CID, f);
  if (!est) return { ok: false, reason: `o PubChem não tem estrutura para "${termo}"` };

  return {
    ok: true,
    data: {
      cid: props.CID,
      termo,
      nomeResolvido,
      formula: props.MolecularFormula,
      peso: String(props.MolecularWeight),
      iupac: props.IUPACName,
      smiles: props.ConnectivitySMILES ?? props.CanonicalSMILES,
      sdf: est.sdf,
      tridimensional: est.tridimensional,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${props.CID}`,
    },
  };
}
