"use client";
/** Botão "Corrigir com o Octa": leva o erro do navegador (Python ou app React) pro agente como um turno novo. O aluno clica, nada vai sozinho. */
import { Wrench } from "lucide-react";
import { pedidoCorrecao, type OrigemErro } from "@/lib/octa/pedidoCorrecao";

export default function CorrigirComOcta({ origem, arquivo, saida, desabilitado, onCorrigir }: {
  origem: OrigemErro; arquivo?: string;
  /** texto do erro; vazio = sem erro, o botão nem aparece */
  saida: string;
  /** o Octa já está num turno */
  desabilitado?: boolean;
  /** recebe o pedido pronto; quem chama inicia o turno pelo fluxo normal */
  onCorrigir: (pedido: string) => void;
}) {
  if (!saida.trim()) return null;
  return (
    <button type="button" disabled={desabilitado}
      title={desabilitado ? "O Octa está trabalhando: espere o pedido acabar" : "Manda este erro pro Octa corrigir"}
      onClick={() => onCorrigir(pedidoCorrecao({ origem, arquivo, saida }))}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11.5px] border border-white/20 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed">
      <Wrench className="w-3 h-3" /> Corrigir com o Octa
    </button>
  );
}
