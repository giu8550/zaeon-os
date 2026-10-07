#!/usr/bin/env node
/**
 * Gera a SAUDAÇÃO falada de um agente (voz real, Gemini-TTS no Vertex) → clipes estáticos em
 * public/avatars/<id>/voz/saudacao-NN.wav e registra em manifest.json (`voz.saudacoes`).
 * Clipe pronto = toca na hora, sem custo de TTS por visita. O avatar mexe a boca pelo nível do
 * áudio (lib/avatars/falar.ts). Mesmo jeito de scripts/generate-voice-fillers.mjs.
 *
 *   node --env-file=.env scripts/avatars/gerar-saudacao.mjs aura
 *   node --env-file=.env scripts/avatars/gerar-saudacao.mjs --todos
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

// Voz de cada agente casa com o avatar (gênero + jeito). persona.voice em lib/ai/personas.ts é só
// metadado (o app fala na voz que o usuário escolhe) — aqui é a voz PRÓPRIA do personagem.
const SAUDACOES = {
  aura: { voz: "Aoede", frases: [
    "Oi! Eu sou a Aura. Pode falar comigo, tô aqui pra te ajudar.",
    "Oi, que bom te ver! Me conta: o que a gente vai estudar hoje?",
    "E aí! Manda a tua dúvida que a gente resolve junto.",
  ] },
  zaeon: { voz: "Sulafat", frases: [
    "Oi, que bom que você chegou! Eu sou a Zaeon, e vou te levar pro lugar certo.",
    "Que bom te ver por aqui! Me conta o que você precisa hoje.",
    "Oi! Pode falar comigo, que eu chamo quem pode te ajudar.",
  ] },
  nina: { voz: "Leda", frases: [
    "Oi! Eu sou a Nina. Bora estudar juntos hoje?",
    "E aí! O que a gente vai aprender agora?",
    "Oi, que bom que você veio! Abre o caderno que eu te ajudo.",
  ] },
  caio: { voz: "Charon", frases: [
    "Olá! Eu sou o Caio. Vamos escrever esse trabalho juntos?",
    "Oi! Me mostra o que você já tem, que a gente organiza o texto.",
    "E aí! Pronto pra tirar esse TCC do papel?",
  ] },
  teo: { voz: "Puck", frases: [
    "Fala! Eu sou o Téo. Bora codar?",
    "E aí! Me diz o que você quer construir hoje.",
    "Oi! Abre o projeto que eu te ajudo a fazer rodar.",
  ] },
  zenita: { voz: "Kore", frases: [
    "Oi! Eu sou a Zenita. Vamos organizar a tua agenda?",
    "Oi! Me fala as tuas aulas, que eu anoto tudo.",
    "Oi! Bora deixar a semana em ordem?",
  ] },
  core_active: { voz: "Achird", frases: [
    "Oi! Eu sou o Davi. Me conta os teus compromissos, que eu cuido da agenda.",
    "E aí! Tem aula, prova ou entrega essa semana?",
    "Oi! Pode falar, que eu monto a tua agenda pra você.",
  ] },
  scholar: { voz: "Iapetus", frases: [
    "Olá. Eu sou o Scholar. Me passe o texto, e eu cuido das citações na ABNT.",
    "Olá! Vamos acertar essas referências?",
    "Olá. Qual obra você quer citar hoje?",
  ] },
  examiner: { voz: "Erinome", frases: [
    "Oi! Eu sou a Examiner. Preparado pra um desafio?",
    "E aí! Vamos testar o que você aprendeu?",
    "Oi! Uma pergunta por vez, e sem colar, hein?",
  ] },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => (s || "").replace(/^["']|["']$/g, "");
function creds() {
  let c = {};
  const raw = process.env.GOOGLE_CREDENTIALS || "";
  try { c = JSON.parse(raw); } catch { try { c = JSON.parse(raw.replace(/\n/g, "\\n")); } catch { c = {}; } }
  let private_key = c.private_key || strip(process.env.GOOGLE_PRIVATE_KEY) || "";
  if (private_key.includes("\\n")) private_key = private_key.replace(/\\n/g, "\n");
  return { project: c.project_id || strip(process.env.GOOGLE_PROJECT_ID), client_email: c.client_email || strip(process.env.GOOGLE_CLIENT_EMAIL), private_key, location: strip(process.env.GOOGLE_LOCATION) || "us-central1" };
}
function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii"); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii"); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii"); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function main() {
  const ids = process.argv[2] === "--todos" ? Object.keys(SAUDACOES) : process.argv.slice(2);
  for (const id of ids) await gerar(id);
}

async function gerar(id) {
  const cfg = SAUDACOES[id];
  if (!cfg) { console.error(`sem saudação pra "${id}" (edite SAUDACOES)`); process.exit(1); }
  const { project, client_email, private_key, location } = creds();
  const token = await new GoogleAuth({ credentials: { client_email, private_key }, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getAccessToken();
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-tts";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const dir = path.resolve("public/avatars", id, "voz");
  await mkdir(dir, { recursive: true });
  const urls = [];
  for (let i = 0; i < cfg.frases.length; i++) {
    const n = String(i + 1).padStart(2, "0");
    let ok = false;
    for (let t = 0; t < 4 && !ok; t++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `Diga com voz calorosa, alegre e natural, em português do Brasil: ${cfg.frases[i]}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voz } } } },
        }),
      });
      if (res.status === 429) { process.stdout.write("(429) "); await sleep(20_000); continue; }
      if (!res.ok) { console.log(`✗ ${n}`, res.status, (await res.text()).slice(0, 160)); break; }
      const inline = (await res.json())?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData;
      if (!inline) { console.log(`✗ ${n} sem áudio`); break; }
      const rate = parseInt(/rate=(\d+)/.exec(inline.mimeType || "")?.[1] || "24000", 10);
      const wav = /wav/i.test(inline.mimeType || "") ? Buffer.from(inline.data, "base64") : pcmToWav(Buffer.from(inline.data, "base64"), rate);
      await writeFile(path.join(dir, `saudacao-${n}.wav`), wav);
      urls.push(`/avatars/${id}/voz/saudacao-${n}.wav`);
      console.log(`✓ ${id} ${n} (${(wav.length / 1024).toFixed(0)}kb) "${cfg.frases[i]}"`);
      ok = true;
    }
  }
  // registra no manifest do avatar (o estúdio preserva `voz` ao salvar)
  const mPath = path.resolve("public/avatars", id, "manifest.json");
  const m = JSON.parse(await readFile(mPath, "utf8"));
  m.voz = { saudacoes: urls };
  await writeFile(mPath, JSON.stringify(m, null, 2) + "\n");
  console.log(`manifest ${id}: ${urls.length} saudações (${cfg.voz})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
