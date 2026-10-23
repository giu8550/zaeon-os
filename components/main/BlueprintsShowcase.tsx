"use client";

/**
 * BlueprintsShowcase — a seção "Aqui você vale o que você constrói." da landing.
 *
 * Mostra os blueprints que o dono cadastrou e PUBLICOU no admin (/workstation/admin → Blueprints),
 * via GET /api/blueprints (lib/landing/blueprints). Regra do dono: sem nenhum publicado, a seção
 * INTEIRA some — sem título solto, sem card vazio, sem placeholder. Enquanto carrega, também não
 * ocupa espaço (a landing não pula quando a lista chega vazia).
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TituloSecao } from "@/components/layout/secao";
import type { BlueprintPublico } from "@/lib/landing/blueprints";

/** o jogo (mesma rota do "Iniciar jogo" do hero) — destino do "criar o seu" */
const GAME_ROTA = "/lounge-cosmico";

export default function BlueprintsShowcase() {
  const { t } = useTranslation();
  const [itens, setItens] = useState<BlueprintPublico[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/blueprints")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && Array.isArray(d?.blueprints)) setItens(d.blueprints); })
      .catch(() => { /* offline: a seção só não aparece */ });
    return () => { vivo = false; };
  }, []);

  if (itens.length === 0) return null;

  return (
    <section id="blueprints" aria-labelledby="blueprints-titulo" className="relative z-40 w-full zaeon-borda pt-16 md:pt-24 pb-6 scroll-mt-28">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <TituloSecao className="font-display" forte={<span id="blueprints-titulo">{t("landing.blueprints.title", "Aqui você vale o que você constrói.")}</span>} />

        <ul className="mt-10 md:mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((b) => (
            <li key={b.id} className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] backdrop-blur-md transition-colors hover:border-cyan-400/50">
              {b.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a imagem vem de URL livre cadastrada no admin (fora do remotePatterns)
                <img src={b.imageUrl} alt={t("landing.blueprints.image_alt", { title: b.title, defaultValue: "Prévia do blueprint {{title}}" })} loading="lazy" className="aspect-[16/10] w-full object-cover bg-slate-100 dark:bg-white/[0.04]" />
              ) : (
                <div aria-hidden className="aspect-[16/10] w-full bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(129,140,248,0.22),transparent_55%)]" />
              )}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="text-lg font-semibold leading-snug text-slate-900 dark:text-white">{b.title}</h3>
                {b.description && <p className="text-sm leading-relaxed text-slate-600 dark:text-white/65">{b.description}</p>}
                {b.tags.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={t("landing.blueprints.tags", "Tags")}>
                    {b.tags.map((tag) => (
                      <li key={tag} className="rounded-full border border-cyan-500/30 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">{tag}</li>
                    ))}
                  </ul>
                )}
                <a
                  href={b.href || GAME_ROTA}
                  aria-label={`${b.href ? t("landing.blueprints.cta_view", "Ver no game") : t("landing.blueprints.cta_create", "Criar o seu")}: ${b.title}`}
                  className="mt-auto pt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded"
                >
                  {b.href ? t("landing.blueprints.cta_view", "Ver no game") : t("landing.blueprints.cta_create", "Criar o seu")}
                  <span aria-hidden>→</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
