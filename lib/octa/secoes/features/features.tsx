/** Features (10 variantes). Portadas de preview/features/* do sitecrm. Ícones por nome em `items[].icon`. */
import { Cabecalho, Icone, lista, txt, Botao } from "../comum";
import type { ItemFeature, PropsSecao } from "../tipos";

const itens = (p: PropsSecao) => lista<ItemFeature>(p.items);
const Nome = ({ i }: { i: ItemFeature }) => (txt(i.title) ? <h3 className="z-item-titulo">{txt(i.title)}</h3> : null);
const Desc = ({ i }: { i: ItemFeature }) => (txt(i.description) ? <p className="z-item-desc">{txt(i.description)}</p> : null);
const Caixa = ({ i }: { i: ItemFeature }) => <span className="z-ico-caixa"><Icone nome={i.icon} /></span>;

/** features — grade de cartões com ícone. */
export function FeaturesGrid(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-grade z-grade--3">
          {itens(p).map((i, k) => (
            <article className="z-cartao z-sobe" key={k}><Caixa i={i} /><Nome i={i} /><Desc i={i} /></article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_list — duas colunas, ícone ao lado, régua de cor no título. */
export function FeaturesList(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont">
        <div className="z-regua"><Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} /></div>
        <div className="z-grade z-grade--2 z-grade--folgada">
          {itens(p).map((i, k) => (
            <article className="z-linha" key={k}><Caixa i={i} /><div><Nome i={i} /><Desc i={i} /></div></article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_cards — cartão que se preenche com a cor primária ao passar o mouse. */
export function FeaturesCards(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-grade z-grade--3">
          {itens(p).map((i, k) => (
            <article className="z-cartao z-cartao--enche" key={k}><div className="z-cartao-corpo"><Icone nome={i.icon} className="z-ico--grande" /><Nome i={i} /><Desc i={i} /></div></article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_dark — painel invertido, quatro colunas, botão opcional. */
export function FeaturesDark(p: PropsSecao) {
  return (
    <section className="z-sec z-inv">
      <div className="z-cont">
        <div className="z-cab-linha">
          <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
          {txt(p.ctaText) ? <Botao href={p.ctaLink}>{txt(p.ctaText)}</Botao> : null}
        </div>
        <div className="z-grade z-grade--4">
          {itens(p).map((i, k) => (
            <article className="z-cartao" key={k}><Icone nome={i.icon} className="z-ico--grande z-ico--cor" /><Nome i={i} /><Desc i={i} /></article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_bento — mosaico; o 1º e o 4º cartão ocupam duas colunas. */
export function FeaturesBento(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-bento">
          {itens(p).map((i, k) => (
            <article className={k === 0 || k === 3 ? "z-cartao z-cartao--bento z-bento-largo" : "z-cartao z-cartao--bento"} key={k}>
              <Caixa i={i} />
              <div><Nome i={i} /><Desc i={i} /></div>
              {k === 0 || k === 3 ? <span className="z-trilha" aria-hidden="true" /> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_minimal — três colunas separadas por fio, tipografia leve. */
export function FeaturesMinimal(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont z-centro">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-colunas">
          {itens(p).slice(0, 3).map((i, k) => (
            <article className="z-coluna" key={k}><Icone nome={i.icon} className="z-ico--enorme" /><h3 className="z-item-titulo z-caixa-alta">{txt(i.title)}</h3><Desc i={i} /></article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_steps — três passos numerados ligados por uma linha. */
export function FeaturesSteps(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <ol className="z-passos">
          {itens(p).slice(0, 3).map((i, k) => (
            <li className="z-passo" key={k}>
              <span className="z-passo-bola"><Icone nome={i.icon} className="z-ico--grande z-ico--cor" /><b>{k + 1}</b></span>
              <Nome i={i} /><Desc i={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** features_mosaic — grade de células com fio, estilo tabela editorial. */
export function FeaturesMosaic(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont z-cont--medio">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-mosaico">
          {itens(p).map((i, k) => (
            <article className="z-celula" key={k}><Icone nome={i.icon} className="z-ico--grande z-ico--cor" /><Nome i={i} /><Desc i={i} /></article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** features_highlight — um destaque grande (1º item) e os demais em lista. */
export function FeaturesHighlight(p: PropsSecao) {
  const [destaque, ...resto] = itens(p);
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
        <div className="z-grade z-grade--2 z-grade--folgada">
          {destaque ? (
            <article className="z-destaque z-inv">
              <Icone nome={destaque.icon} className="z-destaque-fundo" />
              <div className="z-destaque-corpo">
                <span className="z-ico-caixa"><Icone nome={destaque.icon} /></span>
                <h3 className="z-titulo z-destaque-titulo">{txt(destaque.title)}</h3>
                <Desc i={destaque} />
                {txt(p.ctaText) ? <Botao href={p.ctaLink}>{txt(p.ctaText)}</Botao> : null}
              </div>
            </article>
          ) : null}
          <div className="z-pilha">
            {resto.map((i, k) => (
              <article className="z-cartao z-linha" key={k}><Caixa i={i} /><div><Nome i={i} /><Desc i={i} /></div></article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** features_glass — fundo em gradiente das cores do estilo e cartões de vidro. */
export function FeaturesGlass(p: PropsSecao) {
  return (
    <section className="z-sec z-inv z-gradiente">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-grade z-grade--3">
          {itens(p).map((i, k) => (
            <article className="z-cartao z-cartao--vidro" key={k}><Caixa i={i} /><Nome i={i} /><Desc i={i} /></article>
          ))}
        </div>
      </div>
    </section>
  );
}
