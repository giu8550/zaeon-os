import { describe, it, expect } from "vitest";
import { montarPainel, contaView, resumoDaConta, severidadeDoEstado, type LinhaCanalSocial, type VozView } from "./painel";
import { TETO_DIA_PADRAO, diaBrt } from "./politica";

const AGORA = new Date("2026-10-29T17:00:00Z"); // 14h BRT
const HOJE = diaBrt(AGORA);

const vozes: VozView[] = [
  { agentKey: "farmacia", nome: "Kekulé", tipo: "mentor", area: "Farmácia" },
  { agentKey: "aura", nome: "Aura", tipo: "persona", area: null },
];

const conectado = (over: Partial<LinhaCanalSocial> = {}): LinhaCanalSocial => ({
  rede: "linkedin", estado: "conectado", capacidades: ["publicar", "responder"],
  tokenRef: "LINKEDIN_TOKEN", limiteDia: 2, enviadosHoje: 0, diaContagem: HOJE, ...over,
});

describe("painel · contaView", () => {
  it("rede nunca configurada aparece como não conectada, com o teto padrão", () => {
    const c = contaView("x", undefined, AGORA);
    expect(c.estado).toBe("nao_conectado");
    expect(c.temCredencial).toBe(false);
    expect(c.limiteDia).toBe(TETO_DIA_PADRAO.x);
    expect(c.capacidadesAtivas).toEqual([]);          // não conectado não tem capacidade ativa
    expect(c.capacidadesDaRede).toContain("publicar"); // mas a rede sabe fazer
    expect(c.resumo).toMatch(/sem credencial/);
  });

  it("conectado: capacidades ativas, restam do dia e frase de pronto", () => {
    const c = contaView("linkedin", conectado(), AGORA);
    expect(c.severidade).toBe("ok");
    expect(c.capacidadesAtivas.sort()).toEqual(["publicar", "responder"]);
    expect(c.restamHoje).toBe(2);
    expect(c.usadoHoje).toBe(0);
    expect(c.resumo).toMatch(/pronto/);
    expect(c.resumo).toMatch(/aprovação humana/);     // aprovação é o default
  });

  it("autoPublicar muda a frase (e só ela)", () => {
    const c = contaView("linkedin", conectado({ autoPublicar: true }), AGORA);
    expect(c.autoPublicar).toBe(true);
    expect(c.resumo).toMatch(/automaticamente/);
  });

  it("capacidade que a rede NÃO faz é erro de configuração e vence a frase", () => {
    const c = contaView("linkedin", conectado({ capacidades: ["publicar", "dm"] }), AGORA);
    expect(c.capacidadesInvalidas).toEqual(["dm"]);
    expect(c.capacidadesAtivas).toEqual(["publicar"]);  // dm é descartada, não propagada
    expect(c.resumo).toMatch(/configuração inválida/);
  });

  it("teto batido: a frase diz que volta amanhã", () => {
    const c = contaView("linkedin", conectado({ enviadosHoje: 2 }), AGORA);
    expect(c.restamHoje).toBe(0);
    expect(c.usadoHoje).toBe(2);
    expect(c.resumo).toMatch(/teto de 2\/dia/);
  });

  it("contagem de ONTEM não conta pra hoje", () => {
    const c = contaView("linkedin", conectado({ enviadosHoje: 99, diaContagem: "2026-10-28" }), AGORA);
    expect(c.restamHoje).toBe(2);
    expect(c.usadoHoje).toBe(0);
  });

  it("cada estado tem frase própria e severidade coerente", () => {
    const casos: Array<[string, Severidade_, RegExp]> = [
      ["conectando", "atencao", /andamento/],
      ["precisa_autorizar", "parado", /reautorize/],
      ["restrito", "parado", /restringiu/],
      ["pausado", "atencao", /kill-switch/],
      ["erro", "parado", /erro/],
    ];
    for (const [estado, sev, re] of casos) {
      const c = contaView("x", conectado({ rede: "x", estado, ultimoErro: "401 do provedor" }), AGORA);
      expect(c.severidade, estado).toBe(sev);
      expect(c.resumo, estado).toMatch(re);
    }
  });

  it("nunca expõe o VALOR do token — só o nome da env", () => {
    const c = contaView("linkedin", conectado({ tokenRef: "LINKEDIN_TOKEN" }), AGORA);
    expect(c.tokenRef).toBe("LINKEDIN_TOKEN");
    expect(JSON.stringify(c)).not.toMatch(/Bearer|eyJ|sk-/);
  });

  it("estado desconhecido no banco não quebra a tela", () => {
    const c = contaView("x", conectado({ rede: "x", estado: "coisa_estranha" }), AGORA);
    expect(c.estado).toBe("nao_conectado");
  });
});
type Severidade_ = "ok" | "atencao" | "parado";

