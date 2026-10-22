/**
 * lib/chat/arquivosSoltos.ts — os arquivos de um "soltar" no chat, INCLUSIVE de pastas inteiras (aluno arrasta a pasta
 * da matéria e tudo sobe de uma vez). `DataTransfer.files` não desce em pastas: só a API de entradas
 * (`webkitGetAsEntry`) desce. As entradas têm de ser pegas DURANTE o evento de drop (depois do primeiro await o
 * DataTransfer esvazia), por isso `entradasDoDrop` é síncrona e `arquivosDasEntradas` é a parte assíncrona.
 */

/** O pedaço da FileSystemEntry que usamos (tipado à mão: fácil de simular em teste). */
export type Entrada = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (ok: (f: File) => void, erro?: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (ok: (es: Entrada[]) => void, erro?: (e: unknown) => void) => void };
};

/** Teto de arquivos de um soltar (uma pasta com milhares de arquivos não trava a aba). */
export const MAX_ARQUIVOS_SOLTOS = 100;
const PROFUNDIDADE_MAX = 6;

/** Síncrona: chame no próprio onDrop. null = navegador sem a API de entradas (use `dataTransfer.files`). */
export function entradasDoDrop(dt: DataTransfer): Entrada[] | null {
  const itens = Array.from(dt.items ?? []);
  if (!itens.length || typeof (itens[0] as any).webkitGetAsEntry !== "function") return null;
  const es = itens.filter((i) => i.kind === "file").map((i) => (i as any).webkitGetAsEntry() as Entrada | null).filter(Boolean) as Entrada[];
  return es.length ? es : null;
}

const arquivo = (e: Entrada) => new Promise<File | null>((ok) => (e.file ? e.file(ok, () => ok(null)) : ok(null)));

/** Lê TODAS as entradas da pasta (o readEntries devolve em pedaços até vir []). */
async function filhos(e: Entrada): Promise<Entrada[]> {
  const leitor = e.createReader?.();
  if (!leitor) return [];
  const out: Entrada[] = [];
  for (;;) {
    const fatia = await new Promise<Entrada[]>((ok) => leitor.readEntries(ok, () => ok([])));
    if (!fatia.length) return out;
    out.push(...fatia);
  }
}

/** Arquivos das entradas, descendo nas pastas, na ordem; ocultos fora; para em MAX_ARQUIVOS_SOLTOS. Nunca lança. */
export async function arquivosDasEntradas(entradas: Entrada[]): Promise<File[]> {
  const out: File[] = [];
  const visitar = async (es: Entrada[], nivel: number): Promise<void> => {
    for (const e of es) {
      if (out.length >= MAX_ARQUIVOS_SOLTOS) return;
      if (e.name.startsWith(".")) continue;
      if (e.isFile) {
        const f = await arquivo(e);
        if (f) out.push(f);
      } else if (e.isDirectory && nivel < PROFUNDIDADE_MAX) {
        await visitar(await filhos(e), nivel + 1);
      }
    }
  };
  await visitar(entradas, 0);
  return out;
}
