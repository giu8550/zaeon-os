/**
 * Cyberespaço — os AGENTES DE IA que MORAM no hiperespaço (o chão do "agentic overhaul"). PURO, sem three.
 *
 * Um agente aqui é um SER com corpo (o mesmo corpo de luz dos avatares — components/cyber/AvatarLuz), um LAR (um lugar
 * do mapa), uma PERSONALIDADE (o texto que vira o prompt quando ligarmos o cérebro dele), TAREFAS (o que ele faz no
 * cyberespaço) e FUNÇÕES (as ferramentas que ele vai poder usar). O cérebro vem do roster unificado
 * (lib/agents/roster: `persona` = o agentKey) — hoje o comportamento é roteirizado (lib/cyber/onboarding); a conversa
 * com a IA entra no overhaul, no mesmo ponto (F = "Falar com <nome>").
 */
import { CIDADE, mundo } from "./ceu";
import { LAR_LOCAL } from "./landmarks";

export type FuncaoAgente = "guiar" | "apresentar-lugares" | "abrir-tunel" | "chamar-estudo" | "conversar";
export type AgenteCyber = {
  id: string;
  /** o cérebro: agentKey no roster (lib/agents/roster ← lib/ai/personas) */
  persona: string;
  nome: string;
  papel: string;
  /** como fala e age (vira o prompt do agente) */
  personalidade: string;
  /** o que faz no hiperespaço */
  tarefas: string[];
  /** as ferramentas que vai poder usar (seams do overhaul) */
  funcoes: FuncaoAgente[];
  /** a cor da luz/armadura do corpo */
  cor: string;
  /** onde mora: o marco (lib/cyber/landmarks) e o ponto (mundo) onde fica quando não está guiando ninguém */
  lar: { poi: string; x: number; z: number };
};

/** a ZAEON — a anfitriã. Mora na RECEPÇÃO (a antiga base do Andrei, no piso da Cidade Zaeon) e recebe quem nasce no
 *  hiperespaço: sai com a pessoa do tubo de ensaio e mostra o que tem pra fazer aqui. */
export const ZAEON_ANFITRIA: AgenteCyber = {
  id: "zaeon",
  persona: "zaeon",
  nome: "Zaeon",
  papel: "anfitriã · onboarding",
  personalidade: "Acolhedora, curiosa e direta. Fala pouco e mostra muito: anda do lado da pessoa, aponta o caminho e explica cada lugar em uma ou duas frases, sem jargão. Celebra as primeiras conquistas e nunca deixa ninguém perdido.",
  tarefas: [
    "Receber quem acabou de nascer no tubo de ensaio",
    "Mostrar a capela (os desktops da Sala de Estudos), as motos e o buraco negro",
    "Explicar a rede de túneis: universidades, Solana House e a praça das bases",
    "Refazer o tour quando alguém pedir",
  ],
  funcoes: ["guiar", "apresentar-lugares", "abrir-tunel", "chamar-estudo", "conversar"],
  cor: "#ffcf6e",
  lar: { poi: "zaeon", ...mundo(LAR_LOCAL) },
};

export const AGENTES: AgenteCyber[] = [ZAEON_ANFITRIA];

/**
 * Onde o agente GUIA anda enquanto acompanha alguém: um pouco à direita e à frente da pessoa (o rosto dela fica
 * visível pra câmera, que está atrás). `facing` = pra onde a pessoa olha (atan2(dx, dz) do mundo).
 */
export function posDoGuia(p: { x: number; z: number }, facing: number, lado = 1.7, frente = 1.1): { x: number; z: number } {
  const fx = Math.sin(facing), fz = Math.cos(facing), rx = -fz, rz = fx;   // a direita de quem olha pra (fx, fz)
  return { x: p.x + rx * lado + fx * frente, z: p.z + rz * lado + fz * frente };
}

/** a agente fica no piso da Zaeon (sanidade dos testes) */
export const noPisoDaZaeon = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) < CIDADE.andavelR;
