/** Depoimentos (5 variantes). Portados de preview/reviews/* do sitecrm. */
import { Cabecalho, Estrelas, Icone, lista, Midia, txt, urlMidia } from "../comum";
import type { ItemReview, PropsSecao } from "../tipos";

const itens = (p: PropsSecao) => lista<ItemReview>(p.items);
const nota = (i: ItemReview) => (typeof i.rating === "number" ? i.rating : 5);
const inicial = (n?: string) => (txt(n).charAt(0) || "?").toUpperCase();

function Avatar({ i, className = "" }: { i: ItemReview; className?: string }) {
  return urlMidia(i.avatar) ? (
    <Midia src={i.avatar} alt={txt(i.name)} className={`z-avatar ${className}`.trim()} />
  ) : (
    <span className={`z-avatar z-avatar--inicial ${className}`.trim()} aria-hidden="true">{inicial(i.name)}</span>
  );
}
const Autor = ({ i }: { i: ItemReview }) => (
  <div className="z-autor">
    <Avatar i={i} />
    <div><strong>{txt(i.name)}</strong>{txt(i.role) ? <span>{txt(i.role)}</span> : null}</div>
  </div>
);

/** reviews — grade de cartões com estrelas e autor. */
export function ReviewsGrid(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-grade z-grade--3">
          {itens(p).map((i, k) => (
            <figure className="z-cartao z-depoimento" key={k}>
              <Estrelas nota={nota(i)} />
              <blockquote>{txt(i.content)}</blockquote>
              <figcaption><Autor i={i} /></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** reviews_minimal — três colunas centradas, separadas por fio. */
export function ReviewsMinimal(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-colunas">
          {itens(p).slice(0, 3).map((i, k) => (
            <figure className="z-coluna z-coluna--centro" key={k}>
              <Avatar i={i} className="z-avatar--grande" />
              <Estrelas nota={nota(i)} className="z-estrelas--sobrio" />
              <blockquote className="z-fala">{txt(i.content)}</blockquote>
              <figcaption><strong>{txt(i.name)}</strong>{txt(i.role) ? <span>{txt(i.role)}</span> : null}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** reviews_dark — painel invertido com selo de nota opcional (`nota`). */
export function ReviewsDark(p: PropsSecao) {
  return (
    <section className="z-sec z-inv">
      <div className="z-cont">
        <div className="z-cab-linha">
          <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
          {txt(p.nota) ? <p className="z-selo z-selo--nota"><Icone nome="star" />{txt(p.nota)}</p> : null}
        </div>
        <div className="z-grade z-grade--3">
          {itens(p).map((i, k) => (
            <figure className="z-cartao z-depoimento" key={k}>
              <Autor i={i} />
              <blockquote>{txt(i.content)}</blockquote>
              <Estrelas nota={nota(i)} />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** reviews_spotlight — uma frase enorme (o 1º depoimento). */
export function ReviewsSpotlight(p: PropsSecao) {
  const d = itens(p)[0];
  return (
    <section className="z-sec z-alt">
      <div className="z-cont z-cont--medio z-centro">
        {txt(p.title) ? <h2 className="z-eyebrow z-eyebrow--cinza">{txt(p.title)}</h2> : null}
        {d ? (
          <figure className="z-destaque-fala">
            <Icone nome="quote" className="z-aspas" />
            <blockquote>{txt(d.content)}</blockquote>
            <figcaption>
              {urlMidia(d.avatar) ? <Midia src={d.avatar} alt={txt(d.name)} className="z-avatar z-avatar--grande" /> : null}
              <strong>{txt(d.name)}</strong>
              {txt(d.role) ? <span>{txt(d.role)}</span> : null}
            </figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  );
}

/** reviews_masonry — colunas CSS com cartões de alturas diferentes. */
export function ReviewsMasonry(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-masonry">
          {itens(p).map((i, k) => (
            <figure className="z-cartao z-masonry-item" key={k}>
              <Autor i={i} />
              <blockquote>{txt(i.content)}</blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
