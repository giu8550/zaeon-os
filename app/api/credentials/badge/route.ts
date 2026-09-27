/**
 * GET /api/credentials/badge?type=skill&title=... — imagem (SVG) da credencial.
 * Pública e determinística: a Crossmint baixa esta URL no mint (reuploadLinkedFiles → IPFS).
 * Sem linguagem cripto: "conquista", "certificado", "prova".
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LABEL: Record<string, string> = {
  skill: "Habilidade dominada",
  work: "Trabalho concluído",
  course: "Aula concluída",
  "mentor-cert": "Certificação de mentor",
};
const ACCENT: Record<string, string> = { skill: "#22d3ee", work: "#a78bfa", course: "#34d399", "mentor-cert": "#fbbf24" };

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Quebra o título em até 3 linhas de ~26 chars (SVG não tem word-wrap). */
function wrap(text: string, max = 26, lines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
    if (out.length === lines) break;
  }
  if (cur && out.length < lines) out.push(cur);
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…");
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "skill").toLowerCase();
  const title = (searchParams.get("title") || "Conquista").slice(0, 120);
  const label = LABEL[type] || "Conquista";
  const accent = ACCENT[type] || "#22d3ee";
  const lines = wrap(title);
  const titleSvg = lines
    .map((l, i) => `<text x="60" y="${300 + i * 44}" font-size="34" font-weight="700" fill="#ffffff">${esc(l)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0f2a"/><stop offset="1" stop-color="#1b1140"/></linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.15" r="0.6"><stop offset="0" stop-color="${accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="600" height="600" rx="48" fill="url(#bg)"/>
  <rect width="600" height="600" rx="48" fill="url(#glow)"/>
  <rect x="24" y="24" width="552" height="552" rx="36" fill="none" stroke="rgba(255,255,255,0.14)"/>
  <polygon points="80,120 120,50 160,120" fill="none" stroke="${accent}" stroke-width="6" stroke-linejoin="round"/>
  <text x="180" y="100" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="6" fill="#cbd5e1">ZAEON</text>
  <text x="60" y="230" font-family="Inter, Helvetica, Arial, sans-serif" font-size="16" font-weight="800" letter-spacing="4" fill="${accent}">${esc(label.toUpperCase())}</text>
  <g font-family="Inter, Helvetica, Arial, sans-serif">${titleSvg}</g>
  <text x="60" y="520" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.55)">Credencial intransferível · prova verificável do aluno</text>
  <text x="60" y="546" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" letter-spacing="2" fill="rgba(255,255,255,0.35)">VERIFICÁVEL NA SOLANA</text>
</svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400, immutable" },
  });
}
