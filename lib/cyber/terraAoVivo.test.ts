import { describe, expect, it } from "vitest";
import { COTA, deEONET, deUSGS, haQuanto, intercalarTipos, juntarEventos } from "./terraAoVivo";

const usgs = { features: [
  { id: "us6000u0xi", properties: { mag: 6.3, place: "102 km NE of Norsup, Vanuatu", time: 1791450007768 }, geometry: { coordinates: [168.1889, -15.5411, 10] } },
  { id: "lixo", properties: { mag: "x", place: "", time: 1 }, geometry: { coordinates: [0, 0] } },
  { id: "fora", properties: { mag: 5, place: "Lugar", time: 1 }, geometry: { coordinates: [999, 0] } },
] };
const eonet = { events: [
  { id: "EONET_1", title: "Tropical Storm Isaias", categories: [{ id: "severeStorms" }], geometry: [{ date: "2026-10-06T09:00:00Z", type: "Point", coordinates: [-90, 20] }, { date: "2026-10-07T09:00:00Z", type: "Point", coordinates: [-94.1, 22] }] },
  { id: "EONET_2", title: "Wildfire <b>X</b>", categories: [{ id: "wildfires" }], geometry: [{ date: "2026-10-05T00:00:00Z", type: "Polygon", coordinates: [[[10, 10], [12, 10], [12, 12], [10, 12]]] }] },
  { id: "EONET_3", title: "Dust", categories: [{ id: "dustHaze" }], geometry: [{ date: "2026-10-05T00:00:00Z", type: "Point", coordinates: [0, 0] }] },
] };

describe("a Terra AO VIVO (USGS + NASA EONET)", () => {
  it("USGS: terremotos em português com magnitude e o país; lixo e coordenada inválida ficam de fora", () => {
    const t = deUSGS(usgs); expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ tipo: "terremoto", titulo: "Terremoto M6,3 · Vanuatu", lat: -15.5411, lon: 168.1889, mag: 6.3, fonte: "USGS" });
    expect(deUSGS(null)).toEqual([]); expect(deUSGS({ features: "x" })).toEqual([]);
  });
  it("EONET: a ÚLTIMA posição de cada evento; polígono vira o centro; categorias fora do escopo e HTML saem", () => {
    const e = deEONET(eonet); expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ tipo: "tempestade", titulo: "Tempestade · Tropical Storm Isaias", lat: 22, lon: -94.1 });
    expect(e[1]).toMatchObject({ tipo: "incendio", lat: 11, lon: 11 }); expect(e[1]!.titulo).not.toMatch(/[<>]/);
    expect(deEONET({})).toEqual([]);
  });
  it("junta do mais novo pro mais velho, sem repetir, respeitando a cota de cada tipo", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, tipo: "terremoto" as const, titulo: "x", lat: 0, lon: 0, quando: i, fonte: "USGS" as const }));
    const j = juntarEventos(muitos, muitos, deEONET(eonet));
    expect(j.filter((e) => e.tipo === "terremoto")).toHaveLength(COTA.terremoto);
    expect(new Set(j.map((e) => e.id)).size).toBe(j.length);
    for (let i = 1; i < j.length; i++) expect(j[i - 1]!.quando).toBeGreaterThanOrEqual(j[i]!.quando);
  });
  it("o painel alterna os tipos (variedade, não só terremotos)", () => {
    const ev = (id: string, tipo: "terremoto" | "incendio" | "tempestade") => ({ id, tipo, titulo: id, lat: 0, lon: 0, quando: 0, fonte: "USGS" as const });
    const l = intercalarTipos([ev("t1", "terremoto"), ev("t2", "terremoto"), ev("t3", "terremoto"), ev("i1", "incendio"), ev("s1", "tempestade")], 4);
    expect(l.map((e) => e.id)).toEqual(["t1", "i1", "s1", "t2"]);
  });
  it("'há quanto tempo' em português", () => {
    expect(haQuanto(0, 5 * 60000)).toBe("há 5 min"); expect(haQuanto(0, 3 * 3600000)).toBe("há 3 h"); expect(haQuanto(0, 72 * 3600000)).toBe("há 3 dias");
  });
});
