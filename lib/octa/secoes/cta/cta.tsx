/** Chamadas finais (5 variantes). Portadas de preview/cta/* do sitecrm. Promessas fixas viram `bullets`/`nota`. */
import { Botao, Icone, Midia, txt } from "../comum";
import type { PropsSecao } from "../tipos";

const Texto = ({ p, centro = false }: { p: PropsSecao; centro?: boolean }) => (
  <>
    {txt(p.title) ? <h2 className="z-titulo z-cta-titulo">{txt(p.title)}</h2> : null}
    {txt(p.subtitle) ? <p className={centro ? "z-lead z-cta-sub" : "z-lead"}>{txt(p.subtitle)}</p> : null}
  </>
);

/** cta — painel invertido centralizado com brilhos da cor primária. */
export function CtaCentric(p: PropsSecao) {
  return (
    <section className="z-sec z-inv z-cta z-brilho">
      <div className="z-cont z-cont--medio z-centro">
        <Texto p={p} centro />
        <div className="z-acoes z-acoes--centro"><Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao></div>
        {txt(p.nota) ? <p className="z-nota">{txt(p.nota)}</p> : null}
      </div>
    </section>
  );
}

/** cta_image — cartão escuro arredondado: texto, lista de promessas (`bullets`) e foto. */
export function CtaImage(p: PropsSecao) {
  const itens = (Array.isArray(p.bullets) ? p.bullets : []).filter((b) => typeof b === "string" && b.trim());
  return (
    <section className="z-sec">
      <div className="z-cont">
        <div className="z-cta-cartao z-inv">
          <div className="z-cta-corpo">
            <Texto p={p} />
            {itens.length ? <ul className="z-checks">{itens.map((b, k) => <li key={k}><Icone nome="check" className="z-ico--cor" />{b}</li>)}</ul> : null}
            <div className="z-acoes"><Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao></div>
          </div>
          <div className="z-cta-foto"><Midia src={p.backgroundImage} alt="" /></div>
        </div>
      </div>
    </section>
  );
}

/** cta_minimal — caixa com fio e barra de cor no topo; segundo botão opcional. */
export function CtaMinimal(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont z-cont--medio">
        <div className="z-cta-caixa z-centro">
          <Texto p={p} centro />
          <div className="z-acoes z-acoes--centro">
            <Botao href={p.ctaLink}>{txt(p.ctaText)}</Botao>
            {txt(p.ctaSecondaryText) ? <Botao href={p.ctaSecondaryLink} variante="vazado">{txt(p.ctaSecondaryText)}</Botao> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** cta_whatsapp — convite para conversar; o link (wa.me/…) vem em `ctaLink`. */
export function CtaWhatsApp(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont z-cont--medio">
        <div className="z-cartao z-cta-chat">
          <span className="z-chat-icone"><Icone nome="msg" className="z-ico--enorme" /></span>
          <div>
            <Texto p={p} />
            <div className="z-acoes"><Botao href={p.ctaLink}><Icone nome="msg" />{txt(p.ctaText)}</Botao></div>
            {txt(p.nota) ? <p className="z-nota">{txt(p.nota)}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** cta_gradient — gradiente entre primária e acento, com selo opcional. */
export function CtaGradient(p: PropsSecao) {
  return (
    <section className="z-sec z-inv z-gradiente z-cta">
      <div className="z-cont z-cont--medio z-centro">
        {txt(p.eyebrow) ? <p className="z-selo">{txt(p.eyebrow)}</p> : null}
        <Texto p={p} centro />
        <div className="z-acoes z-acoes--centro"><Botao href={p.ctaLink} seta>{txt(p.ctaText)}</Botao></div>
      </div>
    </section>
  );
}
