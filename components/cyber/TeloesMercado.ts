/**
 * TeloesMercado — os TELÕES DO MERCADO na ponte inicial do campus de TI (layout em lib/cyber/temploCosmico
 * `TELOES_MERCADO`; dados em lib/cyber/mercado, servidos por app/api/cyber/mercado): telas de cinema em pé sobre dois
 * pilares, a moldura na cor da sala (o fluxo da Cyber Room), e o conteúdo num TERMINAL estilo Bloomberg desenhado em
 * canvas — a Solana (preço, gráfico de 7 dias, a rede, o ecossistema), as outras moedas (a tabela com os gráficos) e
 * as métricas da blockchain (capitalização, dominância, medo e ganância, Bitcoin, Solana, quem subiu e quem caiu).
 * Embaixo de cada tela, a FAIXA com as cotações correndo. Busca a cada minuto só enquanto o Templo está sendo
 * desenhado. Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do caminho do meio).
 */
import * as THREE from "three";
import { SALAO, TELOES_MERCADO, pilaresDoTelao, type TelaoMercado } from "@/lib/cyber/temploCosmico";
import { fmtGrande, fmtPreco, fmtVar, type Moeda, type PainelMercado } from "@/lib/cyber/mercado";

export type TeloesHandle = { group: THREE.Group; alvos: THREE.Object3D[]; atualizar(dt: number, t: number, cor: THREE.Color): void; dispose(): void };

const URL_MERCADO = "/api/cyber/mercado", A_CADA_MS = 60_000, RELOGIO_MS = 5_000;
// a paleta do terminal
const C = { fundo: "#04050a", painel: "#0a0d16", linha: "#1b2236", ambar: "#ffb000", texto: "#e8ecf7", fraco: "#7d869c", sobe: "#19e38b", cai: "#ff3b55", sol1: "#9945ff", sol2: "#14f195", azul: "#3aa0ff" } as const;
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const corVar = (v: number | null) => (v === null ? C.fraco : v >= 0 ? C.sobe : C.cai);

