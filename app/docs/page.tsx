import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zaeon · Documentação",
  description: "Como a Zaeon funciona: agentes, pipeline de pesquisa, memória, verificação e credenciais.",
};

/**
 * /docs — a documentação (public/docs/index.html, GitBook estático) DENTRO do shell do site.
 * Como rota do app, herda a Navbar do layout (a página estática sozinha não tinha); o iframe
 * ocupa o resto da tela, abaixo da barra de 64px.
 */
export default function DocsPage() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-[64px] z-[50] bg-white dark:bg-[#0b0d12]">
      <iframe src="/docs/index.html" title="Documentação da Zaeon" className="h-full w-full border-0" />
    </div>
  );
}
