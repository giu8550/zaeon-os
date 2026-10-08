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

/** o DROID — o agente de ONBOARDING. Um OFANIM (Ezequiel 1:15-21): rodas de topázio, uma cruzada dentro da outra,
 *  cheias de olhos, com luz no centro, planando. É INDIVIDUAL: cada pessoa vê o seu (spawnado só no cliente dela, nada
 *  vai pela rede), que sai de um mini portal quando ela nasce no tubo de ensaio, ensina fazendo (espera ela cumprir
 *  cada instrução) e some de volta num portal no fim. Mora na RECEPÇÃO (a antiga base do Andrei): lá, F chama ele. */
export const DROID: AgenteCyber = {
  id: "droid",
  persona: "zaeon",   // o cérebro (no overhaul): a persona da anfitriã
  nome: "Droid",
  papel: "guia · onboarding",
  personalidade: "Um ser antigo e luminoso, gentil e curioso. Fala curto, uma instrução por vez, e espera você fazer antes de seguir. Celebra cada conquista com uma frase e nunca deixa ninguém perdido.",
  tarefas: [
    "Aparecer (num mini portal) pra quem acabou de nascer no tubo de ensaio",
    "Ensinar fazendo: andar, voar de mochila, a capela, as motos, o buraco negro",
    "Esperar a pessoa cumprir cada instrução antes da próxima",
    "Voltar quando chamado na Recepção",
  ],
  funcoes: ["guiar", "apresentar-lugares", "abrir-tunel", "chamar-estudo", "conversar"],
  cor: "#ffc46b",
  lar: { poi: "zaeon", ...mundo(LAR_LOCAL) },
};

export const AGENTES: AgenteCyber[] = [DROID];

/**
 * Onde o agente GUIA anda enquanto acompanha alguém: um pouco à direita e à frente da pessoa (o rosto dela fica
 * visível pra câmera, que está atrás). `facing` = pra onde a pessoa olha (atan2(dx, dz) do mundo).
 */
export function posDoGuia(p: { x: number; z: number }, facing: number, lado = 1.7, frente = 1.1): { x: number; z: number } {
  const fx = Math.sin(facing), fz = Math.cos(facing), rx = -fz, rz = fx;   // a direita de quem olha pra (fx, fz)
  return { x: p.x + rx * lado + fx * frente, z: p.z + rz * lado + fz * frente };
}

/** o lar fica no piso da Zaeon (sanidade dos testes) */
export const noPisoDaZaeon = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) < CIDADE.andavelR;
