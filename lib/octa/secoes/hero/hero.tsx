/** Heros (9 variantes). Portados de preview/hero/* do sitecrm; Tailwind → classes z-*, imagens opcionais. */
import { Botao, Icone, Midia, txt, urlMidia, urlSegura } from "../comum";
import type { PropsSecao } from "../tipos";

const Titulo = ({ p, className = "" }: { p: PropsSecao; className?: string }) =>
  txt(p.title) ? <h1 className={`z-titulo z-hero-titulo ${className}`.trim()}>{txt(p.title)}</h1> : null;
const Sub = ({ p }: { p: PropsSecao }) => (txt(p.subtitle) ? <p className="z-lead z-hero-sub">{txt(p.subtitle)}</p> : null);
const Eyebrow = ({ p }: { p: PropsSecao }) => (txt(p.eyebrow) ? <p className="z-selo">{txt(p.eyebrow)}</p> : null);

/** hero — imagem de fundo com véu, tudo centralizado. */
export function Hero(p: PropsSecao) {
  return (
    <section className="z-sec z-hero z-hero--centro z-inv">
      <div className="z-fundo"><Midia src={p.backgroundImage} /><div className="z-veu" /></div>
      <div className="z-cont z-hero-miolo">
        <Eyebrow p={p} />
        <Titulo p={p} />
        <Sub p={p} />
        <Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao>
      </div>
    </section>
  );
}

/** hero_modern — cartão de vidro sobre a imagem. */
export function HeroModern(p: PropsSecao) {
  return (
    <section className="z-sec z-hero z-hero--vidro z-inv">
      <div className="z-fundo"><Midia src={p.backgroundImage} /><div className="z-veu z-veu--leve" /></div>
      <div className="z-cont">
        <div className="z-vidro">
          <Eyebrow p={p} />
          <Titulo p={p} />
          <Sub p={p} />
          <Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao>
        </div>
      </div>
    </section>
  );
}

/** hero_visual — tela cheia, título gigante embaixo à esquerda, CTA à direita. */
export function HeroVisual(p: PropsSecao) {
  return (
    <section className="z-sec z-hero z-hero--tela z-inv">
      <div className="z-fundo"><Midia src={p.backgroundImage} /><div className="z-veu z-veu--base" /></div>
      <div className="z-cont z-hero-grade">
        <div>
          <Titulo p={p} />
          <Sub p={p} />
        </div>
        <div className="z-hero-acao"><Botao href={p.ctaLink} variante="vazado">{txt(p.ctaText)}</Botao></div>
      </div>
      <span className="z-rolar" aria-hidden="true"><Icone nome="baixo" /></span>
    </section>
  );
}

/** hero_split — texto de um lado, imagem do outro. */
export function HeroSplit(p: PropsSecao) {
  return (
    <section className="z-sec z-hero z-hero--split">
      <div className="z-cont z-metade">
        <div className="z-hero-texto">
          <Eyebrow p={p} />
          <Titulo p={p} />
          <Sub p={p} />
          <div className="z-acoes"><Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao>{txt(p.ctaSecondaryText) ? <Botao href={p.ctaSecondaryLink} variante="vazado">{txt(p.ctaSecondaryText)}</Botao> : null}</div>
        </div>
        <div className="z-moldura z-moldura--alta"><Midia src={p.backgroundImage} alt={txt(p.title)} /></div>
      </div>
    </section>
  );
}

/** hero_saas — texto centralizado e janela de produto embaixo. */
export function HeroSaaS(p: PropsSecao) {
  return (
    <section className="z-sec z-hero z-hero--saas z-alt">
      <div className="z-cont z-centro">
        <Eyebrow p={p} />
        <Titulo p={p} />
        <Sub p={p} />
        <div className="z-acoes z-acoes--centro"><Botao href={p.ctaLink}>{txt(p.ctaText)}</Botao>{txt(p.ctaSecondaryText) ? <Botao href={p.ctaSecondaryLink} variante="vazado">{txt(p.ctaSecondaryText)}</Botao> : null}</div>
        <div className="z-janela">
          <div className="z-janela-barra" aria-hidden="true"><i /><i /><i /></div>
          <Midia src={p.backgroundImage} alt="Prévia do produto" className="z-janela-tela" />
        </div>
      </div>
    </section>
  );
}

