"use client";

/**
 * A bancada em si. Quem decide se ela existe é o page.tsx ao lado, que é servidor.
 */
import { useCallback, useEffect, useState } from "react";
import MagazineAnswerView from "@/components/study/MagazineAnswerView";
import type { StructuredAnswer } from "@/lib/agent/contracts";
import type { StudioBlockData } from "@/components/studio/StudioBlock";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";
const CID_CAFEINA = 2519;

const RESPOSTA: StructuredAnswer = {
  nucleo:
    "A cafeína age bloqueando os receptores de adenosina no cérebro: ela não te dá energia, " +
    "ela esconde o cansaço que já estava lá.",
  desenvolvimento:
    "Durante o dia, a adenosina se acumula no cérebro como um subproduto do consumo de energia. " +
    "Quanto mais ela se liga aos seus receptores, mais o sistema nervoso central desacelera — é " +
    "esse acúmulo que a gente sente como sono. A molécula de cafeína tem uma forma parecida o " +
    "bastante com a da adenosina para encaixar nos mesmos receptores, mas não os ativa. Ela ocupa " +
    "a vaga e vai embora.\n\n" +
    "O resultado é que o freio continua existindo, só não consegue ser pisado. A adenosina " +
    "continua sendo produzida e continua se acumulando, agora sem lugar para se ligar. Por isso a " +
    "queda depois do efeito passar costuma ser mais pesada do que o cansaço original: quando a " +
    "cafeína é metabolizada e libera os receptores, toda a adenosina represada encontra vaga de " +
    "uma vez só.\n\n" +
    "A meia-vida da cafeína no corpo de um adulto fica entre três e sete horas, e depende de " +
    "enzimas do fígado que variam bastante de pessoa para pessoa. É por isso que a mesma xícara " +
    "às quatro da tarde derruba uma pessoa na hora de dormir e não faz cócegas na outra — não é " +
    "força de vontade, é farmacocinética.\n\n" +
    "A tolerância aparece porque o cérebro responde ao bloqueio fabricando mais receptores. Com " +
    "mais vagas disponíveis, a mesma dose cobre uma fração menor delas, e a linha de base se " +
    "desloca: o café deixa de ser um empurrão e passa a ser a condição para você se sentir normal.",
  conceitos: ["adenosina", "meia-vida", "tolerância", "farmacocinética"],
  destaques: [
    { latex: "C_{t} = C_{0}\\,e^{-k t}", rotulo: "decaimento no plasma" },
    { latex: "t_{1/2} = \\frac{\\ln 2}{k}", rotulo: "meia-vida" },
  ],
  proximos_passos: ["Comparar com a teofilina", "Ver a curva de tolerância"],
};

export default function Bancada() {
  const [molecula, setMolecula] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [largura, setLargura] = useState(880);
  const [geracao, setGeracao] = useState(0);
  const [comArtefato, setComArtefato] = useState(true);
  const [comDestaques, setComDestaques] = useState(true);

  // SDF direto do PubChem: a rota do produto exige sessão, e aqui não há login.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sdf = await fetch(`${PUG}/cid/${CID_CAFEINA}/SDF?record_type=3d`).then((r) => {
          if (!r.ok) throw new Error(`PubChem ${r.status}`);
          return r.text();
        });
        if (!vivo) return;
        setMolecula({
          cid: CID_CAFEINA,
          termo: "cafeína",
          nomeResolvido: "caffeine",
          formula: "C8H10N4O2",
          peso: "194.19",
          sdf,
          tridimensional: true,
          url: `https://pubchem.ncbi.nlm.nih.gov/compound/${CID_CAFEINA}`,
        });
      } catch (e: any) {
        if (vivo) setErro(String(e?.message || e));
      }
    })();
    return () => { vivo = false; };
  }, []);

  const artefato: StudioBlockData | null =
    comArtefato && molecula
      ? { studioKind: "molecule", title: "Molécula — cafeína", data: molecula }
      : null;

  const answer: StructuredAnswer = comDestaques
    ? RESPOSTA
    : { ...RESPOSTA, destaques: undefined };

  const renascer = useCallback(() => setGeracao((g) => g + 1), []);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0d14", color: "#e8eaf0", padding: "28px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
          <strong style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.6 }}>
            bancada · modo revista
          </strong>
          <button onClick={renascer} style={botao}>↻ renascer (ver as letras chegarem)</button>
          <label style={rotulo}>
            <input type="checkbox" checked={comArtefato} onChange={(e) => setComArtefato(e.target.checked)} /> artefato
          </label>
          <label style={rotulo}>
            <input type="checkbox" checked={comDestaques} onChange={(e) => setComDestaques(e.target.checked)} /> destaques (LaTeX)
          </label>
          <label style={{ ...rotulo, gap: 8 }}>
            largura {largura}px
            <input type="range" min={320} max={1000} step={10} value={largura}
                   onChange={(e) => setLargura(Number(e.target.value))} />
          </label>
        </header>

        {erro && <p style={{ color: "#ff9a9a", fontSize: 13 }}>PubChem falhou: {erro} — a molécula não vai aparecer.</p>}

        <div style={{ width: largura, maxWidth: "100%", outline: "1px dashed rgba(255,255,255,.12)", padding: 18 }}>
          <MagazineAnswerView
            key={`${geracao}-${comArtefato}-${comDestaques}`}
            answer={answer}
            recemChegada
            artefato={artefato}
            agente="Aura"
          />
        </div>
      </div>
    </main>
  );
}

const botao: React.CSSProperties = {
  background: "rgba(255,255,255,.07)", color: "inherit", border: "1px solid rgba(255,255,255,.16)",
  borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer",
};
const rotulo: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: 0.85 };
