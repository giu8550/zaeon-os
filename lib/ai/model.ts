/**
 * Modelo Gemini central para toda a aplicação (Vertex AI).
 *
 * Por que existe: o Google aposentou `gemini-2.0-flash-001` em 2026-06-01,
 * sem fallback automático, e ele estava hardcoded em ~9 rotas — o que derrubou
 * o chat widget e os demais endpoints de IA de uma vez.
 *
 * Daqui pra frente, troca de modelo = 1 linha (ou a env GEMINI_MODEL).
 * Ref: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
