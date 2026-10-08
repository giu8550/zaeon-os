import Link from "next/link";
import { lojaLabel, mentoresTab } from "@/lib/mentores/rota";

/**
 * Footer clássico da Zaeon (inspirado no da ChipFlow): blurb da marca + colunas de
 * links + linha final com o ano. Auto-contido (sem depender de @/constants) e no
 * visual da casa. Links legais (Termos, Privacidade) e âncoras da própria landing.
 */

type FooterLink = { label: string; href: string; external?: boolean };
type FooterCol = { title: string; links: FooterLink[] };

const COLS: FooterCol[] = [
  {
    title: "Plataforma",
    links: [
      { label: "Cyberespaço", href: "/#cyberespaco" },
      { label: "Modelos de IA", href: "/#modelos" },
      { label: "Laboratório", href: "/research-lab" },
      { label: lojaLabel(), href: mentoresTab() ? "/mentores" : "/assistentes" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "Como funciona", href: "/#modelos" },
      { label: "Mentores", href: "/#modelos" },
      { label: "Dúvidas (FAQ)", href: "/#faq" },
      { label: "Notícias", href: "/news" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre nós", href: "/about" },
      { label: "Documentação", href: "/docs" },
      { label: "Contato", href: "mailto:contato@zaeon.com.br", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de Uso", href: "/termos" },
      { label: "Privacidade", href: "/privacidade" },
    ],
  },
];

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-slate-200 dark:border-white/10 bg-white/40 dark:bg-black/30 backdrop-blur-xl text-slate-600 dark:text-gray-400">
      <div className="zaeon-borda py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Coluna da marca */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-lg tracking-tight mb-3">
              <span>Zaeon</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-gray-500 leading-relaxed max-w-[220px]">
              Todas as IAs num lugar só, com uma camada científica por cima. Feito pra
              quem estuda e pesquisa de verdade.
            </p>
          </div>

          {/* Colunas de links */}
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                      className="text-sm text-slate-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Linha final */}
        <div className="border-t border-slate-200 dark:border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400 dark:text-gray-600">
          <span>&copy; {year} Zaeon. Todos os direitos reservados.</span>
          <span className="text-[12px] uppercase tracking-widest">Onde humanos e superinteligências se encontram para criar uma nova era</span>
        </div>
      </div>
    </footer>
  );
};
