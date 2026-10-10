import { describe, expect, it } from "vitest";
import { ATIVIDADES, EPOCA, LUGARES, PERFIS_VIDA, VIRADA, blocoEm, casaDe, diaDe, disputado, estadoEm, lugarDaCasa, motoEm, posNoLugar, proximoBloco, rotaEntre, VOO_DA_MOTO, type Bloco } from "./vidaPersonagem";
import { salaEm } from "./ceu";
import { livre, comprimento } from "./caminhos";
import { CIDADE } from "./ceu";

const SEMENTE = PERFIS_VIDA.nina!, AURA = PERFIS_VIDA.aura!;
/** os lugares da central (a A* cobre: a ilha e o lounge) — os das salas de estudo têm teste próprio */
const NA_CENTRAL = LUGARES.map((l, i) => ({ l, i })).filter(({ l }) => !l.sala || l.sala === "lounge").map(({ i }) => i);
const DA_CIDADELA = Object.values(PERFIS_VIDA).filter((p) => casaDe(p) === "cidadela"), DAS_SALAS = Object.values(PERFIS_VIDA).filter((p) => casaDe(p) === "salas");
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
    for (const a of Object.keys(ATIVIDADES)) if (a !== "estudar") expect(vistas).toContain(a);   // (estudar é de quem mora nas salas)
    expect(vistas.filter((a) => a === "trabalhar").length).toBeGreaterThan(80);
    expect(maxSem).toBeLessThan(8);
  });
  it("todo lugar fica em chão livre e tem rota a pé a partir de uma estação (ida e volta)", () => {
    for (const i of NA_CENTRAL) {
      for (const perfil of Object.values(PERFIS_VIDA)) expect(livre(posNoLugar(i, perfil)), `${perfil.id} ${LUGARES[i]!.id}`).toBe(true);
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
  it("todos meditam no alto da pirâmide (cada um no seu lugar do salão, sem cair pela borda)", () => {
    for (const perfil of DA_CIDADELA) {
      let b = blocoEm(dia(2), perfil); while (b.atividade !== "meditar") b = proximoBloco(b, perfil);
      const fica = b.fim - b.ini - b.viagem, e = estadoEm(b.ini + b.viagem + fica / 2, perfil, b);
      expect(e.meditando, perfil.id).toBe(1); expect(e.y, perfil.id).toBeGreaterThan(10);
    }
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
  it("ninguém fica no mesmo lugar no mesmo horário (os lugares são de quem chega primeiro) e cada um tem a sua vaga", () => {
    const todos = Object.values(PERFIS_VIDA), t0 = EPOCA + 86400 * 6 + VIRADA, t1 = t0 + 86400;
    const ficando: { id: string; lugar: number; de: number; ate: number }[] = [];
    for (const p of todos) {
      let b = blocoEm(t0, p);
      while (b.ini < t1) { if (disputado(b.lugar)) ficando.push({ id: p.id, lugar: b.lugar, de: b.ini + b.viagem, ate: b.fim }); b = blocoEm(b.fim, p, b); }
    }
    for (const x of ficando) for (const y of ficando) {
      if (x.id >= y.id || x.lugar !== y.lugar || diaDe(x.de) !== diaDe(y.de)) continue;
      expect(x.de < y.ate && y.de < x.ate, `${x.id}×${y.id} ${LUGARES[x.lugar]!.id} ${x.de}`).toBe(false);
    }
    for (const n of todos) for (const a of todos) if (n !== a) expect(Math.hypot(n.vaga.x - a.vaga.x, n.vaga.z - a.vaga.z)).toBeGreaterThan(5);
    for (const p of todos) for (const i of NA_CENTRAL) expect(livre(posNoLugar(i, p)), `${p.id} ${LUGARES[i]!.id}`).toBe(true);
  });
  it("a agenda recomeça na virada do dia (04:00 de Brasília) e é a mesma calculada de qualquer ponto", () => {
    const p = PERFIS_VIDA.examiner!, t = EPOCA + 86400 * 9 + VIRADA + 5 * 3600;
    expect(blocoEm(t, p)).toEqual(blocoEm(t, p, blocoEm(t - 7200, p)));
    expect(blocoEm(EPOCA + 86400 * 9 + VIRADA + 1, p).n).toBe(1);
  });
  it("as agendas são diferentes (sementes diferentes) e ninguém para colado em ninguém (todos os pares)", () => {
    const todos = Object.values(PERFIS_VIDA);
    for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
      const P = todos[i]!, Q = todos[j]!; let iguais = 0, colados = 0;
      for (let t = EPOCA + 86400 * 4; t < EPOCA + 86400 * 4 + 4 * 3600; t += 37) {
        const x = estadoEm(t, P), y = estadoEm(t, Q);
        if (x.lugar === y.lugar) iguais++;
        if (x.fase === "ficando" && y.fase === "ficando" && Math.hypot(x.pos.x - y.pos.x, x.pos.z - y.pos.z) < 1.5 && Math.abs(x.y - y.y) < 1) colados++;
      }
      expect(iguais, `${P.id}×${Q.id}`).toBeLessThan(120); expect(colados, `${P.id}×${Q.id}`).toBe(0);
    }
  });
});

describe("quem mora na cidadela × quem mora nas salas de estudo (pedido do dono, out/2026)", () => {
  it("na cidadela: Nina, Aura, Zenita, Examiner, Osler, Nightingale e a Zaeon — o resto mora nas salas", () => {
    expect(DA_CIDADELA.map((p) => p.id).sort()).toEqual(["aura", "enfermagem", "examiner", "medicina", "nina", "scholar", "zaeon", "zenita"].sort());   // (o Scholar é o DJ fixo do lounge)
    expect(DAS_SALAS.map((p) => p.id).sort()).toEqual(["caio", "core_active", "eng-civil", "farmacia", "quimica", "teo"].sort());
  });
  it("cada um só vai aos lugares da sua casa (a pista do lounge é de todos); quem é das salas estuda, passeia e dança nelas", () => {
    const t0 = EPOCA + 86400 * 7 + VIRADA;
    for (const p of Object.values(PERFIS_VIDA)) {
      let b = blocoEm(t0, p); const salas = new Set<string>();
      for (let i = 0; i < 120; i++) {
        const l = LUGARES[b.lugar]!; expect(lugarDaCasa(l, casaDe(p)), `${p.id} em ${l.id}`).toBe(true);
        if (casaDe(p) === "salas") { expect(["estudar", "passear", "dancar"]).toContain(b.atividade); salas.add(l.sala!); }
        else expect(b.atividade).not.toBe("estudar");
        b = blocoEm(b.fim, p, b);
      }
      if (casaDe(p) === "salas") expect([...salas].sort(), p.id).toEqual(["biblioteca", "jardim", "lounge"]);   // TRANSITA entre as salas
    }
  });
  it("os lugares das salas ficam DENTRO da sala; estudando, sentado no pufe", () => {
    for (const l of LUGARES.filter((x) => x.sala && x.sala !== "lounge")) expect(salaEm(l.pos), l.id).toBe(l.sala);
    const p = PERFIS_VIDA.teo!; let b = blocoEm(EPOCA + 86400 * 3 + VIRADA, p); while (b.atividade !== "estudar") b = blocoEm(b.fim, p, b);
    expect(estadoEm(b.fim - 1, p, b).sentado).toBe(1);
  });
  it("de uma sala pra outra vai de MOTO, voando por fora da capela, e chega no lugar", () => {
    const p = PERFIS_VIDA.quimica!; let b = blocoEm(EPOCA + 86400 * 5 + VIRADA, p), vistos = 0;
    for (let i = 0; i < 200 && vistos < 6; i++) {
      const de = LUGARES[b.de]!.sala, para = LUGARES[b.lugar]!.sala;
      if (de && para && de !== para) {
        vistos++;
        for (let u = 0.05; u < 1; u += 0.05) {
          const e = estadoEm(b.ini + b.viagem * u, p, b);
          expect(e.moto, `${de}→${para}`).not.toBeNull(); expect(Math.hypot(e.pos.x, e.pos.z)).toBeGreaterThan(CIDADE.cidadela.r + 20);
          if (u > 0.2 && u < 0.8) expect(e.moto!.voando).toBe(true);
        }
        expect(estadoEm(b.ini + b.viagem + 1, p, b).pos).toEqual(posNoLugar(b.lugar, p));
      }
      b = blocoEm(b.fim, p, b);
    }
    expect(vistos).toBeGreaterThan(0);
  });
});
