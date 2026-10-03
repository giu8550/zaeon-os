import { describe, it, expect, vi, beforeEach } from "vitest";
import { aplicarPuro, decidirPuro, cerebroCompleto, podeValidar, aplicarNo, decidirValidacao, pagarRealizados, type ValidacaoDeps, type ValidacaoRow } from "@/lib/map/validacao";
import { normalizarBackbone } from "@/lib/map/backbone";
import { auraDoNo, pesoAura, daAtestado, AURA } from "@/lib/aura/rules";
import type { MapaView } from "@/lib/map/tipos";

const bb = normalizarBackbone({ passos: [{ label: "Fundamentos" }, { label: "Medir" }, { label: "Comprovar" }] }, "aplicavel", [])!;
const mapaBase = (over: Partial<MapaView> = {}): MapaView => ({
  id: "0123456789abcdef01234567", ownerId: "aaaaaaaaaaaaaaaaaaaaaaaa", surface: "estudos", scopeId: "t1", titulo: "Solo",
  tipoTopico: "aplicavel", objetivo: "o", modoValidacao: "humana", criterioCompletude: "", nos: bb.nos, arestas: bb.arestas, backbone: bb.backbone,
  completudeAprendizado: 0, completudeConclusao: 0, rev: 0, updatedAt: new Date(), ...over,
});
const n0 = bb.backbone[0]!, n1 = bb.backbone[1]!, n2 = bb.backbone[2]!;

describe("pesos AURA por arquétipo × validação", () => {
  it("validado-humana ≫ rubrica/quiz/peer ≫ cobertura; nunca zero; atestado só em humana", () => {
    const h = auraDoNo("node_validated", "aplicavel", "humana"), q = auraDoNo("node_validated", "conceitual", "quiz"), c = auraDoNo("node_validated", "exploratorio", "cobertura");
    expect(h).toBe(AURA.node_validated); expect(h).toBeGreaterThan(q); expect(q).toBeGreaterThan(c); expect(c).toBeGreaterThanOrEqual(1);
    expect(auraDoNo("node_learned", "criativo", "nenhuma")).toBe(1);
    expect(pesoAura("aplicavel", "humana")).toBe(1);
    expect(daAtestado("humana")).toBe(true); expect(daAtestado("rubrica")).toBe(false);
  });
});

describe("puro", () => {
  it("aplicarPuro: a_conquistar → aplicado; validado não reaplica; nó inexistente", () => {
    const r = aplicarPuro(mapaBase(), n0);
    expect(r.ok && r.nos.find((n) => n.id === n0)!.estado).toBe("aplicado");
    expect(r.ok && r.abreValidacao).toBe(true);
    expect(aplicarPuro(mapaBase({ modoValidacao: "quiz" }), n0)).toMatchObject({ ok: true, abreValidacao: false });
    const val = mapaBase({ nos: bb.nos.map((n) => (n.id === n0 ? { ...n, estado: "validado" } : n)) });
    expect(aplicarPuro(val, n0)).toEqual({ ok: false, motivo: "ja_validado" });
    expect(aplicarPuro(mapaBase(), "zzz")).toEqual({ ok: false, motivo: "no_inexistente" });
  });
  it("decidirPuro: aprovar → validado; rejeitar → volta pra aprendido (forçado)", () => {
    const ap = aplicarPuro(mapaBase(), n0); if (!ap.ok) throw new Error();
    expect(decidirPuro(ap.nos, n0, "aprovada")!.estado).toBe("validado");
    const rej = decidirPuro(ap.nos, n0, "rejeitada")!;
    expect(rej.nos.find((n) => n.id === n0)!.estado).toBe("aprendido");
    expect(decidirPuro(ap.nos, "zzz", "aprovada")).toBeNull();
  });
  it("cerebroCompleto respeita o gate do modo", () => {
    const todosAplicados = bb.nos.map((n) => ({ ...n, estado: "aplicado" as const }));
    expect(cerebroCompleto(mapaBase({ nos: todosAplicados }))).toBe(false);                       // humana exige validado
    expect(cerebroCompleto(mapaBase({ nos: todosAplicados, modoValidacao: "rubrica" }))).toBe(true);
    expect(cerebroCompleto(mapaBase({ backbone: [] }))).toBe(false);
  });
  it("podeValidar: nunca o próprio; professor habilitado + vinculado; instituição vinculada; aluno não", () => {
    const prof = { id: "p", role: "teacher", verificadorHabilitado: true, temCredencialVerificada: false };
    expect(podeValidar({ ...prof, id: "a" }, "a", true)).toEqual({ ok: false, motivo: "conflito" });
    expect(podeValidar(prof, "a", true)).toEqual({ ok: true, papel: "teacher" });
    expect(podeValidar(prof, "a", false)).toEqual({ ok: false, motivo: "sem_vinculo" });
    expect(podeValidar({ ...prof, verificadorHabilitado: false }, "a", true)).toEqual({ ok: false, motivo: "nao_habilitado" });
    expect(podeValidar({ id: "i", role: "instituicao", verificadorHabilitado: false, temCredencialVerificada: false }, "a", true)).toEqual({ ok: true, papel: "instituicao" });
    expect(podeValidar({ id: "s", role: "student", verificadorHabilitado: true, temCredencialVerificada: true }, "a", true)).toEqual({ ok: false, motivo: "papel" });
  });
});

