import { VertexAI } from "@google-cloud/vertexai";

function makeVertex() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
  return new VertexAI({
    project: credentials.project_id || process.env.GOOGLE_PROJECT_ID,
    location: process.env.GOOGLE_LOCATION || "us-central1",
    googleAuthOptions: { credentials: { client_email: credentials.client_email, private_key: credentials.private_key } },
  });
}

export function getGeminiModel(systemInstruction?: string, opts?: { temperature?: number }) {
  return makeVertex().getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: { temperature: opts?.temperature ?? 0.2, responseMimeType: "application/json" },
    ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
  });
}

// Free-text model for streaming chat (no JSON mime — emits prose tokens).
export function getGeminiChatModel(systemInstruction?: string, opts?: { temperature?: number }) {
  return makeVertex().getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: { temperature: opts?.temperature ?? 0.4 },
    ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
  });
}

export async function geminiJson<T>(systemInstruction: string, userPrompt: string, opts?: { temperature?: number }): Promise<T> {
  const model = getGeminiModel(systemInstruction, opts);
  const result = await model.generateContent(userPrompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as T;
}
