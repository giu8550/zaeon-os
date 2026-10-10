/**
 * Cyberespaço — QUALIDADE ADAPTATIVA (a escada do CS Brasil, public/js/qualidade-adaptativa.js): mede o intervalo
 * entre quadros desenhados (média por janela de 1 s) contra o orçamento do perfil (60/45/30 fps) e
 *  - DESCE um degrau depois de ~3 s acima de 115% do orçamento (está perdendo quadro);
 *  - SOBE um degrau depois de ~12 s dentro de 105% (liso — com o limite de fps, o intervalo nunca fica muito abaixo);
 *  - carência de 4 s depois de qualquer troca; se cair 2× no MESMO degrau, ele vira o piso da sessão (não oscila);
 *  - quadro > 1 s (aba escondida, pausa, carregamento) não conta.
 * Os degraus mexem no que pesa, NESTA ordem (out/2026): nebulosa, o ALCANCE (até onde se desenha: a câmera, as IAs da
 * frota com corpo e em silhueta), a aura dos avatares e, por último, a resolução — que nunca cai abaixo de 0,8 (o dono:
 * "não deixar o serrilhado no talo"; antes descia até 0,6). PURO.
 */
export type Degrau = { nome: string; dpr: number; nebulosa: number; aura: boolean; /** multiplica as distâncias de desenho */ alcance: number };
export const DEGRAUS: readonly Degrau[] = [
  { nome: "cheio", dpr: 1, nebulosa: 0.5, aura: true, alcance: 1 },
  { nome: "nebulosa-", dpr: 1, nebulosa: 0.35, aura: true, alcance: 1 },
  { nome: "alcance-", dpr: 1, nebulosa: 0.35, aura: true, alcance: 0.7 },
  { nome: "sem-aura", dpr: 1, nebulosa: 0.3, aura: false, alcance: 0.7 },
  { nome: "alcance--", dpr: 1, nebulosa: 0.3, aura: false, alcance: 0.5 },
  { nome: "dpr-", dpr: 0.9, nebulosa: 0.25, aura: false, alcance: 0.5 },
  { nome: "minimo", dpr: 0.8, nebulosa: 0.25, aura: false, alcance: 0.4 },
];
export const QA = { janelaS: 1, desceApos: 3, sobeApos: 12, margemDesce: 1.15, margemSobe: 1.05, carenciaS: 4, viagensMax: 2, quadroMaxMs: 1000 } as const;

export class QualidadeAdaptativa {
  degrau = 0;
  private orcamento: number;
  private acum = 0; private n = 0;          // a janela atual
  private ruim = 0; private bom = 0;        // segundos seguidos acima/dentro do orçamento
  private carencia = 0;
  private quedas = new Map<number, number>();
  private piso = 0;                          // o melhor degrau permitido (sobe com as oscilações)
  constructor(fpsMax: number, inicial = 0) { this.orcamento = 1000 / (fpsMax > 0 ? fpsMax : 60); this.degrau = inicial; this.piso = inicial; }

  /** um quadro desenhado (intervalo desde o anterior, ms); devolve o NOVO degrau quando muda, senão null */
  registrar(dtMs: number): number | null {
    if (!(dtMs > 0) || dtMs > QA.quadroMaxMs) return null;
    this.acum += dtMs; this.n++;
    if (this.acum < QA.janelaS * 1000) return null;
    const media = this.acum / this.n, seg = this.acum / 1000; this.acum = 0; this.n = 0;
    if (this.carencia > 0) { this.carencia -= seg; return null; }
    if (media > this.orcamento * QA.margemDesce) { this.ruim += seg; this.bom = 0; } else if (media <= this.orcamento * QA.margemSobe) { this.bom += seg; this.ruim = 0; } else { this.ruim = 0; this.bom = 0; }
    if (this.ruim >= QA.desceApos && this.degrau < DEGRAUS.length - 1) {
      this.degrau++; const q = (this.quedas.get(this.degrau) ?? 0) + 1; this.quedas.set(this.degrau, q);
      if (q >= QA.viagensMax) this.piso = Math.max(this.piso, this.degrau);
      return this.trocou();
    }
    if (this.bom >= QA.sobeApos && this.degrau > this.piso) { this.degrau--; return this.trocou(); }
    return null;
  }
  get atual(): Degrau { return DEGRAUS[this.degrau]!; }
  private trocou() { this.ruim = 0; this.bom = 0; this.carencia = QA.carenciaS; return this.degrau; }
}
