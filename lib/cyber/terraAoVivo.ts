/**
 * Cyberespaço — a Terra AO VIVO nos telões dos Mirantes (PURO): normaliza os eventos REAIS de duas fontes públicas
 * (sem chave):
 *  - USGS (Serviço Geológico dos EUA): TERREMOTOS de magnitude ≥ 4,5 das últimas 24 h — o feed GeoJSON;
 *  - NASA EONET (Earth Observatory Natural Event Tracker): eventos naturais ABERTOS — INCÊNDIOS florestais,
 *    TEMPESTADES severas, VULCÕES e GELO marinho/de lagos.
 * O servidor busca, junta e guarda por alguns minutos (app/api/terra/eventos); os telões pintam os pontos no mapa e
 * listam os mais recentes no painel "AO VIVO".
 */
export type TipoEvento = "terremoto" | "incendio" | "tempestade" | "vulcao" | "gelo";
export type EventoTerra = { id: string; tipo: TipoEvento; titulo: string; lat: number; lon: number; quando: number; mag?: number; fonte: "USGS" | "NASA EONET" };

export const FONTES = {
  usgs: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
  eonet: "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=120",
} as const;
/** por quanto tempo o servidor reaproveita a última busca (ms) */
export const CACHE_MS = 10 * 60 * 1000;
/** quantos de cada tipo vão pro telão (pra o painel ter variedade) */
export const COTA: Record<TipoEvento, number> = { terremoto: 8, incendio: 6, tempestade: 6, vulcao: 4, gelo: 2 };
export const ROTULO: Record<TipoEvento, string> = { terremoto: "Terremoto", incendio: "Incêndio", tempestade: "Tempestade", vulcao: "Vulcão", gelo: "Gelo" };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const coordOk = (lat: number | null, lon: number | null): lat is number => lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
const limpa = (s: unknown, max = 70) => (typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "");

/** USGS GeoJSON → terremotos ("Terremoto M6,3 · Vanuatu") */
export function deUSGS(json: unknown): EventoTerra[] {
  const fs = (json as { features?: unknown[] })?.features; if (!Array.isArray(fs)) return [];
  const out: EventoTerra[] = [];
  for (const f of fs) {
    const p = (f as { properties?: Record<string, unknown> })?.properties, c = (f as { geometry?: { coordinates?: unknown[] } })?.geometry?.coordinates;
    if (!p || !Array.isArray(c)) continue;
    const lon = num(c[0]), lat = num(c[1]), mag = num(p.mag), quando = num(p.time), id = limpa((f as { id?: unknown }).id, 40);
    if (!coordOk(lat, lon) || mag === null || quando === null || !id) continue;
    const lugar = limpa(p.place).split(",").pop()!.trim() || "oceano";
    out.push({ id: `usgs:${id}`, tipo: "terremoto", titulo: `${ROTULO.terremoto} M${mag.toFixed(1).replace(".", ",")} · ${lugar}`, lat, lon: lon!, quando, mag, fonte: "USGS" });
  }
  return out;
}

const CATEGORIA: Record<string, TipoEvento> = { wildfires: "incendio", severeStorms: "tempestade", volcanoes: "vulcao", seaLakeIce: "gelo" };
/** NASA EONET v3 → incêndios, tempestades, vulcões, gelo (a ÚLTIMA posição de cada evento) */
export function deEONET(json: unknown): EventoTerra[] {
  const evs = (json as { events?: unknown[] })?.events; if (!Array.isArray(evs)) return [];
  const out: EventoTerra[] = [];
  for (const e of evs) {
    const ev = e as { id?: unknown; title?: unknown; categories?: { id?: unknown }[]; geometry?: { date?: unknown; type?: unknown; coordinates?: unknown }[] };
    const tipo = CATEGORIA[String(ev.categories?.[0]?.id ?? "")]; if (!tipo || !Array.isArray(ev.geometry) || !ev.geometry.length) continue;
    const g = ev.geometry[ev.geometry.length - 1]!;
    let lon: number | null = null, lat: number | null = null;
    if (g.type === "Point" && Array.isArray(g.coordinates)) { lon = num(g.coordinates[0]); lat = num(g.coordinates[1]); }
    else if (g.type === "Polygon" && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {   // o centro do polígono
      const anel = (g.coordinates[0] as unknown[]).filter((q): q is number[] => Array.isArray(q) && num(q[0]) !== null && num(q[1]) !== null);
      if (anel.length) { lon = anel.reduce((s, q) => s + q[0]!, 0) / anel.length; lat = anel.reduce((s, q) => s + q[1]!, 0) / anel.length; }
    }
    const quando = Date.parse(String(g.date ?? "")), id = limpa(ev.id, 40), titulo = limpa(ev.title, 60);
    if (!coordOk(lat, lon) || !Number.isFinite(quando) || !id || !titulo) continue;
    out.push({ id: `eonet:${id}`, tipo, titulo: `${ROTULO[tipo]} · ${titulo}`, lat, lon: lon!, quando, fonte: "NASA EONET" });
  }
  return out;
}

/** junta: os mais recentes de cada tipo (até a COTA), tudo do mais novo pro mais velho */
export function juntarEventos(...listas: EventoTerra[][]): EventoTerra[] {
  const todos = listas.flat().sort((a, b) => b.quando - a.quando), vistos = new Set<string>(), conta: Partial<Record<TipoEvento, number>> = {}, out: EventoTerra[] = [];
  for (const e of todos) {
    if (vistos.has(e.id) || (conta[e.tipo] ?? 0) >= COTA[e.tipo]) continue;
    vistos.add(e.id); conta[e.tipo] = (conta[e.tipo] ?? 0) + 1; out.push(e);
  }
  return out;
}

/** pro painel: alterna os tipos (o mais novo de cada um, depois o 2º de cada…) — variedade, não só terremotos */
export function intercalarTipos(evs: EventoTerra[], n: number): EventoTerra[] {
  const porTipo = new Map<TipoEvento, EventoTerra[]>();
  for (const e of evs) (porTipo.get(e.tipo) ?? porTipo.set(e.tipo, []).get(e.tipo)!).push(e);
  const filas = [...porTipo.values()], out: EventoTerra[] = [];
  for (let k = 0; out.length < n && filas.some((f) => f.length > k); k++) for (const f of filas) if (f[k] && out.length < n) out.push(f[k]!);
  return out;
}

/** "há 3 h", "há 2 dias" */
export function haQuanto(quando: number, agora: number): string {
  const min = Math.max(0, Math.round((agora - quando) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60); if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}
