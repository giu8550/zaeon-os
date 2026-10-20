import { describe, expect, it } from "vitest";
import { AMBIENTES_COM_VAGA, ESTACIONAMENTOS, VAGAS_POR_ESTACIONAMENTO, vagaEstudo } from "./estacionamentosEstudo";
import { CIDADE, colisoresDaCidade, mundo } from "./ceu";
import { PLATAFORMAS } from "./plataformas";
import { gerarFrota } from "./frota/frota";
import { FLAGS_PADRAO } from "./frota/agenda";
import { planejarDia } from "./frota/plano";
import { estadoDaIA } from "./frota/corpo";

const frota = gerarFrota(), plano = planejarDia(frota, 20734, FLAGS_PADRAO);

describe("os estacionamentos das plataformas de estudo", () => {
  it("um por lugar de estudo, 33 vagas cada, todas em lugares diferentes (sem universidades no mapa: só os da Zaeon)", () => {
    expect(AMBIENTES_COM_VAGA).toEqual(["biblioteca", "jardim"]);   // (o lounge perdeu a garagem: o Templo Cósmico)
    const todas = (["biblioteca", "jardim", "univ", "ufc", "unifor", "uece"] as const).flatMap((a) => Array.from({ length: VAGAS_POR_ESTACIONAMENTO }, (_, i) => vagaEstudo(a, i)));
    expect(todas).toHaveLength(6 * 33);
    for (let i = 0; i < todas.length; i++) for (let j = i + 1; j < todas.length; j++) expect(Math.hypot(todas[i]!.x - todas[j]!.x, todas[i]!.z - todas[j]!.z)).toBeGreaterThan(3);
  });
  it("ficam FORA do lugar (colados nele, sem invadir o disco da sala/do campus nem a ilha central) — o do lounge na garagem, 25 m abaixo", () => {
    for (const a of ["biblioteca", "jardim"] as const) {
      const s = CIDADE.salas[a], c = mundo(s);
      for (let i = 0; i < 33; i++) { const v = vagaEstudo(a, i), d = Math.hypot(v.x - c.x, v.z - c.z); expect(d).toBeGreaterThan(s.r + 4); expect(d).toBeLessThan(s.r + 70); expect(Math.hypot(v.x - CIDADE.centro.x, v.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR); }
      expect(ESTACIONAMENTOS[a].zaeon).toBe(true);
    }
    for (const a of ["univ", "ufc", "unifor", "uece"] as const) {
      const P = PLATAFORMAS[a];
      for (let i = 0; i < 33; i++) { const v = vagaEstudo(a, i), d = Math.hypot(v.x - P.centro.x, v.z - P.centro.z); expect(d).toBeGreaterThan(P.r + 4); expect(d).toBeLessThan(P.r + 45); }
      expect(ESTACIONAMENTOS[a].zaeon).toBe(false);
    }
    // e longe de tudo que é sólido na Zaeon
    for (const c of colisoresDaCidade()) for (const a of ["biblioteca", "jardim"] as const) for (let i = 0; i < 33; i++) { const v = vagaEstudo(a, i); expect(Math.hypot(v.x - c.x, v.z - c.z)).toBeGreaterThan(c.r + 1); }
  });
  it("o plano nunca põe duas motos na mesma vaga ao mesmo tempo (no máximo 33 por lugar)", () => {
    const usos = new Map<string, [number, number][]>();
    for (const { blocos } of plano.agentes.values()) for (const b of blocos) if (b.vaga) { const k = `${b.vaga.ambiente}|${b.vaga.i}`; usos.set(k, [...(usos.get(k) ?? []), [b.ini, b.fim]]); }
    expect(usos.size).toBeGreaterThan(60);
    for (const k of usos.keys()) expect(AMBIENTES_COM_VAGA).toContain(k.split("|")[0]);   // só estacionamentos que existem no mapa
    for (const l of usos.values()) { l.sort((a, b) => a[0] - b[0]); for (let i = 1; i < l.length; i++) expect(l[i]![0]).toBeGreaterThanOrEqual(l[i - 1]![1]); }
  });
  it("chega de MOTO na vaga, a moto FICA parada lá enquanto estuda e sai com ela depois", () => {
    let vistos = 0;
    for (const { agente, blocos } of [...plano.agentes.values()].slice(0, 300)) blocos.forEach((b, i) => {
      if (!b.vaga || !b.atividade.startsWith("estudo") || i === 0 || blocos[i - 1]!.fim < b.ini - 1) return;
      const poses: string[] = [];
      for (let m = b.ini + 0.005; m < b.ini + 5; m += 1 / 30) poses.push(estadoDaIA(agente.id, blocos, m, FLAGS_PADRAO, true, false).pose);
      expect(poses).toContain("moto");
      // estudando: a moto dela está na vaga
      const meio = estadoDaIA(agente.id, blocos, (b.ini + b.fim) / 2, FLAGS_PADRAO, true, false);
      expect(meio.vagaMoto).toEqual(b.vaga);
      // no começo do bloco SEGUINTE, enquanto volta pra vaga, a moto ainda está lá; depois, não
      const prox = blocos[i + 1];
      if (prox && prox.ini <= b.fim + 1 && !(prox.vaga && prox.vaga.ambiente === b.vaga.ambiente)) {
        expect(estadoDaIA(agente.id, blocos, prox.ini + 0.001, FLAGS_PADRAO, true, false).vagaMoto).toEqual(b.vaga);
        expect(estadoDaIA(agente.id, blocos, prox.fim - 0.01, FLAGS_PADRAO, true, false).vagaMoto?.ambiente === b.vaga.ambiente && estadoDaIA(agente.id, blocos, prox.fim - 0.01, FLAGS_PADRAO, true, false).vagaMoto?.i === b.vaga.i && prox.vaga !== undefined).toBe(false);
      }
      vistos++;
    });
    expect(vistos).toBeGreaterThan(30);
  });
  it("num horário cheio, os estacionamentos têm motos paradas (e nunca mais de 33 por lugar)", () => {
    const porLugar = new Map<string, number>();
    for (const { agente, blocos } of plano.agentes.values()) { const e = estadoDaIA(agente.id, blocos, 15 * 60, FLAGS_PADRAO, true, false); if (e.vagaMoto) porLugar.set(e.vagaMoto.ambiente, (porLugar.get(e.vagaMoto.ambiente) ?? 0) + 1); }
    expect([...porLugar.values()].reduce((s, n) => s + n, 0)).toBeGreaterThan(40);   // (2 lugares agora: o lounge perdeu a garagem)
    for (const n of porLugar.values()) expect(n).toBeLessThanOrEqual(33);
  });
});
