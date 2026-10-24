/** os sinais pra AVATAR do painel dos documentos (components/research/ZaeonDocumentos), sem acoplar os componentes:
 *  `detail` = true quando a resposta da IA começa a sair (ela escreve no holograma), false quando acaba */
export const EVT_ZAEON_ESCREVENDO = "zaeon:escrevendo";

/** QUEM aparece no painel dos documentos (out/2026, o dono: "a troca de avatares deve ser feita mediante o padrão lá no
 *  topo superior esquerdo") — é o AGENTE do chat escolhido no seletor da sidebar (lib/agents/chatAgentes): Aura, Zenita
 *  ou Nina, cada uma com o seu corpo VRM (lib/cyber/estiloAvatar → CORPOS_VRM). O Octa Code não tem avatar (null). */
export type PersonaId = "aura" | "zenita" | "nina";
export const PERSONAS: readonly { id: PersonaId; nome: string }[] = [
  { id: "aura", nome: "Aura" },
  { id: "zenita", nome: "Zenita" },
  { id: "nina", nome: "Nina" },
];
/** o agente do chat → a persona do painel (null = sem avatar: o Octa Code, ou qualquer outro) */
export const personaDoAgente = (agente: unknown): PersonaId | null => PERSONAS.find((p) => p.id === agente)?.id ?? null;
export const nomeDaPersona = (id: PersonaId) => PERSONAS.find((p) => p.id === id)?.nome ?? "Aura";
/** `detail` = a PersonaId do agente escolhido, ou null */
export const EVT_PERSONA = "zaeon:persona";
/** onde o lab guarda o agente escolhido (app/research-lab/page) */
export const CHAVE_AGENTE = "zaeon.lab.agente";

export function personaSalva(): PersonaId | null {
  try { const a = localStorage.getItem(CHAVE_AGENTE); return a === null ? "aura" : personaDoAgente(a); } catch { return "aura"; }
}
/** o seletor da sidebar trocou de agente: avisa o painel */
export function avisarPersona(agente: string) {
  window.dispatchEvent(new CustomEvent(EVT_PERSONA, { detail: personaDoAgente(agente) }));
}
