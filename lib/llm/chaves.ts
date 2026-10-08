/**
 * lib/llm/chaves.ts — contrato C6 (virtual key por agente). As funções vivem em lib/llm/usage.ts
 * (puras, testadas); este módulo só dá o nome que o handoff §4 cita. Não duplicar.
 *   GATEWAY_KEY_<AGENTKEY> → key do agente · GATEWAY_KEY_DEFAULT → fallback · nenhuma → null
 */
export { chaveDoAgente, nomeEnvDaChave, gatewayLigado } from "@/lib/llm/usage";
