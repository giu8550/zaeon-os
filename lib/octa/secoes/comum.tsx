/**
 * lib/octa/secoes/comum.tsx — peças compartilhadas pelas seções: ícones SVG inline, imagem com
 * placeholder em CSS, estrelas, cabeçalho de seção e saneamento de URL.
 *
 * Regras que valem pra todas as seções: nada de estilo inline com dado do usuário (imagem vira
 * <img>, nunca url() em CSS), só classes `z-*` (secoes.css) e links com esquema seguro.
 */
import type { ReactNode } from "react";

/** Aceita http(s), mailto, tel, âncora (#x) e caminho relativo; todo o resto (javascript:, data:…) vira o fallback. */
export function urlSegura(v: unknown, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (!s) return fallback;
  if (/^(https?:|mailto:|tel:)/i.test(s) || s.startsWith("#") || s.startsWith("/")) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return fallback; // outro esquema
  return s; // relativo: "assets/foto.png"
}

/** Só http(s) e relativo — usado em src de <img>/<iframe>. */
export function urlMidia(v: unknown): string {
  const s = urlSegura(v);
  return /^(mailto:|tel:)/i.test(s) || s.startsWith("#") ? "" : s;
}

export const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
export const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : []);

const CAMINHOS: Record<string, ReactNode> = {
  check: (<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  rocket: (<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  chart: (<><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>),
  arrow: (<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>),
  pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  quote: (<><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" /></>),
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  baixo: <path d="m6 9 6 6 6-6" />,
  msg: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  externo: (<><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>),
  rota: <polygon points="3 11 22 2 13 21 11 13 3 11" />,
};

/** Nomes que o agente pode usar em `icon` (o resto cai em "check"). */
export const NOMES_ICONE = ["check", "star", "zap", "shield", "rocket", "users", "lock", "chart"] as const;

export function Icone({ nome, className = "" }: { nome?: string; className?: string }) {
  const caminho = CAMINHOS[nome ?? ""] ?? CAMINHOS.check;
  return (
    <svg className={`z-ico ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {caminho}
    </svg>
  );
}

/** Imagem opcional; sem URL válida, um placeholder em CSS (gradiente das cores do estilo). */
export function Midia({ src, alt = "", className = "" }: { src?: unknown; alt?: string; className?: string }) {
  const url = urlMidia(src);
  return url ? (
    <img className={`z-img ${className}`.trim()} src={url} alt={alt} loading="lazy" decoding="async" />
  ) : (
    <div className={`z-ph ${className}`.trim()} aria-hidden="true" />
  );
}

export function Estrelas({ nota = 5, className = "" }: { nota?: number; className?: string }) {
  const n = Math.min(5, Math.max(0, Math.round(nota)));
  return (
    <div className={`z-estrelas ${className}`.trim()} role="img" aria-label={`${n} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className={i < n ? "z-estrela z-estrela--on" : "z-estrela"} viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

/** Cabeçalho padrão de seção: rótulo, título, subtítulo. Omite o que faltar. */
export function Cabecalho({ eyebrow, title, subtitle, centro = false, nivel = 2 }: { eyebrow?: string; title?: string; subtitle?: string; centro?: boolean; nivel?: 1 | 2 }) {
  if (!eyebrow && !title && !subtitle) return null;
  const H = nivel === 1 ? "h1" : "h2";
  return (
    <header className={centro ? "z-cab z-cab--centro" : "z-cab"}>
      {eyebrow ? <p className="z-eyebrow">{eyebrow}</p> : null}
      {title ? <H className="z-titulo">{title}</H> : null}
      {subtitle ? <p className="z-lead">{subtitle}</p> : null}
    </header>
  );
}

/** Parágrafos a partir de texto com quebras de linha. */
export function Paragrafos({ texto, className = "" }: { texto?: string; className?: string }) {
  const linhas = (texto ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return <>{linhas.map((l, i) => <p key={i} className={className}>{l}</p>)}</>;
}

export function Botao({ href, children, variante = "", seta = false }: { href?: string; children?: ReactNode; variante?: "" | "vazado" | "texto"; seta?: boolean }) {
  if (!children) return null;
  return (
    <a className={`z-btn${variante ? ` z-btn--${variante}` : ""}`} href={urlSegura(href, "#contato")}>
      {children}
      {seta ? <Icone nome="arrow" className="z-btn-seta" /> : null}
    </a>
  );
}

export const linkMapa = (endereco: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
export const linkTel = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
