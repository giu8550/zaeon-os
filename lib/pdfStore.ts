/**
 * lib/pdfStore.ts — os BYTES dos PDFs enviados pelo aluno, no IndexedDB do navegador.
 *
 * Antes o PDF inteiro ia como data: URL (base64) pro localStorage, que tem ~5 MB NO TOTAL: um artigo
 * comum (2–5 MB → ~3–7 MB em base64) estourava a cota, o `setItem` lançava e o upload sumia sem aviso.
 * Agora o localStorage guarda só os METADADOS (`pdfUrl: "idb:<id>"`) e o arquivo mora aqui — sem
 * limite prático. Sem IndexedDB (modo privado antigo etc.) as funções falham em silêncio (null/false).
 */
const DB = "zaeon-pdfs";
const STORE = "pdfs";

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function tx<T>(modo: IDBTransactionMode, fazer: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return abrir().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null);
    try {
      const r = fazer(db.transaction(STORE, modo).objectStore(STORE));
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  }));
}

/** guarda o PDF; true = gravou */
export async function guardarPdf(id: string, blob: Blob): Promise<boolean> {
  return (await tx("readwrite", (s) => s.put(blob, id))) !== null;
}
export function lerPdf(id: string): Promise<Blob | null> { return tx<Blob>("readonly", (s) => s.get(id)); }
export async function apagarPdf(id: string): Promise<void> { await tx("readwrite", (s) => s.delete(id)); }

/** `pdfUrl` de um arquivo que mora no IndexedDB */
export const urlIdb = (id: string) => `idb:${id}`;
export const idDaUrlIdb = (u: string): string | null => (u.startsWith("idb:") ? u.slice(4) : null);

/** data: URL → Blob (sem fetch: funciona com CSP restrita) */
export function dataUrlParaBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  try {
    const mime = m[1] || "application/pdf";
    if (!m[2]) return new Blob([decodeURIComponent(m[3]!)], { type: mime });
    const bin = atob(m[3]!), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch { return null; }
}

/** Blob → data: URL (o que a rota do chat aceita em `fileData`) */
export function blobParaDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}