/** a linha do gráfico (e o preenchimento em degradê embaixo) num retângulo */
function grafico(g: CanvasRenderingContext2D, serie: readonly number[], x: number, y: number, w: number, h: number, cor: string, cor2?: string, grossura = 3) {
  if (serie.length < 2) return;
  let mn = Infinity, mx = -Infinity; for (const v of serie) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const amp = mx - mn || 1, px = (i: number) => x + (i / (serie.length - 1)) * w, py = (v: number) => y + h - ((v - mn) / amp) * h;
  if (cor2) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, cor2 + "66"); gr.addColorStop(1, cor2 + "00");
    g.beginPath(); g.moveTo(px(0), y + h); serie.forEach((v, i) => g.lineTo(px(i), py(v))); g.lineTo(px(serie.length - 1), y + h); g.closePath(); g.fillStyle = gr; g.fill();
  }
  g.beginPath(); serie.forEach((v, i) => (i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v)))); g.strokeStyle = cor; g.lineWidth = grossura; g.lineJoin = "round"; g.stroke();
}
function texto(g: CanvasRenderingContext2D, s: string, x: number, y: number, tam: number, cor: string, o: { peso?: number; fonte?: string; alinha?: CanvasTextAlign } = {}) {
  g.font = `${o.peso ?? 600} ${tam}px ${o.fonte ?? MONO}`; g.fillStyle = cor; g.textAlign = o.alinha ?? "left"; g.textBaseline = "alphabetic"; g.fillText(s, x, y);
}
function caixa(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, titulo?: string) {
  g.fillStyle = C.painel; g.fillRect(x, y, w, h); g.strokeStyle = C.linha; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (titulo) { g.fillStyle = C.ambar; g.fillRect(x, y, 6, 34); texto(g, titulo, x + 18, y + 27, 22, C.ambar, { peso: 700 }); }
}
/** o cabeçalho: o nome do terminal, o título, "AO VIVO" e a hora */
function cabecalho(g: CanvasRenderingContext2D, W: number, titulo: string, p: PainelMercado | null) {
  g.fillStyle = "#0e1220"; g.fillRect(0, 0, W, 92); g.fillStyle = C.ambar; g.fillRect(0, 88, W, 4);
  texto(g, "ZAEON", 36, 62, 44, C.ambar, { peso: 900, fonte: SANS }); texto(g, "TERMINAL", 210, 62, 44, C.texto, { peso: 300, fonte: SANS });
  texto(g, titulo, W / 2, 62, 40, C.texto, { peso: 800, fonte: SANS, alinha: "center" });
  const ok = !!p && Date.now() - p.atualizadoEm < 5 * 60_000;
  g.fillStyle = ok ? C.cai : C.fraco; g.beginPath(); g.arc(W - 330, 50, 11, 0, Math.PI * 2); g.fill();
  texto(g, ok ? "AO VIVO" : "SEM SINAL", W - 310, 60, 28, ok ? C.texto : C.fraco, { peso: 800 });
  texto(g, new Date().toLocaleTimeString("pt-BR", { hour12: false }), W - 36, 60, 30, C.ambar, { alinha: "right" });
}
function rodape(g: CanvasRenderingContext2D, W: number, H: number, p: PainelMercado | null) {
  g.fillStyle = "#0e1220"; g.fillRect(0, H - 48, W, 48);
  texto(g, p ? `Fontes: ${p.fontes.join(" · ")}  —  atualizado ${new Date(p.atualizadoEm).toLocaleTimeString("pt-BR", { hour12: false })}` : "conectando ao mercado…", 36, H - 16, 22, C.fraco);
  texto(g, "dados reais · não é recomendação de investimento", W - 36, H - 16, 22, C.fraco, { alinha: "right" });
}
const semSinal = (g: CanvasRenderingContext2D, x: number, y: number) => texto(g, "— sem sinal —", x, y, 30, C.fraco);

