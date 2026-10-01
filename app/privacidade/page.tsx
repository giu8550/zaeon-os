import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade — Zaeon",
  description: "Como a Zaeon trata seus dados.",
};

const ATUALIZADO = "27 de setembro de 2026";

export default function PrivacidadePage() {
  return (
    <main className="w-full min-h-screen bg-background text-slate-800 dark:text-white/90">
      <div className="zaeon-borda pt-[140px] pb-24 max-w-[820px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-400/80">
          Legal
        </p>
        <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-white/50">
          Última atualização: {ATUALIZADO}
        </p>

        <div className="mt-10 flex flex-col gap-8 leading-relaxed text-[15px] text-slate-700 dark:text-white/75">
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">1. Dados que coletamos</h2>
            <p>
              Coletamos os dados que você fornece (nome, e-mail, conteúdo das conversas e
              documentos) e dados técnicos mínimos necessários para operar e proteger o
              serviço (por exemplo, registros de acesso).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">2. Como usamos</h2>
            <p>
              Usamos seus dados para fornecer o serviço, personalizar sua experiência,
              processar pagamentos e melhorar a plataforma. Não vendemos seus dados
              pessoais a terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">3. IA e terceiros</h2>
            <p>
              Para gerar respostas, trechos do seu conteúdo podem ser processados por
              provedores de modelos de IA e outros serviços de infraestrutura, apenas na
              medida necessária para executar a sua solicitação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">4. Seus direitos (LGPD)</h2>
            <p>
              Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus
              dados, além de revogar consentimentos, conforme a Lei Geral de Proteção de
              Dados. Basta entrar em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">5. Segurança e retenção</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados.
              Mantemos as informações apenas pelo tempo necessário às finalidades descritas
              ou conforme exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">6. Contato do encarregado</h2>
            <p>
              Para exercer seus direitos ou tirar dúvidas sobre privacidade:{" "}
              <a href="mailto:privacidade@zaeon.com.br" className="text-cyan-600 dark:text-cyan-400 underline underline-offset-4">
                privacidade@zaeon.com.br
              </a>
              .
            </p>
          </section>

          <p className="text-[13px] text-slate-400 dark:text-white/40 border-t border-slate-200 dark:border-white/10 pt-6">
            Este documento é um modelo inicial e não substitui aconselhamento jurídico.
            Recomenda-se revisão por um advogado antes do lançamento público.
          </p>
        </div>

        <div className="mt-12">
          <Link href="/" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline underline-offset-4">
            ← Voltar para a Zaeon
          </Link>
        </div>
      </div>
    </main>
  );
}