/** hero_minimal — editorial: barra de cor, título leve, link com sublinhado, retrato alto. */
export function HeroMinimal(p: PropsSecao) {
  return (
    <section className="z-sec z-hero z-hero--editorial">
      <div className="z-cont z-metade">
        <div className="z-hero-texto">
          <span className="z-barra" aria-hidden="true" />
          <Titulo p={p} />
          {txt(p.subtitle) ? <p className="z-lead z-hero-sub z-recuo">{txt(p.subtitle)}</p> : null}
          <Botao href={p.ctaLink} variante="texto" seta>{txt(p.ctaText)}</Botao>
        </div>
        <div className="z-moldura z-moldura--retrato z-canto"><Midia src={p.backgroundImage} alt="" /></div>
      </div>
    </section>
  );
}

/** hero_lead — captura de e-mail (só vira formulário se houver `formAction`). */
export function HeroLead(p: PropsSecao) {
  const acao = urlSegura(p.formAction);
  return (
    <section className="z-sec z-hero z-hero--lead z-inv">
      <div className="z-fundo"><Midia src={p.backgroundImage} /><div className="z-veu z-veu--lado" /></div>
      <div className="z-cont">
        <div className="z-hero-texto">
          <Eyebrow p={p} />
          <Titulo p={p} />
          <Sub p={p} />
          {acao ? (
            <form className="z-captura" action={acao} method="post">
              <label className="z-captura-campo">
                <Icone nome="mail" />
                <input type="email" name="email" required placeholder={txt(p.placeholder) || "Seu melhor e-mail"} aria-label="E-mail" />
              </label>
              <button className="z-btn" type="submit">{txt(p.ctaText) || "Enviar"}</button>
            </form>
          ) : (
            <Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao>
          )}
          {txt(p.nota) ? <p className="z-nota">{txt(p.nota)}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** hero_video — capa com botão de play (leva ao `videoUrl`, se houver). */
export function HeroVideo(p: PropsSecao) {
  const video = urlSegura(p.videoUrl);
  const play = (
    <>
      <span className="z-play-anel" aria-hidden="true" />
      <Icone nome="play" />
    </>
  );
  return (
    <section className="z-sec z-hero z-hero--video z-inv">
      <div className="z-fundo"><Midia src={p.backgroundImage} /><div className="z-veu" /></div>
      <div className="z-cont z-hero-miolo">
        {video ? <a className="z-play" href={video} aria-label="Assistir ao vídeo">{play}</a> : <span className="z-play">{play}</span>}
        <Titulo p={p} />
        <Sub p={p} />
        <Botao href={p.ctaLink}>{txt(p.ctaText)}</Botao>
      </div>
    </section>
  );
}

/** hero_diagonal — texto em bloco escuro e imagem recortada na diagonal. */
export function HeroDiagonal(p: PropsSecao) {
  const tem = !!urlMidia(p.backgroundImage);
  return (
    <section className="z-sec z-hero z-hero--diagonal z-inv">
      <div className="z-hero-lado">
        <div className="z-hero-texto">
          <Titulo p={p} className="z-caixa-alta" />
          {txt(p.subtitle) ? <p className="z-lead z-hero-sub z-recuo z-recuo--forte">{txt(p.subtitle)}</p> : null}
          <Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao>
        </div>
      </div>
      <div className={tem ? "z-hero-foto" : "z-hero-foto z-hero-foto--vazia"}><Midia src={p.backgroundImage} alt="" /></div>
    </section>
  );
}