// ── as TRÊS TELAS ──
function telaSolana(g: CanvasRenderingContext2D, W: number, H: number, p: PainelMercado | null) {
  cabecalho(g, W, "SOLANA · SOL/USD", p);
  const s = p?.solana, r = p?.redeSolana;
  // o PREÇO e o GRÁFICO de 7 dias (as cores da Solana)
  caixa(g, 30, 116, 1300, 640);
  if (s) {
    const gr = g.createLinearGradient(60, 0, 700, 0); gr.addColorStop(0, C.sol1); gr.addColorStop(1, C.sol2);
    texto(g, "SOL", 60, 200, 54, C.fraco, { peso: 800, fonte: SANS });
    g.font = `900 132px ${SANS}`; g.fillStyle = gr; g.textAlign = "left"; g.fillText(fmtPreco(s.preco), 60, 330);
    texto(g, `24h ${fmtVar(s.var24h)}`, 760, 230, 40, corVar(s.var24h), { peso: 800 }); texto(g, `7d  ${fmtVar(s.var7d)}`, 760, 290, 40, corVar(s.var7d), { peso: 800 });
    grafico(g, s.serie, 60, 380, 1240, 340, C.sol2, C.sol1, 5);
    texto(g, "7 DIAS", 1290, 740, 22, C.fraco, { alinha: "right" });
  } else semSinal(g, 60, 300);
  // os NÚMEROS da rede
  const st: [string, string][] = [
    ["CAPITALIZAÇÃO", s ? fmtGrande(s.capitalizacao) : "—"], ["VOLUME 24H", s ? fmtGrande(s.volume) : "—"],
    ["TPS (USUÁRIOS)", r ? Math.round(r.tps).toLocaleString("pt-BR") : "—"], ["ÉPOCA", r ? `${r.epoca} · ${(r.progressoEpoca * 100).toFixed(0)}%` : "—"],
    ["SLOT", r ? r.slot.toLocaleString("pt-BR") : "—"], ["TRANSAÇÕES (TOTAL)", r ? (r.transacoes / 1e9).toFixed(1) + " bi" : "—"],
  ];
  st.forEach(([k, v], i) => { const x = 30 + (i % 3) * 437, y = 780 + Math.floor(i / 3) * 150; caixa(g, x, y, 425, 138); texto(g, k, x + 22, y + 46, 24, C.fraco, { peso: 700 }); texto(g, v, x + 22, y + 112, 52, C.texto, { peso: 800 });
    if (k === "ÉPOCA" && r) { g.fillStyle = C.linha; g.fillRect(x + 22, y + 122, 380, 8); g.fillStyle = C.sol2; g.fillRect(x + 22, y + 122, 380 * r.progressoEpoca, 8); } });
  // o ECOSSISTEMA (os tokens nativos)
  caixa(g, 1360, 116, W - 1390, H - 116 - 66, "ECOSSISTEMA SOLANA");
  (p?.tokensSolana ?? []).slice(0, 10).forEach((m, i) => {
    const y = 210 + i * 86, x = 1386;
    texto(g, m.simbolo, x, y, 34, C.texto, { peso: 800 }); texto(g, fmtPreco(m.preco), x + 200, y, 30, C.texto);
    texto(g, fmtVar(m.var24h), W - 56, y, 28, corVar(m.var24h), { peso: 700, alinha: "right" });
    grafico(g, m.serie, x, y + 14, W - 1390 - 60, 34, corVar(m.var7d), undefined, 2);
  });
  rodape(g, W, H, p);
}
function telaMoedas(g: CanvasRenderingContext2D, W: number, H: number, p: PainelMercado | null) {
  cabecalho(g, W, "MERCADO CRIPTO · TOP", p);
  const cols = [["#", 50], ["ATIVO", 130], ["PREÇO", 560], ["24H", 860], ["7D", 1100], ["CAP. DE MERCADO", 1340], ["7 DIAS", 1640]] as const;
  for (const [n, x] of cols) texto(g, n, x, 140, 24, C.ambar, { peso: 800 });
  g.fillStyle = C.ambar; g.fillRect(36, 152, W - 72, 2);
  const ms = p?.moedas ?? []; if (!ms.length) semSinal(g, 130, 260);
  ms.slice(0, 13).forEach((m: Moeda, i) => {
    const y = 214 + i * 66;
    if (i % 2 === 0) { g.fillStyle = "#0b0f1a"; g.fillRect(36, y - 46, W - 72, 66); }
    texto(g, String(m.rank ?? "—"), 50, y, 28, C.fraco); texto(g, m.simbolo, 130, y, 34, C.texto, { peso: 800 }); texto(g, m.nome.slice(0, 14), 290, y, 24, C.fraco, { fonte: SANS });
    texto(g, fmtPreco(m.preco), 560, y, 32, C.texto); texto(g, fmtVar(m.var24h), 860, y, 28, corVar(m.var24h), { peso: 700 }); texto(g, fmtVar(m.var7d), 1100, y, 28, corVar(m.var7d), { peso: 700 });
    texto(g, fmtGrande(m.capitalizacao), 1340, y, 30, C.texto);
    grafico(g, m.serie, 1640, y - 40, W - 1640 - 50, 40, corVar(m.var7d), undefined, 2.5);
  });
  rodape(g, W, H, p);
}
function telaBlockchain(g: CanvasRenderingContext2D, W: number, H: number, p: PainelMercado | null) {
  cabecalho(g, W, "MÉTRICAS DA BLOCKCHAIN", p);
  const gl = p?.global, md = p?.medo, b = p?.redeBitcoin, r = p?.redeSolana;
  const w3 = (W - 60 - 40) / 3;
  // o MERCADO GLOBAL
  caixa(g, 30, 116, w3, 300, "CAPITALIZAÇÃO TOTAL");
  if (gl) { texto(g, fmtGrande(gl.capitalizacao), 56, 260, 92, C.texto, { peso: 900, fonte: SANS }); texto(g, `24h ${fmtVar(gl.var24h)}`, 56, 330, 38, corVar(gl.var24h), { peso: 800 }); texto(g, `${gl.moedasAtivas.toLocaleString("pt-BR")} moedas ativas`, 56, 386, 26, C.fraco); } else semSinal(g, 56, 260);
  caixa(g, 50 + w3, 116, w3, 300, "VOLUME 24H");
  if (gl) { texto(g, fmtGrande(gl.volume), 76 + w3, 260, 92, C.texto, { peso: 900, fonte: SANS }); texto(g, `${((gl.volume / gl.capitalizacao) * 100).toFixed(1)}% da capitalização girou hoje`, 76 + w3, 330, 26, C.fraco); }
  // o MEDO E GANÂNCIA (o mostrador)
  caixa(g, 70 + 2 * w3, 116, w3, 300, "MEDO & GANÂNCIA");
  { const cx = 70 + 2.5 * w3, cy = 370, R = 190;
    for (let k = 0; k < 50; k++) { const a0 = Math.PI + (k / 50) * Math.PI, a1 = Math.PI + ((k + 0.85) / 50) * Math.PI; g.strokeStyle = `hsl(${(k / 50) * 130}, 85%, 52%)`; g.lineWidth = 34; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke(); }
    if (md) { const a = Math.PI + (md.valor / 100) * Math.PI; g.strokeStyle = C.texto; g.lineWidth = 7; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30)); g.stroke();
      texto(g, String(md.valor), cx, cy - 40, 74, C.texto, { peso: 900, fonte: SANS, alinha: "center" }); texto(g, md.rotulo, cx, cy + 4, 28, C.ambar, { peso: 800, alinha: "center" }); } }
  // a DOMINÂNCIA
  caixa(g, 30, 436, W - 60, 150, "DOMINÂNCIA");
  if (gl) { const x0 = 56, wt = W - 112, y = 500, bw = (wt * gl.domBtc) / 100, ew = (wt * gl.domEth) / 100;
    g.fillStyle = "#f7931a"; g.fillRect(x0, y, bw, 52); g.fillStyle = "#627eea"; g.fillRect(x0 + bw, y, ew, 52); g.fillStyle = "#3a4258"; g.fillRect(x0 + bw + ew, y, wt - bw - ew, 52);
    texto(g, `BTC ${gl.domBtc.toFixed(1)}%`, x0 + 18, y + 38, 30, "#140b00", { peso: 900 }); texto(g, `ETH ${gl.domEth.toFixed(1)}%`, x0 + bw + 18, y + 38, 30, "#fff", { peso: 900 }); texto(g, `OUTRAS ${(100 - gl.domBtc - gl.domEth).toFixed(1)}%`, x0 + wt - 18, y + 38, 30, C.texto, { peso: 800, alinha: "right" }); }
  // as REDES
  caixa(g, 30, 606, w3, 360, "BITCOIN");
  if (b) { texto(g, "BLOCO", 56, 690, 24, C.fraco, { peso: 700 }); texto(g, b.altura.toLocaleString("pt-BR"), 56, 760, 64, C.texto, { peso: 900, fonte: SANS });
    texto(g, "TAXAS (sat/vB)", 56, 830, 24, C.fraco, { peso: 700 }); texto(g, `rápida ${b.taxaRapida} · 30min ${b.taxaMeiaHora} · 1h ${b.taxaHora}`, 56, 880, 30, C.ambar, { peso: 700 }); } else semSinal(g, 56, 760);
  caixa(g, 50 + w3, 606, w3, 360, "SOLANA");
  if (r) { const x = 76 + w3; texto(g, "TPS AGORA", x, 690, 24, C.fraco, { peso: 700 }); texto(g, Math.round(r.tps).toLocaleString("pt-BR"), x, 760, 64, C.sol2, { peso: 900, fonte: SANS });
    texto(g, "ÉPOCA", x, 830, 24, C.fraco, { peso: 700 }); texto(g, `${r.epoca}  ·  ${(r.progressoEpoca * 100).toFixed(1)}%`, x, 880, 30, C.texto, { peso: 700 });
    g.fillStyle = C.linha; g.fillRect(x, 905, w3 - 52, 10); g.fillStyle = C.sol1; g.fillRect(x, 905, (w3 - 52) * r.progressoEpoca, 10); } else semSinal(g, 76 + w3, 760);
  // quem SUBIU e quem CAIU (entre as maiores)
  caixa(g, 70 + 2 * w3, 606, w3, 360, "MAIORES ALTAS / BAIXAS 24H");
  { const ms = [...(p?.moedas ?? [])].filter((m) => m.var24h !== null).sort((a, c) => c.var24h! - a.var24h!), x = 96 + 2 * w3;
    [...ms.slice(0, 3), ...ms.slice(-3)].forEach((m, i) => { const y = 690 + i * 46 + (i >= 3 ? 20 : 0); texto(g, m.simbolo, x, y, 30, C.texto, { peso: 800 }); texto(g, fmtPreco(m.preco), x + 170, y, 26, C.fraco); texto(g, fmtVar(m.var24h), 70 + 3 * w3 - 26, y, 28, corVar(m.var24h), { peso: 800, alinha: "right" }); }); }
  rodape(g, W, H, p);
}
const DESENHA: Record<TelaoMercado["id"], typeof telaSolana> = { solana: telaSolana, moedas: telaMoedas, blockchain: telaBlockchain };

