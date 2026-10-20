/**
 * DIÁLOGO "rpg-like" do tutorial (PURO). Antes da 1ª conversa com a Zaeon — e em toda CUTSCENE — as falas saem numa
 * CAIXA DE DIÁLOGO no pé da tela (retrato, nome, letra grande, máquina de escrever, as teclas da instrução em
 * destaque). Depois da Zaeon, fora de cena, viram BALÕES em cima de quem fala (maiores que os de antes). A INSTRUÇÃO de
 * um passo só sai da tela quando a pessoa faz a ação.
 */
export type Dialogo = {
  quem: "droid" | "zaeon" | "examiner";
  nome: string;
  cor: string;
  texto: string;
  /** a instrução do passo (fica até a ação ser feita): mostra as teclas e o objetivo */
  instrucao: boolean;
  teclas?: string[];
  /** o objetivo do passo (o "quest log": Andar, Correr…) */
  objetivo?: string;
  /** um AVISO em destaque (o veredito do Droid sobre a pesquisa) */
  alerta?: boolean;
};

/** onde a fala sai: na CAIXA (tutorial antes da Zaeon, ou em cena) ou no BALÃO em cima de quem fala */
export function ondeFala(o: { tutorial: boolean; balaoLiberado: boolean; emCena: boolean }): "caixa" | "balao" {
  if (!o.tutorial) return "balao";
  return !o.balaoLiberado || o.emCena ? "caixa" : "balao";
}

/** a máquina de escrever: quantas letras por segundo */
export const ESCRITA_CPS = 42;
/** o texto que já apareceu depois de `t` s (inteiro no fim; um ✦ ou emoji não quebra no meio) */
export function textoEscrito(texto: string, t: number, cps = ESCRITA_CPS): string {
  const letras = Array.from(texto), n = Math.max(0, Math.floor(t * cps));
  return n >= letras.length ? texto : letras.slice(0, n).join("");
}
export const escritaAcabou = (texto: string, t: number, cps = ESCRITA_CPS) => Math.floor(t * cps) >= Array.from(texto).length;

/** o balão de fala em DESTAQUE (o Droid no tutorial, depois da Zaeon): maior que o comum, com brilho */
export const FALA_DESTAQUE_CSS = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:300px;font:600 15px/1.35 system-ui,sans-serif;color:#fff7e6;background:rgba(18,12,4,.9);border:1.5px solid;padding:10px 15px;border-radius:14px;pointer-events:none;overflow-wrap:anywhere;letter-spacing:.01em;";
