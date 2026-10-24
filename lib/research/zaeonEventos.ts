/** os sinais pra ZAEON do painel de documentos (components/research/ZaeonDocumentos), sem acoplar os componentes:
 *  `detail` = true quando a resposta da IA começa a sair (ela escreve no tablet), false quando acaba */
export const EVT_ZAEON_ESCREVENDO = "zaeon:escrevendo";

/** QUEM aparece no painel dos documentos (out/2026, o dono: "coloca a Aura, a Zenita e a Nina no chat pra escolher lá
 *  em cima; cada escolha carrega um avatar diferente; o Octa Code não tem avatar"). O id é o do corpo VRM
 *  (lib/cyber/estiloAvatar → CORPOS_VRM). */
export type PersonaId = "aura" | "zenita" | "nina";
export const PERSONAS: readonly { id: PersonaId; nome: string }[] = [
  { id: "aura", nome: "Aura" },
  { id: "zenita", nome: "Zenita" },
  { id: "nina", nome: "Nina" },
];
export const personaValida = (s: unknown): PersonaId => PERSONAS.find((p) => p.id === s)?.id ?? "aura";
export const nomeDaPersona = (id: PersonaId) => PERSONAS.find((p) => p.id === id)?.nome ?? "Aura";
/** `detail` = a PersonaId escolhida */
export const EVT_PERSONA = "zaeon:persona";
const CHAVE = "zaeon.lab.persona";

export function personaSalva(): PersonaId {
  try { return personaValida(localStorage.getItem(CHAVE)); } catch { return "aura"; }
}
export function escolherPersona(id: PersonaId) {
  try { localStorage.setItem(CHAVE, id); } catch { /* storage bloqueado: vale só nesta aba */ }
  window.dispatchEvent(new CustomEvent(EVT_PERSONA, { detail: id }));
}