/** a FAIXA de cotações (uma textura que repete — o deslocamento faz correr) */
function desenharFaixa(g: CanvasRenderingContext2D, W: number, H: number, p: PainelMercado | null) {
  g.fillStyle = "#06070c"; g.fillRect(0, 0, W, H);
  const itens = p ? [...(p.solana ? [p.solana] : []), ...p.moedas.filter((m) => m.id !== "solana"), ...p.tokensSolana] : [];
  if (!itens.length) { texto(g, "ZAEON TERMINAL · conectando ao mercado…", 20, H * 0.7, H * 0.55, C.fraco); return; }
  let x = 20;
  for (const m of itens) { if (x > W - 40) break;
    texto(g, m.simbolo, x, H * 0.7, H * 0.55, C.ambar, { peso: 800 }); x += g.measureText(m.simbolo).width + 14;
    const s = `${fmtPreco(m.preco)} ${fmtVar(m.var24h)}`; texto(g, s, x, H * 0.7, H * 0.5, corVar(m.var24h), { peso: 600 }); x += g.measureText(s).width + 50; }
}

export function criarTeloesMercado(o: { low: boolean }): TeloesHandle {
  const group = new THREE.Group(); group.name = "teloes-mercado";
  const alvos: THREE.Object3D[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [];
  const malha = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const y0 = -SALAO.desce, W = o.low ? 1024 : 2048;
  const moldura = new THREE.MeshStandardMaterial({ color: 0x07080d, emissive: 0x0a0306, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.85 });
  const aceso = new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false });
  type Tela = { t: TelaoMercado; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; faixa: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } };
  const telas: Tela[] = [];
  for (const t of TELOES_MERCADO) {
    const H = Math.round((W * t.a) / t.l), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d")!, tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; texs.push(tex);
    // a TELA (um tiquinho curva, de cinema) dentro da moldura
    const tela = new THREE.Group(); tela.position.set(t.x, y0 + t.base, t.z); tela.rotation.y = Math.PI / 2 - t.rot; group.add(tela);
    const curva = 0.12, R = t.l / curva, gTela = new THREE.CylinderGeometry(R, R, t.a, 48, 1, true, Math.PI - curva / 2, curva);
    const mTela = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
    const sup = malha(gTela, mTela, tela); sup.position.set(0, t.a / 2, R - 0.25);   // (a face côncava pra quem olha; a sala do lounge é espelhada — o texto já sai certo)
    const caixaM = malha(new THREE.BoxGeometry(t.l + 1.2, t.a + 1.2, 0.6), moldura, tela); caixaM.position.set(0, t.a / 2, -0.65); alvos.push(caixaM);
    for (const [w, h, x, y] of [[t.l + 1.3, 0.22, 0, t.a + 0.55], [t.l + 1.3, 0.22, 0, -0.55], [0.22, t.a + 1.3, -(t.l / 2 + 0.55), t.a / 2], [0.22, t.a + 1.3, t.l / 2 + 0.55, t.a / 2]] as const) {
      const b = malha(new THREE.BoxGeometry(w, h, 0.3), aceso, tela); b.position.set(x, y, -0.2);
    }
    // a FAIXA de cotações embaixo da tela
    const fcv = document.createElement("canvas"); fcv.width = o.low ? 1024 : 2048; fcv.height = 96;
    const fg = fcv.getContext("2d")!, ftex = new THREE.CanvasTexture(fcv); ftex.colorSpace = THREE.SRGBColorSpace; ftex.wrapS = THREE.RepeatWrapping; ftex.repeat.set(t.l / 26, 1); texs.push(ftex);
    const faixa = malha(new THREE.PlaneGeometry(t.l, 1.3), new THREE.MeshBasicMaterial({ map: ftex, toneMapped: false }), tela); faixa.position.set(0, -1.45, -0.1); faixa.scale.x = -1;   // (o plano é desenhado de frente: na sala espelhada, desvira)
    // os PILARES (do piso até a moldura)
    for (const p of pilaresDoTelao(t)) { const pl = malha(new THREE.CylinderGeometry(0.55, 0.9, t.base + 0.3, 12), moldura); pl.position.set(p.x, y0 + (t.base + 0.3) / 2, p.z); alvos.push(pl); }
    telas.push({ t, cv, g, tex, faixa: { cv: fcv, g: fg, tex: ftex } });
  }
  let painel: PainelMercado | null = null, buscouEm = -Infinity, desenhouEm = -Infinity, buscando = false;
  const desenhar = () => {
    for (const s of telas) {
      s.g.fillStyle = C.fundo; s.g.fillRect(0, 0, s.cv.width, s.cv.height);
      s.g.save(); s.g.scale(s.cv.width / 2048, s.cv.width / 2048); DESENHA[s.t.id](s.g, 2048, Math.round((2048 * s.t.a) / s.t.l), painel); s.g.restore(); s.tex.needsUpdate = true;
      s.faixa.g.save(); s.faixa.g.scale(s.faixa.cv.width / 2048, 1); desenharFaixa(s.faixa.g, 2048, 96, painel); s.faixa.g.restore(); s.faixa.tex.needsUpdate = true;
    }
  };
  const buscar = () => {
    if (buscando) return; buscando = true; buscouEm = Date.now();
    fetch(URL_MERCADO).then((r) => (r.ok ? r.json() : null)).then((p: PainelMercado | null) => { if (p) { painel = p; desenhouEm = -Infinity; } }).catch(() => {}).finally(() => { buscando = false; });
  };
  return {
    group, alvos,
    atualizar(dt, _t, cor) {
      const agora = Date.now();
      if (agora - buscouEm > A_CADA_MS) buscar();
      if (agora - desenhouEm > RELOGIO_MS) { desenhouEm = agora; desenhar(); }
      aceso.color.copy(cor);
      for (const s of telas) s.faixa.tex.offset.x = (s.faixa.tex.offset.x + dt * 0.035) % 1;
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}
