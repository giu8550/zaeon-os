import { describe, it, expect } from "vitest";
import { rotuloExterno } from "@/lib/ui/pensando";

describe("rotuloExterno — só ação externa real vira frase", () => {
  it.each([
    ["Pesquisando na internet", "Pesquisando na internet…"],
    ["buscando na web", "Pesquisando na internet…"],
    ["Lendo o PDF", "Lendo o PDF…"],
    ["Reunindo evidências", "Analisando trabalhos…"],
    ["Buscando fontes verificadas", "Analisando trabalhos…"],
    ["Analisando papers", "Analisando trabalhos…"],
    ["Gerando o áudio do podcast", "Gerando o áudio…"],
    ["Gerando a imagem", "Gerando a imagem…"],
  ])("%s → %s", (fase, txt) => expect(rotuloExterno(fase)).toBe(txt));
  it.each(["Entendendo o pedido", "Planejando a resposta", "Raciocinando", "Redigindo", "Revisando criticamente", "Finalizando", "Retomando a conversa", "Pensando", "Elaborando", "Sintetizando", "Ponderando", "", null, undefined])(
    "%s → só os pontinhos (null)", (fase) => expect(rotuloExterno(fase as any)).toBeNull(),
  );
});
