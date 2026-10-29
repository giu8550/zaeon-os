"use client";

/**
 * BlueprintsShowcase — a seção "Aqui você vale o que você constrói." da landing.
 *
 * Mostra os blueprints que o dono cadastrou e PUBLICOU no admin (/workstation/admin → Blueprints),
 * via GET /api/blueprints (lib/landing/blueprints). Sem nenhum publicado, entram os EXEMPLOS (o dono, out/2026:
 * "coloque a seção com blueprints de exemplo") — os seis entregáveis que a Zaeon gera no hero (foguete, motor, PCB,
 * fonte, bateria, painel solar), desenhados em SVG traço a traço quando aparecem (lib/landing/desenhosBlueprint).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TituloSecao } from "@/components/layout/secao";
import type { BlueprintPublico } from "@/lib/landing/blueprints";
import { desenhoEmSvg } from "@/lib/landing/desenhosBlueprint";
import { ENTREGAVEIS, type IdEntregavel } from "@/lib/research/roteiroVitrine";
import TrilhoCarrossel from "@/components/ui/TrilhoCarrossel";

/** o jogo (mesma rota do "Iniciar jogo" do hero) — destino do "criar o seu" */
const GAME_ROTA = "/lounge-cosmico";

/** o CARTÃO do trilho: vidro preto nos dois temas, como os crachás dos agentes — quem passa pelo meio ganha o anel
 *  ciano e um leve zoom (o mesmo destaque do carrossel dos agentes) */
const cartao = (noCentro: boolean) =>
  `dark group flex w-[290px] shrink-0 flex-col overflow-hidden rounded-[22px] border bg-black/80 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-500 md:w-[330px] ${
    noCentro ? "border-cyan-300 shadow-[0_0_0_3px_rgba(34,211,238,0.35),0_22px_60px_-18px_rgba(34,211,238,0.65)] scale-[1.03]" : "border-white/10 shadow-[0_16px_44px_-20px_rgba(0,0,0,0.75)]"
  }`;
const LINK = "mt-auto pt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-cyan-300 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded";

/** um EXEMPLO: o desenho técnico do entregável numa folha de blueprint, se desenhando quando entra na tela */
function ExemploBlueprint({ id, n, noCentro }: { id: IdEntregavel; n: number; noCentro: boolean }) {
  const { t } = useTranslation();
  const svg = useMemo(() => desenhoEmSvg(id, { giro: id === "pcb" || id === "solar" ? 0.35 : 0.6, inclina: id === "pcb" ? 0.55 : 0.3 }), [id]);
  return (
    <article className={cartao(noCentro)}>
      {/* a folha: azul de blueprint, grade fina, o desenho em traço de luz */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0a2540] [background-image:linear-gradient(rgba(127,232,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(127,232,255,0.07)_1px,transparent_1px)] [background-size:18px_18px]">
        <svg viewBox={svg.viewBox} className="absolute inset-0 m-auto h-[86%] w-full" aria-hidden>
          <motion.path
            d={svg.d}
            fill="none"
            stroke="#7fe8ff"
            strokeWidth={0.55}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.4 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 2.6, ease: "easeInOut" }}
            style={{ filter: "drop-shadow(0 0 1.2px rgba(127,232,255,0.8))" }}
          />
        </svg>
        <span className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.2em] text-cyan-200/70">BLUEPRINT · {String(n + 1).padStart(2, "0")}</span>
        <span className="absolute right-3 top-3 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">{t("landing.blueprints.example_badge", "Exemplo")}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-lg font-semibold leading-snug text-white">{t(`landing.blueprints.examples.${id}.title`)}</h3>
        <p className="text-sm leading-relaxed text-white/65">{t(`landing.blueprints.examples.${id}.desc`)}</p>
        <a href={GAME_ROTA} className={LINK}>
          {t("landing.blueprints.cta_create", "Criar o seu")}
          <span aria-hidden>→</span>
        </a>
      </div>
    </article>
  );
}

/** um blueprint PUBLICADO no admin (imagem, título, descrição, tags) */
function PublicadoBlueprint({ b, noCentro }: { b: BlueprintPublico; noCentro: boolean }) {
  const { t } = useTranslation();
  const rotulo = b.href ? t("landing.blueprints.cta_view", "Ver no game") : t("landing.blueprints.cta_create", "Criar o seu");
  return (
    <article className={cartao(noCentro)}>
      {b.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a imagem vem de URL livre cadastrada no admin (fora do remotePatterns)
        <img src={b.imageUrl} alt={t("landing.blueprints.image_alt", { title: b.title, defaultValue: "Prévia do blueprint {{title}}" })} loading="lazy" className="aspect-[16/10] w-full object-cover bg-white/[0.04]" />
      ) : (
        <div aria-hidden className="aspect-[16/10] w-full bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(129,140,248,0.22),transparent_55%)]" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-lg font-semibold leading-snug text-white">{b.title}</h3>
        {b.description && <p className="text-sm leading-relaxed text-white/65">{b.description}</p>}
        {b.tags.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={t("landing.blueprints.tags", "Tags")}>
            {b.tags.map((tag) => (
              <li key={tag} className="rounded-full border border-cyan-500/30 px-2 py-0.5 text-[11px] font-medium text-cyan-300">{tag}</li>
            ))}
          </ul>
        )}
        <a href={b.href || GAME_ROTA} aria-label={`${rotulo}: ${b.title}`} className={LINK}>
          {rotulo}
          <span aria-hidden>→</span>
        </a>
      </div>
    </article>
  );
}

export default function BlueprintsShowcase() {
  const { t } = useTranslation();
  const [itens, setItens] = useState<BlueprintPublico[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/blueprints")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && Array.isArray(d?.blueprints)) setItens(d.blueprints); })
      .catch(() => { /* offline: ficam os exemplos */ });
    return () => { vivo = false; };
  }, []);

  const exemplos = itens.length === 0;
  return (
    <section id="blueprints" aria-labelledby="blueprints-titulo" className="relative z-40 w-full zaeon-borda pt-16 md:pt-24 pb-6 scroll-mt-28">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <TituloSecao className="font-display" forte={<span id="blueprints-titulo">{t("landing.blueprints.title", "Aqui você vale o que você constrói.")}</span>} />

        {/* o CARROSSEL — o mesmo trilho dos agentes (glide contínuo, o do meio em destaque) */}
        <TrilhoCarrossel
          className="mt-10"
          n={exemplos ? ENTREGAVEIS.length : itens.length}
          chave={itens.length}
          rotuloSetas={{ anterior: "Blueprints anteriores", proximo: "Próximos blueprints" }}
          render={(i, { noCentro }) =>
            exemplos ? <ExemploBlueprint id={ENTREGAVEIS[i]!.id} n={i} noCentro={noCentro} /> : <PublicadoBlueprint b={itens[i]!} noCentro={noCentro} />
          }
        />
      </motion.div>
    </section>
  );
}
