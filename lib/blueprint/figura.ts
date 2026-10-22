/**
 * BLUEPRINT PRÁTICO — a FIGURA do tema (PURO). Pedido do dono: "queremos VISUALIZAR as coisas — por isso o anatomy;
 * desenho vale mais do que cards com palavras". Padrão do wheresryan22/anatomy (MIT): "o objeto é a explicação" — uma
 * máquina isométrica cujas peças SÃO os componentes do estudo, montada a partir da LISTA DE PEÇAS (a Zaeon escolhe as
 * peças e as ligações; o desenho é nosso, determinístico — nada de SVG livre do modelo).
 * Cada peça acende quando uma entrega a prova: verde = provada, vermelha = travada por um crítico aberto, tracejada =
 * ainda não construída. A altura do bloco cresce com a fase em que a peça é construída.
 */
import type { DocBlueprint, Peca } from "./tipos";

export type EstadoPeca = "ok" | "trava" | "futuro";
export type PecaPosta = Peca & { codigo: string; gx: number; gy: number; w: number; d: number; h: number; estado: EstadoPeca };

const C30 = Math.cos(Math.PI / 6);
/** a projeção isométrica (x, y no chão; z pra cima) → tela */
export const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * C30, (x + y) * 0.5 - z];

export function estadoPeca(doc: DocBlueprint, p: Peca): EstadoPeca {
  const dela = doc.criticos.filter((c) => c.pecaId === p.id);
  if (dela.some((c) => c.status === "aberto" && c.fase === doc.fase)) return "trava";
  if (p.fase < doc.fase || (doc.aguardandoMentor && p.fase <= doc.fase) || dela.some((c) => c.status === "provado")) return "ok";
  return "futuro";
}

const POR_FILEIRA = 3, PASSO_X = 150, PASSO_Y = 160, LADO = 72, MARGEM = 26;

export function montarFigura(doc: DocBlueprint): { pecas: PecaPosta[]; ligacoes: [string, string][]; ordem: string[]; caixa: { x: number; y: number; w: number; h: number } } {
  const pecas: PecaPosta[] = doc.pecas.map((p, i) => {
    const r = Math.floor(i / POR_FILEIRA), k = i % POR_FILEIRA, col = r % 2 === 0 ? k : POR_FILEIRA - 1 - k;   // serpentina: o fluxo nunca pula
    return { ...p, codigo: `C-${String(i + 1).padStart(2, "0")}`, gx: col * PASSO_X, gy: r * PASSO_Y, w: LADO, d: LADO, h: 34 + 16 * p.fase, estado: estadoPeca(doc, p) };
  });
  const ids = new Set(pecas.map((p) => p.id));
  const ligacoes = doc.ligacoes.filter(([a, b]) => ids.has(a) && ids.has(b));
  const ordem = [...pecas].sort((a, b) => a.gx + a.gy - (b.gx + b.gy)).map((p) => p.id);
  // a caixa do desenho: os cantos projetados de todas as peças (+ espaço pros rótulos em cima)
  const pts = pecas.flatMap((p) => [iso(p.gx, p.gy, 0), iso(p.gx + p.w, p.gy, 0), iso(p.gx, p.gy + p.d, 0), iso(p.gx + p.w, p.gy + p.d, 0), iso(p.gx, p.gy, p.h + 44)]);
  if (!pts.length) return { pecas, ligacoes, ordem, caixa: { x: -100, y: -40, w: 200, h: 80 } };
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs) - MARGEM - 70, x1 = Math.max(...xs) + MARGEM + 70, y0 = Math.min(...ys) - MARGEM, y1 = Math.max(...ys) + MARGEM;
  return { pecas, ligacoes, ordem, caixa: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