describe("painel · severidade e ordenação", () => {
  it("vocabulário do AgentChannel também é entendido (vinculado = ok)", () => {
    expect(severidadeDoEstado("vinculado")).toBe("ok");
    expect(severidadeDoEstado("conectado")).toBe("ok");
    expect(severidadeDoEstado("pausado_na_origem")).toBe("atencao");
    expect(severidadeDoEstado("erro")).toBe("parado");
  });

  it("o que precisa de gente vem primeiro", () => {
    const p = montarPainel({
      sociais: [conectado(), conectado({ rede: "x", estado: "erro" }), conectado({ rede: "instagram", estado: "conectando" })],
      agentes: [], vozes, externosLigados: true, aprovacaoForcada: false, agora: AGORA,
    });
    expect(p.contas.map((c) => c.rede)).toEqual(["x", "instagram", "linkedin"]); // parado → atenção → ok
  });
});

describe("painel · montarPainel", () => {
  it("as 3 redes institucionais aparecem SEMPRE, mesmo sem linha no banco", () => {
    const p = montarPainel({ sociais: [], agentes: [], vozes, externosLigados: true, aprovacaoForcada: false, agora: AGORA });
    expect(p.contas.map((c) => c.rede).sort()).toEqual(["instagram", "linkedin", "x"]);
    expect(p.prontas).toBe(0);
  });

  it("WhatsApp é POR AGENTE e usa o nome da voz; outros tipos de AgentChannel são ignorados", () => {
    const p = montarPainel({
      sociais: [],
      agentes: [
        { agentKey: "farmacia", tipo: "whatsapp", estado: "vinculado", numero: "+5511999998888", limiteDia: 20, enviadosHoje: 3, diaContagem: HOJE },
        { agentKey: "aura", tipo: "email", estado: "vinculado" },
      ],
      vozes, externosLigados: true, aprovacaoForcada: false, agora: AGORA,
    });
    expect(p.whatsapp).toHaveLength(1);
    expect(p.whatsapp[0].nome).toBe("Kekulé");
    expect(p.whatsapp[0].usadoHoje).toBe(3);
    expect(p.whatsapp[0].severidade).toBe("ok");
  });

  it("agente sem nome no roster cai no agentKey (não quebra)", () => {
    const p = montarPainel({
      sociais: [], agentes: [{ agentKey: "desconhecido", tipo: "whatsapp", estado: "erro" }],
      vozes, externosLigados: true, aprovacaoForcada: false, agora: AGORA,
    });
    expect(p.whatsapp[0].nome).toBe("desconhecido");
  });

  it("contagem de WhatsApp de ontem zera", () => {
    const p = montarPainel({
      sociais: [], agentes: [{ agentKey: "aura", tipo: "whatsapp", estado: "vinculado", enviadosHoje: 15, diaContagem: "2026-10-28" }],
      vozes, externosLigados: true, aprovacaoForcada: false, agora: AGORA,
    });
    expect(p.whatsapp[0].usadoHoje).toBe(0);
  });

  it("`prontas` conta só quem publica E tem cota", () => {
    const p = montarPainel({
      sociais: [conectado(), conectado({ rede: "x", enviadosHoje: 5, limiteDia: 5 }), conectado({ rede: "instagram", estado: "pausado" })],
      agentes: [], vozes, externosLigados: true, aprovacaoForcada: false, agora: AGORA,
    });
    expect(p.prontas).toBe(1); // linkedin; x sem cota; instagram pausado
  });

  it("vozes vêm ordenadas e as flags atravessam", () => {
    const p = montarPainel({ sociais: [], agentes: [], vozes, externosLigados: false, aprovacaoForcada: true, agora: AGORA });
    expect(p.vozes.map((v) => v.nome)).toEqual(["Aura", "Kekulé"]);
    expect(p.externosLigados).toBe(false);
    expect(p.aprovacaoForcada).toBe(true);
  });

  it("resumoDaConta é função pura do estado (sem data corrente escondida)", () => {
    const c = contaView("linkedin", conectado(), AGORA);
    expect(resumoDaConta({ ...c, restamHoje: 0 })).toMatch(/teto/);
  });
});
