import { VertexAI } from "@google-cloud/vertexai";

// Modelos por env (ajustáveis sem redeploy). O gemini-2.0-flash-001 foi descontinuado (404 no Vertex).
// Heavy = raciocínio complexo (síntese, sugestões); Chat = mini-chat (resposta rápida).
const HEAVY_MODEL = process.env.SCHOLAR_GEMINI_MODEL || "gemini-2.5-pro";
const CHAT_MODEL = process.env.SCHOLAR_GEMINI_CHAT_MODEL || "gemini-2.5-flash";

function makeVertex() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
  return new VertexAI({
    project: credentials.project_id || process.env.GOOGLE_PROJECT_ID,
    location: process.env.GOOGLE_LOCATION || "us-central1",
    googleAuthOptions: { credentials: { client_email: credentials.client_email, private_key: credentials.private_key } },
  });
}

export function getGeminiModel(systemInstruction?: string, opts?: { temperature?: number; model?: string }) {
  return makeVertex().getGenerativeModel({
    model: opts?.model || HEAVY_MODEL,
    generationConfig: { temperature: opts?.temperature ?? 0.2, responseMimeType: "application/json" },
    ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
  });
}

// Free-text model for streaming chat (no JSON mime — emits prose tokens).
export function getGeminiChatModel(systemInstruction?: string, opts?: { temperature?: number; model?: string }) {
  return makeVertex().getGenerativeModel({
    model: opts?.model || CHAT_MODEL,
    generationConfig: { temperature: opts?.temperature ?? 0.4 },
    ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
  });
}

export async function geminiJson<T>(systemInstruction: string, userPrompt: string, opts?: { temperature?: number; model?: string }): Promise<T> {
  const model = getGeminiModel(systemInstruction, opts);
  const result = await model.generateContent(userPrompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as T;
}
