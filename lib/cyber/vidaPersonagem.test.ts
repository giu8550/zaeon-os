import { describe, expect, it } from "vitest";
import { ATIVIDADES, EPOCA, LUGARES, PERFIS_VIDA, blocoEm, estadoEm, motoEm, permitido, posNoLugar, proximoBloco, rotaEntre, VOO_DA_MOTO, type Bloco } from "./vidaPersonagem";
import { livre, comprimento } from "./caminhos";
import { CIDADE } from "./ceu";

const SEMENTE = PERFIS_VIDA.nina!, AURA = PERFIS_VIDA.aura!;
const dia = (d: number, h = 0) => EPOCA + d * 86400 + h * 3600;

describe("a vida própria dos personagens (agenda)", () => {
  it("é determinística: o mesmo relógio dá o mesmo bloco e o mesmo estado (todo cliente vê igual)", () => {
    const t = dia(9, 15.37);
    expect(blocoEm(t, SEMENTE)).toEqual(blocoEm(t, SEMENTE));
    const a = estadoEm(t, SEMENTE), b = estadoEm(t, SEMENTE, blocoEm(t - 400, SEMENTE));
    expect(a.pos).toEqual(b.pos); expect(a.atividade).toBe(b.atividade);
  });
  it("não repete a atividade nem o lugar em seguida, e o trabalho volta sempre", () => {
    let b: Bloco = blocoEm(dia(3), SEMENTE); const vistas: string[] = [];
    let semTrabalhar = 0, maxSem = 0;
    for (let i = 0; i < 400; i++) {
      const n = proximoBloco(b, SEMENTE);
      expect(n.atividade).not.toBe(b.atividade); expect(n.lugar).not.toBe(b.lugar);
      expect(n.ini).toBe(b.fim); expect(n.fim).toBeGreaterThan(n.ini);
      expect(LUGARES[n.lugar]!.atividade).toBe(n.atividade);
      vistas.push(n.atividade); semTrabalhar = n.atividade === "trabalhar" ? 0 : semTrabalhar + 1; maxSem = Math.max(maxSem, semTrabalhar);
      b = n;
    }
    for (const a of Object.keys(ATIVIDADES)) expect(vistas).toContain(a);
    expect(vistas.filter((a) => a === "trabalhar").length).toBeGreaterThan(80);
    expect(maxSem).toBeLessThan(8);
  });
  it("todo lugar fica em chão livre e tem rota a pé a partir de uma estação (ida e volta)", () => {
    for (let i = 0; i < LUGARES.length; i++) {
      for (const perfil of [SEMENTE, AURA]) expect(livre(posNoLugar(i, perfil)), `${perfil.id} ${LUGARES[i]!.id}`).toBe(true);
      if (i === 0) continue;
      const ida = rotaEntre(0, i, SEMENTE), volta = rotaEntre(i, 0, AURA);
      expect(ida.length, LUGARES[i]!.id).toBeGreaterThanOrEqual(2); expect(volta.length).toBeGreaterThanOrEqual(2);
      expect(comprimento(ida)).toBeLessThan(900);
    }
  });
  it("andando, ela vai do lugar de onde saiu até o novo; parada, faz a atividade do lugar", () => {
    let b = blocoEm(dia(5, 10), SEMENTE);
    for (let i = 0; i < 30; i++) {
      const meio = estadoEm(b.ini + b.viagem / 2, SEMENTE, b), la = estadoEm(b.ini + b.viagem + 1, SEMENTE, b);
      expect(meio.fase).toBe("andando"); expect(meio.andando).toBe(true);
      expect(la.fase).toBe("ficando");
      if (b.atividade === "trabalhar") expect(la.sentado).toBe(1);
      if (b.atividade === "dancar") { expect(la.danca).toBe(1); expect(la.y).toBeGreaterThan(80); }   // no lounge, lá em cima
      if (b.atividade === "moto") expect(la.moto).not.toBeNull();
      if (b.atividade !== "moto" && b.atividade !== "meditar") expect(la.pos).toEqual(posNoLugar(b.lugar, SEMENTE));
      b = proximoBloco(b, SEMENTE);
    }
  });
  it("meditando, ela está no alto da pirâmide do mirante", () => {
    let b = blocoEm(dia(2), SEMENTE); while (b.atividade !== "meditar") b = proximoBloco(b, SEMENTE);
    const fica = b.fim - b.ini - b.viagem, e = estadoEm(b.ini + b.viagem + fica / 2, SEMENTE, b);
    expect(e.meditando).toBe(1); expect(e.y).toBeGreaterThan(10);
  });
  it("a moto sobe, dá a volta por FORA da ilha bem acima das árvores e volta pra vaga", () => {
    const dur = 85, ini = motoEm(0, dur), fim = motoEm(dur, dur), meio = motoEm(dur / 2, dur);
    expect(ini.y).toBeCloseTo(0); expect(fim.y).toBeCloseTo(0); expect(fim.x).toBeCloseTo(ini.x); expect(fim.z).toBeCloseTo(ini.z);
    expect(Math.hypot(meio.x, meio.z)).toBeGreaterThan(CIDADE.bordaR);
    expect(meio.y).toBeGreaterThan(45); expect(meio.voando).toBe(true);
    expect(VOO_DA_MOTO.raio).toBeGreaterThan(CIDADE.bordaR);
  });
});

describe("dois personagens na mesma cidadela", () => {
  it("cada um tem as suas estações, os seus cantos da pista e a sua vaga — nunca o mesmo ponto", () => {
    const n = PERFIS_VIDA.nina!, a = PERFIS_VIDA.aura!;
    for (let i = 0; i < LUGARES.length; i++) {
      if (permitido(i, n) && permitido(i, a)) { const p = posNoLugar(i, n), q = posNoLugar(i, a); expect(Math.hypot(p.x - q.x, p.z - q.z), LUGARES[i]!.id).toBeGreaterThan(2); }
    }
    expect(n.estacoes.some((d) => a.estacoes.includes(d))).toBe(false);
    expect(Math.hypot(n.vaga.x - a.vaga.x, n.vaga.z - a.vaga.z)).toBeGreaterThan(5);
  });
  it("as agendas são diferentes (sementes diferentes) e nenhum dos dois para colado no outro", () => {
    let iguais = 0, colados = 0;
    for (let t = EPOCA + 86400 * 4; t < EPOCA + 86400 * 4 + 4 * 3600; t += 37) {
      const x = estadoEm(t, PERFIS_VIDA.nina!), y = estadoEm(t, PERFIS_VIDA.aura!);
      if (x.lugar === y.lugar) iguais++;
      if (x.fase === "ficando" && y.fase === "ficando" && Math.hypot(x.pos.x - y.pos.x, x.pos.z - y.pos.z) < 1.5 && Math.abs(x.y - y.y) < 1) colados++;
    }
    expect(iguais).toBeLessThan(120); expect(colados).toBe(0);
  });
});
