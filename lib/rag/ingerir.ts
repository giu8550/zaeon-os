/**
 * lib/rag/ingerir.ts — PDF → documento + trechos na base RAG (sem vetor ainda; `enfileirar` cuida da indexação).
 *
 * Dedupe por SHA-256 dos bytes: o mesmo arquivo em outra turma/aluno só acrescenta a permissão ao documento
 * existente (não reextrai, não reindexa). Documento em status "erro" não conta como existente: é apagado e o
 * arquivo é processado como novo (re-upload é a forma de tentar de novo).
 */
import { createHash } from "node:crypto";
import type { extractPdfStructured } from "@/lib/scholar/pdf";
import type { Block } from "@/lib/scholar/types";
import { cortarEmTrechos } from "./corte";
import {
  acrescentarPermissao, apagarDocumento, buscarPorHash, criarDocumento, gravarTrechos, marcarErro,
  type Permissao, type RagDb, type RagDocumentoRow,
} from "./store";

export const MAX_BYTES = 25 * 1024 * 1024;

export type IngerirDeps = {
  db: RagDb;
  extrair: typeof extractPdfStructured;
  /** Agenda a indexação (vetores) do documento. O retorno é ignorado. */
  enfileirar: (documentoId: string) => Promise<unknown>;
};

export type IngerirEntrada = {
  bytes: Uint8Array;
  nomeArquivo: string;
  titulo?: string;
  origem: "admin" | "chat" | "gerado";
  criadoPor: string;
  permissao: Permissao;
};

export type IngerirResultado = {
  documentoId: string;
  status: "novo" | "reaproveitado" | "erro";
  erro?: "grande_demais" | "sem_texto" | "leitura_falhou";
  trechos: number;
  paginas: number;
};

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const semPdf = (nome: string) => nome.replace(/\.pdf$/i, "");
const maiorPagina = (blocks: Block[]) => blocks.reduce((m, b) => (typeof b.page === "number" && b.page > m ? b.page : m), 0);

async function reaproveitar(db: RagDb, doc: RagDocumentoRow, perm: Permissao): Promise<IngerirResultado> {
  await acrescentarPermissao(db, doc.id, perm);
  return { documentoId: doc.id, status: "reaproveitado", trechos: doc.totalTrechos, paginas: doc.paginas };
}

export async function ingerirPdf(deps: IngerirDeps, e: IngerirEntrada): Promise<IngerirResultado> {
  const { db } = deps;
  if (e.bytes.byteLength > MAX_BYTES) return { documentoId: "", status: "erro", erro: "grande_demais", trechos: 0, paginas: 0 };

  const hash = sha256(e.bytes);
  const existente = await buscarPorHash(db, hash);
  if (existente) {
    if (existente.status !== "erro") return reaproveitar(db, existente, e.permissao);
    await apagarDocumento(db, existente.id); // tentativa anterior falhou: reprocessa
  }

  const titulo = e.titulo?.trim() || semPdf(e.nomeArquivo);

  // Extração + corte. Qualquer falha de leitura vira documento em "erro" (aparece na lista do admin).
  let blocks: Block[] = [];
  let markdown = "";
  let erro: "sem_texto" | "leitura_falhou" | null = null;
  let trechosCortados: ReturnType<typeof cortarEmTrechos> = [];
  try {
    const r = await deps.extrair(e.bytes);
    blocks = r?.blocks ?? [];
    markdown = r?.markdown ?? blocks.map((b) => b.text).join("\n\n");
    trechosCortados = blocks.length ? cortarEmTrechos(blocks, titulo) : [];
    if (trechosCortados.length === 0) erro = "sem_texto";
  } catch {
    erro = "leitura_falhou";
  }
  const paginas = maiorPagina(blocks);

  let doc: RagDocumentoRow;
  try {
    doc = await criarDocumento(db, {
      hash, titulo, nomeArquivo: e.nomeArquivo, paginas, markdown, origem: e.origem, criadoPor: e.criadoPor, permissao: e.permissao,
    });
  } catch (err) {
    // Upload concorrente do mesmo arquivo: o hash é único, o outro ganhou — reaproveita o dele.
    if ((err as { code?: string })?.code === "P2002") {
      const vencedor = await buscarPorHash(db, hash);
      if (vencedor) return reaproveitar(db, vencedor, e.permissao);
    }
    throw err;
  }

  if (erro) {
    await marcarErro(db, doc.id, erro);
    return { documentoId: doc.id, status: "erro", erro, trechos: 0, paginas };
  }

  const total = await gravarTrechos(db, doc.id, trechosCortados, { turmaIds: doc.turmaIds, donoIds: doc.donoIds });
  await deps.enfileirar(doc.id);
  return { documentoId: doc.id, status: "novo", trechos: total, paginas };
}
