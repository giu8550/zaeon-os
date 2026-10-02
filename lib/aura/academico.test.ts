import { describe, it, expect } from "vitest";
import { elegibilidade, metodoPermitido, hashDocumento, docValido, viewPublica, isStatus } from "./academico";

const prof = (x: Partial<Parameters<typeof elegibilidade>[0]> = {}) => ({ id: "p1", role: "teacher", verificadorHabilitado: true, temCredencialVerificada: false, ...x });

describe("academico · elegibilidade (quem chancela)", () => {
  it("ninguém verifica a própria credencial", () => {
    expect(elegibilidade(prof({ id: "a1" }), "a1", true)).toEqual({ ok: false, motivo: "conflito" });
  });
  it("professor: precisa estar habilitado OU ter credencial verificada, E vinculado", () => {
    expect(elegibilidade(prof(), "a1", true)).toEqual({ ok: true, papel: "professor" });
    expect(elegibilidade(prof({ verificadorHabilitado: false, temCredencialVerificada: true }), "a1", true)).toEqual({ ok: true, papel: "professor" });
    expect(elegibilidade(prof({ verificadorHabilitado: false }), "a1", true)).toEqual({ ok: false, motivo: "nao_habilitado" });
    expect(elegibilidade(prof(), "a1", false)).toEqual({ ok: false, motivo: "sem_vinculo" });
    expect(elegibilidade(prof({ role: "professor" }), "a1", true).ok).toBe(true);
  });
  it("instituição: só vínculo; aluno nunca; admin só modera", () => {
    expect(elegibilidade(prof({ role: "instituicao", verificadorHabilitado: false }), "a1", true)).toEqual({ ok: true, papel: "instituicao" });
    expect(elegibilidade(prof({ role: "instituicao" }), "a1", false)).toEqual({ ok: false, motivo: "sem_vinculo" });
    expect(elegibilidade(prof({ role: "student" }), "a1", true)).toEqual({ ok: false, motivo: "papel" });
    expect(elegibilidade(prof({ role: "student", isSuperAdmin: true }), "a1", false)).toEqual({ ok: true, papel: "admin" });
  });
});

describe("academico · metodoPermitido (portão)", () => {
  it("doc_review exige documento; registry/onchain só instituição; admin nunca verifica", () => {
    expect(metodoPermitido("professor", undefined, true)).toBe("doc_review");
    expect(metodoPermitido("professor", "doc_review", false)).toBeNull();
    expect(metodoPermitido("professor", "registry", true)).toBeNull();
    expect(metodoPermitido("instituicao", "registry", true)).toBe("registry");
    expect(metodoPermitido("instituicao", "onchain", false)).toBe("onchain");
    expect(metodoPermitido("admin", "doc_review", true)).toBeNull();
    expect(metodoPermitido("professor", "declarado", true)).toBeNull();
    expect(metodoPermitido("professor", "edu_email", true)).toBeNull();
  });
});

describe("academico · documento", () => {
  it("hash do conteúdo ignora o header; mesmo diploma = mesmo hash", () => {
    const a = hashDocumento("data:application/pdf;base64,QUJD"), b = hashDocumento("data:image/png;base64,QUJD");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(hashDocumento("data:application/pdf;base64,QUJE")).not.toBe(a);
  });
  it("docValido: só PDF/imagem em data URL, até o teto", () => {
    expect(docValido("data:application/pdf;base64,QUJD")).toBe(true);
    expect(docValido("data:image/jpeg;base64,QUJD")).toBe(true);
    expect(docValido("data:text/html;base64,QUJD")).toBe(false);
    expect(docValido("https://x/diploma.pdf")).toBe(false);
    expect(docValido("data:application/pdf;base64," + "A".repeat(5_600_001))).toBe(false);
    expect(docValido(null)).toBe(false);
  });
  it("viewPublica nunca carrega o documento", () => {
    const v = viewPublica({ id: "c", nivel: "mestrado", area: "Agro", instituicao: "UFX", metodo: "doc_review", status: "pendente", verifiedAt: null, createdAt: new Date(0), docRef: "data:...", docHash: "h" } as any);
    expect(v).not.toHaveProperty("docRef");
    expect(v).not.toHaveProperty("docHash");
    expect(isStatus("verificado")).toBe(true);
    expect(isStatus("x")).toBe(false);
  });
});