describe("fluxo com deps mockadas", () => {
  let mapa: MapaView;
  const deps = () => {
    const d = {
      patchMapa: vi.fn(async (_id: string, fn: any) => { const delta = fn(mapa); if (!delta) return { ok: true, mapa }; mapa = { ...mapa, ...delta, rev: mapa.rev + 1 }; return { ok: true, mapa }; }),
      grantAura: vi.fn(async (_i: any) => ({ ok: true })),
      issueCredential: vi.fn(async (_u: string, _i: any) => ({ id: "cred1" })),
      validacoes: { upsertPendente: vi.fn(async (i: any) => ({ id: "v1", ...i, status: "pendente", comentario: null, credentialId: null, createdAt: new Date() })), update: vi.fn(async (id: string, data: any) => ({ id, mapaId: mapa.id, noId: n0, alunoId: mapa.ownerId, validadorId: "p", role: "teacher", evidencia: null, createdAt: new Date(), comentario: null, credentialId: null, ...data })) },
      professoresDe: vi.fn(async () => ["bbbbbbbbbbbbbbbbbbbbbbbb"]),
      auraLigada: () => true,
    };
    return d as unknown as ValidacaoDeps & typeof d;
  };
  beforeEach(() => { mapa = mapaBase(); });

  it("humana: apply → aplicado + validação pendente pro professor vinculado; sem professor → 409 lógico; sem AURA ainda", async () => {
    const d = deps();
    const r = await aplicarNo(d, mapa, n0, "foto do laudo");
    expect(r.ok && r.validacao?.status).toBe("pendente");
    expect(r.ok && r.mapa.nos.find((n) => n.id === n0)!.estado).toBe("aplicado");
    expect(d.validacoes.upsertPendente.mock.calls[0]![0]).toMatchObject({ validadorId: "bbbbbbbbbbbbbbbbbbbbbbbb", evidencia: "foto do laudo", role: "teacher" });
    expect(d.grantAura).not.toHaveBeenCalled();
    d.professoresDe.mockResolvedValue([]);
    expect(await aplicarNo(d, mapa, n1, null)).toEqual({ ok: false, motivo: "sem_professor" });
  });

  it("aprovar → validado + node_validated pesado + atestado 1× + completudes; aprovar de novo → ja_decidida; rejeitar → volta", async () => {
    const d = deps();
    await aplicarNo(d, mapa, n0, "ev");
    const v: ValidacaoRow = { id: "v1", mapaId: mapa.id, noId: n0, alunoId: mapa.ownerId, validadorId: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "teacher", evidencia: "ev", status: "pendente", comentario: null, credentialId: null, createdAt: new Date() };
    const r = await decidirValidacao(d, v, mapa, "aprovada", "ok");
    expect(r.ok && r.estado).toBe("validado");
    expect(r.ok && r.credentialId).toBe("cred1");
    expect(d.grantAura).toHaveBeenCalledWith(expect.objectContaining({ source: "node_validated", refId: `${mapa.id}:${n0}`, amount: AURA.node_validated }));
    expect(d.issueCredential).toHaveBeenCalledTimes(1);
    expect(d.issueCredential.mock.calls[0]![1]).toMatchObject({ type: "skill", standard: "token2022-nt", refId: `${mapa.id}:${n0}` });
    expect(mapa.completudeConclusao).toBeCloseTo(1 / 3);
    expect(await decidirValidacao(d, { ...v, status: "aprovada" }, mapa, "aprovada", null)).toEqual({ ok: false, motivo: "ja_decidida" });
    // rejeitar outro nó
    await aplicarNo(d, mapa, n1, "ev2");
    const r2 = await decidirValidacao(d, { ...v, id: "v2", noId: n1 }, mapa, "rejeitada", "faltou dado");
    expect(r2.ok && r2.estado).toBe("aprendido");
    expect(d.issueCredential).toHaveBeenCalledTimes(1);
  });

  it("mint falha → validação segue sem credentialId", async () => {
    const d = deps(); d.issueCredential.mockRejectedValue(new Error("crossmint"));
    await aplicarNo(d, mapa, n0, "ev");
    const r = await decidirValidacao(d, { id: "v1", mapaId: mapa.id, noId: n0, alunoId: mapa.ownerId, validadorId: "p", role: "teacher", evidencia: null, status: "pendente", comentario: null, credentialId: null, createdAt: new Date() }, mapa, "aprovada", null);
    expect(r.ok && r.estado).toBe("validado"); expect(r.ok && r.credentialId).toBeNull();
  });

  it("brain_completed 1× quando o último nó do backbone passa o gate (humana)", async () => {
    const d = deps();
    for (const id of [n0, n1, n2]) {
      await aplicarNo(d, mapa, id, "ev");
      await decidirValidacao(d, { id: "v" + id, mapaId: mapa.id, noId: id, alunoId: mapa.ownerId, validadorId: "p", role: "teacher", evidencia: null, status: "pendente", comentario: null, credentialId: null, createdAt: new Date() }, mapa, "aprovada", null);
    }
    const brains = d.grantAura.mock.calls.filter((c: any[]) => c[0].source === "brain_completed");
    expect(brains).toHaveLength(1); expect(brains[0]![0]).toMatchObject({ refId: mapa.id, amount: AURA.brain_completed });
    expect(mapa.completudeConclusao).toBe(1);
  });

  it("modo quiz (conceitual): apply paga node_applied pesado, sem validação nem atestado; reaplicar não paga de novo", async () => {
    mapa = mapaBase({ tipoTopico: "conceitual", modoValidacao: "quiz" });
    const d = deps();
    const r = await aplicarNo(d, mapa, n0, null);
    expect(r.ok && r.validacao).toBeNull();
    expect(d.grantAura).toHaveBeenCalledWith(expect.objectContaining({ source: "node_applied", amount: auraDoNo("node_applied", "conceitual", "quiz") }));
    expect(d.issueCredential).not.toHaveBeenCalled();
    await aplicarNo(d, mapa, n0, null);
    expect(d.grantAura).toHaveBeenCalledTimes(1);
  });

  it("AURA_ECONOMY off: transições acontecem, ledger não é tocado", async () => {
    mapa = mapaBase({ modoValidacao: "rubrica", tipoTopico: "habilidade" });
    const d = deps(); (d as any).auraLigada = () => false;
    const r = await aplicarNo(d, mapa, n0, null);
    expect(r.ok && r.estado).toBe("aplicado"); expect(d.grantAura).not.toHaveBeenCalled();
    await pagarRealizados(d, mapa, [n1]); expect(d.grantAura).not.toHaveBeenCalled();
  });

  it("pagarRealizados: node_learned pesado por nó do plano realizado (refId mapa:nó)", async () => {
    const d = deps();
    await pagarRealizados(d, mapa, [n0, "zzz"]);
    expect(d.grantAura).toHaveBeenCalledTimes(1);
    expect(d.grantAura.mock.calls[0]![0]).toMatchObject({ source: "node_learned", refId: `${mapa.id}:${n0}`, amount: auraDoNo("node_learned", "aplicavel", "humana") });
  });
});
