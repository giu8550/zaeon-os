import Link from "next/link";

export const metadata = {
  title: "Termos de Uso — Zaeon",
  description: "Termos de Uso da plataforma Zaeon.",
};

const ATUALIZADO = "27 de setembro de 2026";

export default function TermosPage() {
  return (
    <main className="w-full min-h-screen bg-background text-slate-800 dark:text-white/90">
      <div className="zaeon-borda pt-[140px] pb-24 max-w-[820px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-400/80">
          Legal
        </p>
        <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Termos de Uso
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-white/50">
          Última atualização: {ATUALIZADO}
        </p>

        <div className="mt-10 flex flex-col gap-8 leading-relaxed text-[15px] text-slate-700 dark:text-white/75">
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">1. Aceitação</h2>
            <p>
              Ao acessar ou usar a Zaeon (&quot;plataforma&quot;), você concorda com estes
              Termos de Uso. Se não concordar, não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">2. O serviço</h2>
            <p>
              A Zaeon oferece acesso a modelos de inteligência artificial de terceiros e a
              ferramentas próprias de estudo e pesquisa. Os modelos de IA podem gerar
              conteúdo impreciso; você é responsável por verificar informações antes de
              usá-las, especialmente em contextos acadêmicos, jurídicos, médicos ou
              financeiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">3. Conta e elegibilidade</h2>
            <p>
              Você é responsável por manter a confidencialidade das suas credenciais e por
              toda atividade na sua conta. Você declara ter idade e capacidade legais para
              celebrar este contrato.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">4. Uso aceitável</h2>
            <p>
              Você concorda em não usar a plataforma para fins ilegais, para violar
              direitos de terceiros, gerar conteúdo prejudicial, ou tentar burlar limites
              técnicos e de segurança. Podemos suspender contas que violem estas regras.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">5. Conteúdo e propriedade</h2>
            <p>
              O conteúdo que você cria continua sendo seu. Você nos concede a licença
              necessária para operar o serviço (armazenar e processar seus dados). A marca,
              o software e o design da Zaeon são de nossa propriedade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">6. Assinatura e pagamentos</h2>
            <p>
              Planos pagos são cobrados conforme informado no momento da contratação. Você
              pode cancelar a qualquer momento; o acesso permanece até o fim do período já
              pago, salvo disposição legal em contrário.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">7. Isenções e limitação de responsabilidade</h2>
            <p>
              A plataforma é fornecida &quot;como está&quot;. Na máxima extensão permitida
              em lei, não nos responsabilizamos por decisões tomadas com base em conteúdo
              gerado por IA nem por indisponibilidades de serviços de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">8. Alterações</h2>
            <p>
              Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas na
              plataforma. O uso continuado após a atualização significa aceitação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">9. Contato</h2>
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a href="mailto:contato@zaeon.com.br" className="text-cyan-600 dark:text-cyan-400 underline underline-offset-4">
                contato@zaeon.com.br
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
