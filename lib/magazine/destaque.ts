/**
 * lib/magazine/destaque.ts — a expressão em LaTeX vira uma CAIXA, antes de diagramar.
 *
 * POR QUE ISTO É DIFERENTE DA MOLÉCULA. O artefato 3D saiu do rio de texto porque o
 * tamanho dele só é conhecido depois que o 3Dmol monta, se mede e avisa — duas contas em
 * momentos diferentes, e essa corrida era a classe de bug. O destaque é o oposto:
 * `katex.renderToString` é SÍNCRONO, então dá pra renderizar fora da tela, ler a caixa e
 * entregar ao motor de layout na MESMA passada que mede o texto, antes do primeiro glifo
 * ser posicionado. Um número, um momento, sem corrida — por isso ele pode ser obstáculo.
 *
 * O único pedaço assíncrono são as fontes do KaTeX. Medir antes delas carregarem daria
 * uma caixa que muda depois, que é exatamente a corrida que a gente está evitando — daí
 * `fontesDoKatexProntas()`, que o chamador usa no mesmo portão das fontes do corpo.
 */
import type { Destaque } from "@/lib/agent/contracts";

export type DestaqueMedido = {
  latex: string;
  rotulo?: string;
  html: string;      // já renderizado, pronto pra injetar
  largura: number;
  altura: number;
};

/** Respiro em volta da caixa, para o texto não encostar na fórmula. */
export const FOLGA_DESTAQUE = 14;

let katexPromessa: Promise<typeof import("katex")> | null = null;
/** Import dinâmico: KaTeX (~280KB + fontes) só entra pra quem tem destaque na resposta. */
function carregarKatex() {
  if (!katexPromessa) katexPromessa = import("katex").then((m) => (m as any).default ?? m);
  return katexPromessa;
}

/**
 * As fontes do KaTeX carregaram? Elas chegam por CSS, então a gente pede ao navegador
 * que as garanta antes de medir. `false` significa "mede depois", não "falhou".
 */
export async function fontesDoKatexProntas(timeoutMs = 2500): Promise<boolean> {
  try {
    const fontes = (document as any)?.fonts;
    if (!fontes?.load) return true;
    await Promise.race([
      Promise.all([
        fontes.load('400 20px KaTeX_Main'),
        fontes.load('400 20px KaTeX_Math'),
        fontes.load('400 20px KaTeX_Size2'),
      ]),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
    return true;
  } catch {
    return true; // medir com a queda é melhor que não medir
  }
}

/**
 * Renderiza e mede. Roda fora da tela, num container que é criado e removido na mesma
 * função — nada fica pendurado no documento.
 *
 * `larguraMaxima` é o teto: uma fórmula mais larga que a coluna seria um obstáculo
 * impossível de contornar, e o motor de layout desceria linhas para sempre.
 */
/**
 * A MARCAÇÃO TEM QUE SER A MESMA. O que se mede aqui não é a caixa do KaTeX: é a
 * `<figure>` inteira, com a classe, o padding, a borda e a legenda — porque é ela que
 * vai virar buraco no texto. Medir só a fórmula reserva menos espaço do que a figura
 * ocupa, e a legenda acaba impressa por cima da primeira linha que passar por baixo.
 */
function montarFigura(html: string, rotulo?: string): HTMLElement {
  const fig = document.createElement("figure");
  fig.className = "z-revista-destaque m-0";
  fig.style.cssText = "display:inline-block;position:static;";
  const corpo = document.createElement("div");
  corpo.innerHTML = html;
  fig.appendChild(corpo);
  if (rotulo) {
    const cap = document.createElement("figcaption");
    cap.className = "mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-white/40";
    cap.textContent = rotulo;
    fig.appendChild(cap);
  }
  return fig;
}

export async function medirDestaques(
  destaques: readonly Destaque[],
  larguraMaxima: number,
  container: HTMLElement,
): Promise<DestaqueMedido[]> {
  if (!destaques.length || typeof document === "undefined") return [];
  const katex = await carregarKatex();
  await fontesDoKatexProntas();

  // O palco vive DENTRO do container real: `.z-revista-destaque` e as classes da legenda
  // herdam tamanho e cor de onde estiverem, então medir no `body` daria uma caixa de
  // outro tamanho que a de verdade — a mesma classe de erro do `ctx.font` com `var()`.
  const palco = document.createElement("div");
  palco.setAttribute("aria-hidden", "true");
  palco.style.cssText =
    "position:absolute;left:-99999px;top:0;width:auto;visibility:hidden;pointer-events:none;";
  container.appendChild(palco);

  const saida: DestaqueMedido[] = [];
  try {
    for (const d of destaques) {
      let html = "";
      try {
        html = katex.renderToString(d.latex, { displayMode: true, throwOnError: false });
      } catch {
        continue; // LaTeX inválido não derruba a página; o destaque só não nasce
      }
      const caixa = montarFigura(html, d.rotulo);
      palco.appendChild(caixa);
      const r = caixa.getBoundingClientRect();
      palco.removeChild(caixa);
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.width > larguraMaxima) continue; // não cabe na coluna: some em silêncio
      saida.push({
        latex: d.latex,
        rotulo: d.rotulo,
        html,
        largura: Math.ceil(r.width),
        altura: Math.ceil(r.height),
      });
    }
  } finally {
    palco.remove();
  }
  return saida;
}

/**
 * Onde cada destaque mora na coluna.
 *
 * Duas formas, e quem decide é a largura da fórmula contra a da coluna. Estreita: vira
 * figura lateral e o texto contorna, alternando o lado como numa revista. Larga (mais de
 * 45% da coluna): vira FAIXA — ocupa a linha inteira e o texto passa por baixo. A régua
 * existe porque um corredor de três letras não é diagramação, é uma coluna quebrada: é o
 * que acontecia no telefone, onde qualquer fórmula já é larga em relação à coluna.
 */
export const FRACAO_FAIXA = 0.45;

export function posicionarDestaques(
  medidos: readonly DestaqueMedido[],
  largura: number,
  entrelinha: number,
): { x: number; y: number; w: number; h: number }[] {
  let lado = 0; // alterna só entre os laterais; a faixa não tem lado
  return medidos.map((d, i) => {
    const y = Math.round(entrelinha * (4 + i * 7));
    if (d.largura > largura * FRACAO_FAIXA) {
      return { x: 0, y, w: largura, h: d.altura };
    }
    const x = lado++ % 2 === 0 ? Math.max(0, largura - d.largura) : 0;
    return { x, y, w: d.largura, h: d.altura };
  });
}
