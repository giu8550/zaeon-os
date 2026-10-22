/** Sobre (5 variantes). Portadas de preview/about/* do sitecrm. Números e missão viram props (`stats`, `items`). */
import { Cabecalho, Icone, lista, Midia, Paragrafos, txt } from "../comum";
import type { ItemFeature, ItemStat, PropsSecao } from "../tipos";

const primeiro = (t?: string) => (t ?? "").split(/\n+/)[0]?.trim() ?? "";
const resto = (t?: string) => (t ?? "").split(/\n+/).slice(1).join("\n");

/** about — texto com dados de contato e foto com moldura inclinada. */
export function AboutClassic(p: PropsSecao) {
  const contato: Array<[string, string, string]> = [["pin", "Endereço", txt(p.address)], ["phone", "Telefone", txt(p.phone)]];
  const tem = contato.some(([, , v]) => v);
  return (
    <section className="z-sec">
      <div className="z-cont z-metade">
        <div>
          <Cabecalho eyebrow={p.eyebrow ?? "Sobre nós"} title={p.title} />
          <div className="z-prosa"><Paragrafos texto={p.description} /></div>
          {tem ? (
            <dl className="z-contatos">
              {contato.filter(([, , v]) => v).map(([ic, rot, v]) => (
                <div className="z-contato" key={rot}><Icone nome={ic} className="z-ico--cor" /><div><dt>{rot}</dt><dd>{v}</dd></div></div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="z-moldura z-moldura--inclinada"><Midia src={p.image} alt={txt(p.title)} /></div>
      </div>
    </section>
  );
}

/** about_minimal — título gigante à esquerda, destaque + foto + texto em colunas à direita. */
export function AboutMinimal(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont z-assimetrico">
        <div>
          {txt(p.title) ? <h2 className="z-titulo z-titulo--gigante">{txt(p.title)}</h2> : null}
          <span className="z-barra" aria-hidden="true" />
        </div>
        <div>
          {primeiro(p.description) ? <p className="z-lead z-lead--grande">{primeiro(p.description)}</p> : null}
          <div className="z-moldura z-moldura--larga"><Midia src={p.image} alt="" /></div>
          {resto(p.description) ? <div className="z-prosa z-prosa--colunas"><Paragrafos texto={resto(p.description)} /></div> : null}
        </div>
      </div>
    </section>
  );
}

/** about_profile — cartão de retrato com citação. */
export function AboutProfile(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont z-cont--medio">
        <div className="z-perfil">
          <div className="z-moldura z-moldura--retrato"><Midia src={p.image} alt={txt(p.title)} /></div>
          <div>
            <Icone nome="quote" className="z-ico--enorme z-ico--suave" />
            {txt(p.title) ? <h2 className="z-titulo">{txt(p.title)}</h2> : null}
            {primeiro(p.description) ? <p className="z-citacao">{primeiro(p.description)}</p> : null}
            {resto(p.description) ? <div className="z-prosa"><Paragrafos texto={resto(p.description)} /></div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** about_stats — foto com cartão flutuante e fileira de números (`stats`). */
export function AboutStats(p: PropsSecao) {
  const stats = lista<ItemStat>(p.stats).filter((s) => txt(s.valor));
  const [destaque, ...demais] = stats;
  return (
    <section className="z-sec">
      <div className="z-cont z-metade z-metade--inversa">
        <div className="z-moldura z-moldura--diagonal">
          <Midia src={p.image} alt="" />
          {destaque ? (
            <div className="z-flutuante">
              <strong>{txt(destaque.valor)}</strong>
              {txt(destaque.rotulo) ? <span>{txt(destaque.rotulo)}</span> : null}
            </div>
          ) : null}
        </div>
        <div>
          <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
          <div className="z-prosa"><Paragrafos texto={p.description} /></div>
          {demais.length ? (
            <dl className="z-numeros">
              {demais.slice(0, 3).map((s, k) => (
                <div key={k}><dt>{txt(s.valor)}</dt><dd>{txt(s.rotulo)}</dd></div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** about_grid — título e texto centralizados sobre um mosaico (foto grande + até 2 cartões de `items`). */
export function AboutImageGrid(p: PropsSecao) {
  const cards = lista<ItemFeature>(p.items).slice(0, 2);
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.description} centro />
        <div className="z-mosaico-img">
          <div className="z-moldura z-moldura--cheia z-mosaico-principal"><Midia src={p.image} alt="" /></div>
          <div className="z-mosaico-lado">
            {cards.length ? cards.map((c, k) => (
              <article className={k === 0 ? "z-cartao z-cartao--tom" : "z-cartao"} key={k}>
                <Icone nome={c.icon} className="z-ico--grande z-ico--cor" />
                <h3 className="z-item-titulo">{txt(c.title)}</h3>
                {txt(c.description) ? <p className="z-item-desc">{txt(c.description)}</p> : null}
              </article>
            )) : <div className="z-ph z-mosaico-vazio" aria-hidden="true" />}
          </div>
        </div>
      </div>
    </section>
  );
}
