/** Localização (5 variantes). Portadas de preview/location/* do sitecrm. Mapa só com `mapUrl`; sem ele, cartão-mapa em CSS. */
import { Cabecalho, Icone, linkMapa, linkTel, Midia, txt, urlMidia } from "../comum";
import type { PropsSecao } from "../tipos";

/** Iframe do mapa (https) ou placeholder desenhado com link para o endereço. */
function Mapa({ p, className = "" }: { p: PropsSecao; className?: string }) {
  const src = urlMidia(p.mapUrl);
  const endereco = txt(p.address);
  return (
    <div className={`z-mapa ${className}`.trim()}>
      {src.startsWith("http") ? (
        <iframe src={src} title="Mapa" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      ) : (
        <a className="z-mapa-vazio" href={endereco ? linkMapa(endereco) : "#"} aria-label="Abrir no mapa">
          <span className="z-mapa-pino"><Icone nome="pin" /></span>
          {endereco ? <span className="z-mapa-end">{endereco}</span> : null}
        </a>
      )}
    </div>
  );
}

type Linha = [string, string, string, string?];
function Dados({ p, tudo = false }: { p: PropsSecao; tudo?: boolean }) {
  const linhas: Linha[] = [
    ["pin", "Endereço", txt(p.address)],
    ["phone", "Telefone", txt(p.phone), txt(p.phone) ? linkTel(txt(p.phone)) : undefined],
    ["clock", "Horário", txt(p.hours)],
    ["mail", "E-mail", tudo ? txt(p.email) : "", txt(p.email) ? `mailto:${txt(p.email)}` : undefined],
  ];
  return (
    <dl className="z-dados">
      {linhas.filter(([, , v]) => v).map(([ic, rot, v, href]) => (
        <div className="z-linha" key={rot}>
          <span className="z-ico-caixa"><Icone nome={ic} /></span>
          <div><dt>{rot}</dt><dd>{href ? <a href={href}>{v}</a> : v}</dd></div>
        </div>
      ))}
    </dl>
  );
}

const ComoChegar = ({ p, children, ...r }: { p: PropsSecao; children: string; variante?: "" | "vazado" | "texto"; seta?: boolean }) =>
  txt(p.address) ? <a className={`z-btn${r.variante ? ` z-btn--${r.variante}` : ""}`} href={linkMapa(txt(p.address))} target="_blank" rel="noopener noreferrer">{children}{r.seta ? <Icone nome="externo" className="z-btn-seta" /> : null}</a> : null;

/** location — informações à esquerda, mapa à direita. */
export function LocationSimple(p: PropsSecao) {
  return (
    <section className="z-sec">
      <div className="z-cont z-mapa-grade">
        <div className="z-mapa-info">
          <Cabecalho eyebrow={p.eyebrow ?? "Onde estamos"} title={p.title} subtitle={p.subtitle} />
          <Dados p={p} tudo />
          <ComoChegar p={p} variante="texto" seta>Abrir no mapa</ComoChegar>
        </div>
        <Mapa p={p} />
      </div>
    </section>
  );
}

/** location_float — mapa de fundo com cartão flutuante. */
export function LocationFloat(p: PropsSecao) {
  return (
    <section className="z-sec z-sec--cheia z-flutua">
      <Mapa p={p} className="z-mapa--fundo" />
      <div className="z-cont z-flutua-cartao-pos">
        <div className="z-cartao z-flutua-cartao">
          {txt(p.title) ? <h2 className="z-titulo z-titulo--medio">{txt(p.title)}</h2> : null}
          <Dados p={p} />
          <ComoChegar p={p} seta>Como chegar</ComoChegar>
        </div>
      </div>
    </section>
  );
}

/** location_visual — cartão grande: foto com endereço sobreposto + dados. */
export function LocationVisual(p: PropsSecao) {
  return (
    <section className="z-sec z-alt">
      <div className="z-cont">
        <div className="z-visual">
          <div className="z-visual-foto z-inv">
            <Midia src={p.image} alt={txt(p.title)} />
            <div className="z-veu z-veu--base" />
            <p><Icone nome="pin" /> <span>{txt(p.address)}</span></p>
          </div>
          <div className="z-visual-info">
            {txt(p.title) ? <h2 className="z-titulo">{txt(p.title)}</h2> : null}
            <Dados p={p} />
            <ComoChegar p={p} variante="vazado" seta>Abrir no mapa</ComoChegar>
          </div>
        </div>
      </div>
    </section>
  );
}

/** location_grid — quatro cartões: endereço, telefone, e-mail, horário. */
export function LocationGrid(p: PropsSecao) {
  const cards: Array<[string, string, string, string?]> = [
    ["pin", "Visite-nos", txt(p.address)],
    ["phone", "Ligue", txt(p.phone), txt(p.phone) ? linkTel(txt(p.phone)) : undefined],
    ["mail", "Escreva", txt(p.email), txt(p.email) ? `mailto:${txt(p.email)}` : undefined],
    ["clock", "Expediente", txt(p.hours)],
  ];
  return (
    <section className="z-sec">
      <div className="z-cont">
        <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} centro />
        <div className="z-grade z-grade--4">
          {cards.filter(([, , v]) => v).map(([ic, rot, v, href]) => (
            <article className="z-cartao z-cartao--centro" key={rot}>
              <span className="z-ico-caixa z-ico-caixa--cheia"><Icone nome={ic} /></span>
              <h3 className="z-item-titulo">{rot}</h3>
              <p className="z-item-desc">{href ? <a href={href}>{v}</a> : v}</p>
            </article>
          ))}
        </div>
        <div className="z-acoes z-acoes--centro"><ComoChegar p={p} variante="vazado" seta>Abrir no mapa</ComoChegar></div>
      </div>
    </section>
  );
}

/** location_dark — painel invertido, informações + mapa escurecido. */
export function LocationDark(p: PropsSecao) {
  return (
    <section className="z-sec z-inv">
      <div className="z-cont z-mapa-grade z-mapa-grade--meio">
        <div className="z-mapa-info">
          <Cabecalho eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
          <Dados p={p} tudo />
          <ComoChegar p={p} seta>Ver no mapa</ComoChegar>
        </div>
        <Mapa p={p} className="z-mapa--escuro" />
      </div>
    </section>
  );
}
